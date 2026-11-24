import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { saveJSON, loadJSON } from '../utils/storage';
import { apiGet, apiPost, apiPatch, apiDelete, getSavedToken, saveToken, clearToken, generateIdempotencyKey } from '../services/apiClient';
import { logLoginActivity } from '../utils/loginActivity';
import { SyncEngine } from '../services/SyncEngine';
import { BiometricAuth } from '../services/biometricAuth';
import { registerForPushNotifications, unregisterPushNotifications } from '../utils/pushNotifications';

const WalletContext = createContext(null);

const STORAGE_KEYS = {
  USER: 'zannypay:user',
  BALANCE: 'zannypay:balance',
  TXNS: 'zannypay:transactions',
  ONBOARDED: 'zannypay:onboarded',
  SAVINGS_GOALS: 'zannypay:savingsGoals',
  LOAN: 'zannypay:activeLoan',
  HIDE_BALANCE: 'zannypay:hideBalance',
  LOCAL_INVOICES: 'zannypay:localInvoices',
  FUNDING_ATTEMPT: 'zannypay:fundingAttempt',
};

const STARTING_BALANCE = 0;

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function mergeTransactionFeeds(remoteTxns = [], localInvoices = []) {
  const remoteIds = new Set(remoteTxns.map((t) => t.id));
  const extras = localInvoices.filter((t) => !remoteIds.has(t.id));
  return [...remoteTxns, ...extras].sort((a, b) => {
    const aTime = new Date(a.createdAt || a.date || 0).getTime();
    const bTime = new Date(b.createdAt || b.date || 0).getTime();
    return bTime - aTime;
  });
}

export function WalletProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [transactions, setTransactions] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [savingsApy, setSavingsApy] = useState(0);
  const [lastInterestEarned, setLastInterestEarned] = useState(null);
  const [loan, setLoan] = useState(null);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [serverCreditLimit, setServerCreditLimit] = useState(null);
  const [cards, setCards] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [referrals, setReferrals] = useState({ referralCode: null, totalReferred: 0, referred: [] });
  const [beneficiaries, setBeneficiaries] = useState([]);

  const localInvoicesRef = useRef([]);
  const transferAttemptRef = useRef(null);
  // Keep one idempotency key for an unchanged transfer attempt across a
  // timeout, lost response or screen remount. Clear it only after success;
  // changing recipient/amount/bank creates a distinct attempt.

  const toggleBalanceHidden = useCallback(async () => {
    setIsBalanceHidden((prev) => {
      const nextState = !prev;
      saveJSON(STORAGE_KEYS.HIDE_BALANCE, nextState);
      return nextState;
    });
  }, []);

  const syncWallet = useCallback(async () => {
    try {
      const data = await apiGet('/user/me');
      if (data && data.user) {
        setUser(data.user);
        await saveJSON(STORAGE_KEYS.USER, data.user);

        const walletBalance = data.balance !== undefined ? data.balance : data.user.wallet?.balance;
        const processedBalance = toNumber(walletBalance);
        setBalance(processedBalance);
        await saveJSON(STORAGE_KEYS.BALANCE, processedBalance);

        const remoteTxns = data.transactions || data.user.transactions || [];
        const merged = mergeTransactionFeeds(remoteTxns, localInvoicesRef.current);
        setTransactions(merged);
        await saveJSON(STORAGE_KEYS.TXNS, merged);

        if (data.user.savingsGoals) {
          setSavingsGoals(data.user.savingsGoals);
          await saveJSON(STORAGE_KEYS.SAVINGS_GOALS, data.user.savingsGoals);
        }
        if (data.user.loans) {
          const activeLoan = data.user.loans.find((l) => !l.repaid) || null;
          setLoan(activeLoan);
          await saveJSON(STORAGE_KEYS.LOAN, activeLoan);
        }

        if (data.user.cards) {
          setCards(data.user.cards);
        }
        if (data.user.invoices) {
          setInvoices(data.user.invoices);
        }
        if (data.user.budgets) {
          setBudgets(data.user.budgets);
        }
        if (data.user.disputes) {
          setDisputes(data.user.disputes);
        }

        const rawLimit = data.creditLimit !== undefined ? data.creditLimit : data.user.creditLimit;
        if (rawLimit !== undefined) {
          setServerCreditLimit(toNumber(rawLimit));
        }

        const rawApy = data.savingsApy !== undefined ? data.savingsApy : data.user.savingsApy;
        if (rawApy !== undefined) {
          setSavingsApy(toNumber(rawApy));
        }

        // Powers the Home screen's earnings strip — null until the
        // backend's daily accrual job has actually credited interest at
        // least once (see SavingsService.getLastInterestEarned).
        if (data.lastInterestEarned !== undefined) {
          setLastInterestEarned(data.lastInterestEarned);
        }

        return { ...data, transactions: merged, balance: processedBalance };
      }
      return null;
    } catch (error) {
      console.log('Background sync failed:', error.message);
      return null;
    }
  }, []);

  const retryQueuedRequest = useCallback(async (item) => {
    if (item.type !== 'POST_RETRY' && item.type !== 'PATCH_RETRY') return;
    const { endpoint, payload, method } = item.payload;
    const writer = method === 'PATCH' ? apiPatch : apiPost;
    const res = await writer(endpoint, payload, null, true);
    if (!res || res.success === false) throw new Error('Retry failed');
  }, []);

  const drainOfflineQueue = useCallback(async () => {
    await SyncEngine.processQueue(retryQueuedRequest);
    await syncWallet();
  }, [retryQueuedRequest, syncWallet]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isAuthenticated) {
        drainOfflineQueue();
      }
    });
    return () => subscription.remove();
  }, [isAuthenticated, drainOfflineQueue]); // <--- Hook warning resolved here

  useEffect(() => {
    (async () => {
      try {
        const [
          savedUser, savedBalance, savedTxns, savedOnboarded, savedToken,
          savedGoals, savedLoan, savedHideBalance, savedInvoices,
        ] = await Promise.all([
          loadJSON(STORAGE_KEYS.USER, null),
          loadJSON(STORAGE_KEYS.BALANCE, STARTING_BALANCE),
          loadJSON(STORAGE_KEYS.TXNS, []),
          loadJSON(STORAGE_KEYS.ONBOARDED, false),
          getSavedToken(),
          loadJSON(STORAGE_KEYS.SAVINGS_GOALS, []),
          loadJSON(STORAGE_KEYS.LOAN, null),
          loadJSON(STORAGE_KEYS.HIDE_BALANCE, false),
          loadJSON(STORAGE_KEYS.LOCAL_INVOICES, []),
        ]);

        localInvoicesRef.current = savedInvoices || [];

        setUser(savedUser);
        setBalance(toNumber(savedBalance));
        setTransactions(savedTxns);
        setOnboarded(savedOnboarded);
        setSavingsGoals(savedGoals || []);
        setLoan(savedLoan || null);
        setIsBalanceHidden(savedHideBalance || false);

        if (savedToken && savedUser) {
          setToken(savedToken);
          setIsAuthenticated(true);
          await syncWallet();
          drainOfflineQueue();
          registerForPushNotifications(); // re-registers on every cold start so a token rotated by Expo/the OS stays current
        }
      } catch (error) {
        console.error('Storage load error:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [syncWallet, drainOfflineQueue]);

  const completeOnboarding = useCallback(async () => {
    setOnboarded(true);
    await saveJSON(STORAGE_KEYS.ONBOARDED, true);
  }, []);

  const signup = useCallback(async ({ name, email, phone, pin, referredByCode }) => {
    try {
      const res = await apiPost('/auth/signup', {
        name,
        email: email?.trim(),
        phone,
        pin,
        ...(referredByCode ? { referredByCode: referredByCode.trim().toUpperCase() } : {}),
      });
      const validToken = res?.access_token || res?.token;
      if (res && validToken) {
        await saveToken(validToken);
        setToken(validToken);
        setUser(res.user);
        setIsAuthenticated(true);
        await saveJSON(STORAGE_KEYS.USER, res.user);
        if (res.user?.balance !== undefined) {
          const processedBalance = toNumber(res.user.balance);
          setBalance(processedBalance);
          await saveJSON(STORAGE_KEYS.BALANCE, processedBalance);
        }
        registerForPushNotifications();
        return { ok: true };
      }
      return { ok: false, error: res?.error || 'Registration failed.' };
    } catch (err) {
      return { ok: false, error: err.message || 'An error occurred during signup.' };
    }
  }, []);

  const login = useCallback(async (phone, pin) => {
    try {
      const res = await apiPost('/auth/login', { phone, pin });
      const validToken = res?.access_token || res?.token;
      if (res && validToken) {
        await saveToken(validToken);
        setToken(validToken);
        setUser(res.user);
        setIsAuthenticated(true);
        await saveJSON(STORAGE_KEYS.USER, res.user);
        await syncWallet();
        await logLoginActivity();
        registerForPushNotifications();
        return { ok: true };
      }
      return { ok: false, error: res?.error || 'Invalid telephone number or PIN.' };
    } catch (err) {
      return { ok: false, error: err.message || 'Connection to server failed.' };
    }
  }, [syncWallet]);

  // Used by the biometric-login flow (LoginScreen's fingerprint/Face ID
  // button): restores a session from an already-issued, revocable session
  // token that was saved at biometric-enrollment time — never from a
  // cached PIN. If the token has expired or is otherwise rejected, this
  // fails cleanly and clears it, so the caller can fall back to a normal
  // PIN login rather than getting stuck on a dead credential.
  const loginWithBiometricToken = useCallback(async (savedBiometricToken) => {
    if (!savedBiometricToken) return { ok: false, error: 'No saved session found.' };
    try {
      await saveToken(savedBiometricToken);
      setToken(savedBiometricToken);
      const data = await apiGet('/user/me'); // also validates the token is still live
      if (data && data.user) {
        setUser(data.user);
        await saveJSON(STORAGE_KEYS.USER, data.user);
        setIsAuthenticated(true);
        await syncWallet();
        await logLoginActivity();
        registerForPushNotifications();
        return { ok: true };
      }
      throw new Error('Session expired');
    } catch (err) {
      await clearToken();
      setToken(null);
      return { ok: false, error: 'Your saved session has expired. Please log in with your PIN.' };
    }
  }, [syncWallet]);

  const logout = useCallback(async () => {
    setIsAuthenticated(false);
    setToken(null);
    setUser(null);
    setBalance(0);
    setTransactions([]);
    setSavingsGoals([]);
    setLoan(null);
    setServerCreditLimit(null);
    await clearToken();
    unregisterPushNotifications(); // best-effort — see pushNotifications.js; must never block or fail logout itself
    // An explicit logout means fully logged out — the biometric
    // convenience credential goes with it, not just the active session.
    if (user?.phone) await BiometricAuth.clearFor(user.phone);
    fundingAttemptRef.current = null;
    await saveJSON(STORAGE_KEYS.FUNDING_ATTEMPT, null);
  }, [user]);

  const transferMoney = useCallback(async ({ recipientAccount, amount, pin, bank, bankCode, note, recipientName, idempotencyKey }) => {
    try {
      const fingerprint = JSON.stringify({
        recipientAccount,
        amount: parseFloat(amount),
        bank: bank || null,
        bankCode: bankCode || null,
        note: note || null,
      });
      const activeAttempt = transferAttemptRef.current;
      const stableKey = idempotencyKey || (
        activeAttempt?.fingerprint === fingerprint
          ? activeAttempt.key
          : generateIdempotencyKey()
      );
      transferAttemptRef.current = { fingerprint, key: stableKey };

      const payload = {
        recipientAccount,
        amount: parseFloat(amount),
        pin,
        bank,
        bankCode,
        note,
        recipientName,
        idempotencyKey: stableKey,
      };
      const res = await apiPost('/wallet/transfer', payload, { type: 'transfer', amount, account: recipientAccount });
      if (res && res.success) {
        transferAttemptRef.current = null;
        const data = await syncWallet();
        const txn = data?.transactions?.find((t) => t.id === res.transactionId) || null;
        return { ok: true, txn, transactionId: res.transactionId };
      }
      return { ok: false, error: res?.error || 'Transfer was rejected.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [syncWallet]);

  // VTpass bill services are called directly through authenticated backend
  // endpoints. Sensitive biller identifiers and transaction PINs are never
  // written to the offline retry queue.
  const fetchVtpassServices = useCallback(async (identifier) => {
    try {
      const res = await apiGet(`/wallet/bill-services?identifier=${encodeURIComponent(identifier)}`);
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const fetchVtpassVariations = useCallback(async (serviceId) => {
    try {
      const res = await apiGet(`/wallet/bill-services/${encodeURIComponent(serviceId)}/variations`);
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const verifyVtpassCustomer = useCallback(async ({ serviceID, billersCode, type }) => {
    try {
      const res = await apiPost('/wallet/bill-verify', {
        serviceID,
        billersCode: String(billersCode || '').trim(),
        ...(type ? { type } : {}),
      });
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const purchaseVtpassBill = useCallback(async (payload) => {
    const idempotencyKey = payload.idempotencyKey || generateIdempotencyKey();
    try {
      const res = await apiPost('/wallet/bill-purchase', {
        ...payload,
        amount: Number(payload.amount),
        idempotencyKey,
      });
      if (res && res.transactionId && res.status) {
        if (res.status === 'completed') await syncWallet();
        return { ok: true, data: res, idempotencyKey };
      }
      return { ok: false, error: res?.message || 'The bill purchase could not be confirmed.', idempotencyKey };
    } catch (err) {
      return { ok: false, error: err.message, idempotencyKey };
    }
  }, [syncWallet]);

  const fetchVtpassBillTransaction = useCallback(async (transactionId) => {
    try {
      const res = await apiGet(`/wallet/bill-transactions/${encodeURIComponent(transactionId)}`);
      if (res?.status === 'completed') await syncWallet();
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [syncWallet]);

  const payBill = useCallback(async ({ billerName, category, amount, reference, pin, pointsToRedeem }) => {
    try {
      const res = await apiPost('/wallet/billpay', { billerName, category, amount: parseFloat(amount), reference, pin, pointsToRedeem }, { type: 'bill', amount });
      if (res && res.success) {
        const data = await syncWallet();
        const txn = data?.transactions?.find((t) => t.id === res.transactionId) || null;
        return { ok: true, txn };
      }
      return { ok: false, error: res?.error || 'Bill payment was rejected.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [syncWallet]);

  const buyAirtime = useCallback(async ({ phone, amount, provider, pin, isData, pointsToRedeem }) => {
    try {
      const res = await apiPost('/wallet/airtime', { phone, amount: parseFloat(amount), provider, pin, type: isData ? 'data' : 'airtime', pointsToRedeem }, { type: 'airtime', amount, account: phone });
      if (res && res.success) {
        const data = await syncWallet();
        const txn = data?.transactions?.find((t) => t.id === res.transactionId) || null;
        return { ok: true, txn };
      }
      return { ok: false, error: res?.error || 'Airtime purchase failed.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [syncWallet]);

  const fundingAttemptRef = useRef(null);
  const clearFundingAttempt = useCallback(async (reference) => {
    const current = fundingAttemptRef.current || await loadJSON(STORAGE_KEYS.FUNDING_ATTEMPT, null);
    if (!reference || current?.reference === reference) {
      fundingAttemptRef.current = null;
      await saveJSON(STORAGE_KEYS.FUNDING_ATTEMPT, null);
    }
  }, []);

  const fundWallet = useCallback(async (amount) => {
    const normalizedAmount = Number(amount);
    try {
      let attempt = fundingAttemptRef.current || await loadJSON(STORAGE_KEYS.FUNDING_ATTEMPT, null);
      if (attempt?.userId && attempt.userId !== user?.id) {
        attempt = null;
        fundingAttemptRef.current = null;
        await saveJSON(STORAGE_KEYS.FUNDING_ATTEMPT, null);
      }
      if (attempt && Number(attempt.amount) !== normalizedAmount) {
        if (attempt.reference) {
          return {
            ok: false,
            pending: true,
            reference: attempt.reference,
            amount: Number(attempt.amount),
            error: 'You have an earlier funding attempt awaiting confirmation. Check that payment before starting another amount.',
          };
        }
        return {
          ok: false,
          error: 'A previous funding request is still being recovered. Enter the same amount again so ZannyPay can safely resume that payment attempt.',
        };
      }
      if (!attempt) {
        attempt = {
          amount: normalizedAmount,
          userId: user?.id || null,
          idempotencyKey: generateIdempotencyKey(),
          reference: null,
        };
        fundingAttemptRef.current = attempt;
        // Persist before the network request so a timeout or app restart
        // cannot silently generate a second payment intent.
        await saveJSON(STORAGE_KEYS.FUNDING_ATTEMPT, attempt);
      } else {
        fundingAttemptRef.current = attempt;
      }

      const res = await apiPost('/wallet/fund', {
        amount: normalizedAmount,
        idempotencyKey: attempt.idempotencyKey,
      });
      if (res?.reference) {
        attempt = { ...attempt, reference: res.reference };
        fundingAttemptRef.current = attempt;
        await saveJSON(STORAGE_KEYS.FUNDING_ATTEMPT, attempt);
      }
      if (res?.status === 'completed') {
        await clearFundingAttempt(res.reference);
        return { ok: true, completed: true, reference: res.reference };
      }
      if (res?.status === 'pending') {
        return {
          ok: false,
          pending: true,
          reference: res.reference || attempt.reference,
          amount: Number(attempt.amount),
          error: res.message || 'This payment is still being processed.',
        };
      }
      if (res?.success && res.authorizationUrl) {
        attempt = { ...attempt, reference: res.reference, authorizationUrl: res.authorizationUrl };
        fundingAttemptRef.current = attempt;
        await saveJSON(STORAGE_KEYS.FUNDING_ATTEMPT, attempt);
        return { ok: true, authorizationUrl: res.authorizationUrl, reference: res.reference, amount: normalizedAmount };
      }
      if (res?.status === 'failed') await clearFundingAttempt(res.reference);
      return { ok: false, error: res?.message || res?.error || 'Funding request failed.' };
    } catch (err) {
      // Keep the same idempotency key after an ambiguous network failure.
      return { ok: false, error: err.message };
    }
  }, [clearFundingAttempt, user?.id]);

  const getPendingFundingAttempt = useCallback(async () => {
    let attempt = fundingAttemptRef.current || await loadJSON(STORAGE_KEYS.FUNDING_ATTEMPT, null);
    if (!attempt) return null;
    // Never surface a pending payment belonging to another signed-in user,
    // or an old unscoped attempt from before account binding was introduced.
    if (!attempt.userId || attempt.userId !== user?.id) {
      fundingAttemptRef.current = null;
      await saveJSON(STORAGE_KEYS.FUNDING_ATTEMPT, null);
      return null;
    }
    fundingAttemptRef.current = attempt;
    return { amount: Number(attempt.amount), reference: attempt.reference || null, authorizationUrl: attempt.authorizationUrl || null };
  }, [user?.id]);

  const verifyFunding = useCallback(async (reference) => {
    try {
      const res = await apiGet(`/wallet/verify/${encodeURIComponent(reference)}`);
      if (res?.success || ['failed', 'abandoned', 'reversed'].includes(String(res?.status).toLowerCase())) {
        await clearFundingAttempt(reference);
      }
      return { ok: !!res?.success, status: res?.status || 'pending' };
    } catch (err) {
      return { ok: false, status: 'pending', error: err.message };
    }
  }, [clearFundingAttempt]);

  const recordInvoice = useCallback(async ({ clientName, amount, description }) => {
    try {
      await apiPost('/invoices', { clientName, amount: parseFloat(amount), description });
      const localTxn = {
        id: `local-inv-${Date.now()}`, type: 'invoice', category: 'Invoices', title: `Invoice to ${clientName}`,
        subtitle: description, amount: toNumber(amount), status: 'completed', createdAt: new Date().toISOString(),
        reference: `INV-${Date.now()}`, local: true,
      };
      const updatedInvoices = [localTxn, ...localInvoicesRef.current];
      localInvoicesRef.current = updatedInvoices;
      await saveJSON(STORAGE_KEYS.LOCAL_INVOICES, updatedInvoices);
      setTransactions((prev) => {
        const merged = mergeTransactionFeeds(prev.filter((t) => !t.local), updatedInvoices);
        saveJSON(STORAGE_KEYS.TXNS, merged);
        return merged;
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || 'Could not save this invoice on-device.' };
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await apiGet('/invoices');
      setInvoices(res || []);
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const fetchInvoiceDetail = useCallback(async (invoiceId) => {
    try {
      const res = await apiGet(`/invoices/${invoiceId}`);
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const markInvoicePaid = useCallback(async (invoiceId) => {
    try {
      const res = await apiPatch(`/invoices/${invoiceId}/mark-paid`, {});
      setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? res : inv)));
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const createRecurringTransfer = useCallback(async ({ recipientAccount, amount, note, frequency, pin }) => {
    try {
      const res = await apiPost('/recurring-transfers', { recipientAccount, amount: parseFloat(amount), note, frequency, pin });
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const fetchRecurringTransfers = useCallback(async () => {
    try {
      const res = await apiGet('/recurring-transfers');
      return { ok: true, data: res || [] };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const pauseRecurringTransfer = useCallback(async (id) => {
    try {
      const res = await apiPatch(`/recurring-transfers/${id}/pause`, {});
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const resumeRecurringTransfer = useCallback(async (id) => {
    try {
      const res = await apiPatch(`/recurring-transfers/${id}/resume`, {});
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const cancelRecurringTransfer = useCallback(async (id) => {
    try {
      const res = await apiPatch(`/recurring-transfers/${id}/cancel`, {});
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const requestVirtualCard = useCallback(async (network) => {
    try {
      const res = await apiPost('/cards/request', network ? { network } : undefined);
      if (res && (res.cardNumber || res.last4)) {
        await syncWallet();
        return { ok: true, card: res };
      }
      return { ok: false, error: res?.error || 'Failed to generate card' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [syncWallet]);

  const toggleCardFreeze = useCallback(async (cardId, isFrozen) => {
    try {
      const res = await apiPost(`/cards/${cardId}/freeze`, { isFrozen });
      if (res && res.id) {
        await syncWallet();
        return { ok: true };
      }
      return { ok: false, error: 'Failed to update card status.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [syncWallet]);

  // Links an existing external Visa/Mastercard/Verve card as a funding
  // source — see cards/providers/card-linking.provider.ts on the backend
  // for why `authorizationCode` comes from a processor's own card-
  // collection SDK, never a raw PAN typed into this app.
  const linkExternalCard = useCallback(async (authorizationCode) => {
    try {
      const res = await apiPost('/cards/link', { authorizationCode });
      if (res && res.id) {
        await syncWallet();
        return { ok: true, card: res };
      }
      return { ok: false, error: res?.error || 'Could not link this card.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [syncWallet]);

  const setDefaultCard = useCallback(async (cardId) => {
    try {
      const res = await apiPost(`/cards/${cardId}/default`);
      if (res && res.id) {
        await syncWallet();
        return { ok: true };
      }
      return { ok: false, error: 'Could not set this as your default card.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [syncWallet]);

  const updateCardLimits = useCallback(async (cardId, dailyLimit, monthlyLimit) => {
    try {
      const res = await apiPatch(`/cards/${cardId}/limits`, {
        ...(dailyLimit !== undefined && { dailyLimit: parseFloat(dailyLimit) }),
        ...(monthlyLimit !== undefined && { monthlyLimit: parseFloat(monthlyLimit) }),
      });
      if (res && res.id) {
        await syncWallet();
        return { ok: true, card: res };
      }
      return { ok: false, error: res?.error || 'Could not update card limits.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [syncWallet]);

  const removeCard = useCallback(async (cardId) => {
    try {
      await apiDelete(`/cards/${cardId}`);
      await syncWallet();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [syncWallet]);

  const fetchCardActivity = useCallback(async (cardId) => {
    try {
      const res = await apiGet(`/cards/${cardId}/activity`);
      return { ok: true, data: res || [] };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  // Never manufacture a borrowing limit from wallet activity. The backend
  // must return an explicitly underwritten limit before the UI can offer credit.
  const creditLimit = serverCreditLimit !== null ? serverCreditLimit : 0;

  const requestLoan = useCallback(async ({ amount, termDays }) => {
    try {
      const res = await apiPost('/loans/request', { amount: parseFloat(amount), termDays: termDays ? Number(termDays) : undefined });
      if (res && res.success && res.loan) {
        setLoan(res.loan);
        await saveJSON(STORAGE_KEYS.LOAN, res.loan);
        await syncWallet();
        return { ok: true, loan: res.loan };
      }
      return { ok: false, error: res?.error || 'Loan request was declined.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [syncWallet]);

  const repayLoan = useCallback(async (amount) => {
    try {
      const res = await apiPost('/loans/repay', { amount: parseFloat(amount) });
      if (res && res.success && res.loan) {
        const nextLoan = res.loan.repaid ? null : res.loan;
        setLoan(nextLoan);
        await saveJSON(STORAGE_KEYS.LOAN, nextLoan);
        await syncWallet();
        return { ok: true, loan: res.loan };
      }
      return { ok: false, error: res?.error || 'Repayment was rejected.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [syncWallet]);

  const createSavingsGoal = useCallback(async ({ name, target }) => {
    try {
      const res = await apiPost('/savings/goal', { name, target: parseFloat(target) });
      if (res && res.success && res.goal) {
        setSavingsGoals((prev) => {
          const updated = [res.goal, ...prev];
          saveJSON(STORAGE_KEYS.SAVINGS_GOALS, updated);
          return updated;
        });
        return { ok: true, goal: res.goal };
      }
      return { ok: false, error: res?.error || 'Could not create this savings goal.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const depositToSavings = useCallback(async (goalId, amount) => {
    try {
      const res = await apiPost('/savings/deposit', { goalId, amount: parseFloat(amount) });
      if (res && res.success && res.goal) {
        setSavingsGoals((prev) => {
          const updated = prev.map((g) => (g.id === res.goal.id ? res.goal : g));
          saveJSON(STORAGE_KEYS.SAVINGS_GOALS, updated);
          return updated;
        });
        await syncWallet();
        return { ok: true, goal: res.goal };
      }
      return { ok: false, error: res?.error || 'Deposit was rejected.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [syncWallet]);

  const withdrawFromSavings = useCallback(async (goalId, amount) => {
    try {
      const res = await apiPost('/savings/withdraw', { goalId, amount: parseFloat(amount) });
      if (res && res.success && res.goal) {
        setSavingsGoals((prev) => {
          const updated = prev.map((g) => (g.id === res.goal.id ? res.goal : g));
          saveJSON(STORAGE_KEYS.SAVINGS_GOALS, updated);
          return updated;
        });
        await syncWallet();
        return { ok: true, goal: res.goal };
      }
      return { ok: false, error: res?.error || 'Withdrawal was rejected.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [syncWallet]);

  // ==========================================
  // Profile management — name/email/address/profileImage updates, PIN
  // change, and beneficiary-name resolution (also powers phone-number
  // transfers: the same identifier a user types into Transfer can be
  // resolved here to confirm who they're actually sending money to).
  // ==========================================
  const updateProfile = useCallback(async (updates) => {
    try {
      const res = await apiPatch('/user/profile', updates);
      if (res && res.success && res.user) {
        setUser(res.user);
        await saveJSON(STORAGE_KEYS.USER, res.user);
        return { ok: true, user: res.user };
      }
      return { ok: false, error: res?.error || 'Could not update your profile.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const changePin = useCallback(async (oldPin, newPin) => {
    try {
      const res = await apiPatch('/user/pin', { oldPin, newPin });
      if (res && res.success) {
        return { ok: true };
      }
      return { ok: false, error: res?.error || 'Could not change your PIN.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  // Real, backend-tracked daily reward check-in (one credit per calendar
  // day, server-enforced — not a client AsyncStorage counter).
  const dailyCheckIn = useCallback(async () => {
    try {
      const res = await apiPost('/user/checkin', {});
      if (res) {
        setUser((prev) => (prev ? { ...prev, rewardPoints: res.rewardPoints, checkInStreak: res.streak } : prev));
        return {
          ok: true,
          alreadyCheckedIn: !!res.alreadyCheckedIn,
          rewardPoints: res.rewardPoints,
          streak: res.streak,
          pointsEarned: res.pointsEarned,
          milestone: res.milestone,
        };
      }
      return { ok: false, error: 'Could not check in right now.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const resolveRecipient = useCallback(async (identifier) => {
    try {
      const res = await apiGet(`/user/resolve/${encodeURIComponent(identifier)}`);
      if (res && res.found && res.recipient) {
        return { ok: true, recipient: res.recipient };
      }
      return { ok: false, error: 'No matching ZannyPay user.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  // ==========================================
  // Beneficiaries — master audit, Section 5: previously BeneficiariesScreen
  // read/wrote through AsyncStorage only, so a reinstall or new phone
  // silently lost every saved recipient. Now backed by the real
  // /beneficiaries endpoints, same sync-across-devices guarantee every
  // other piece of account data already has.
  // ==========================================
  const fetchBeneficiaries = useCallback(async () => {
    try {
      const res = await apiGet('/beneficiaries');
      setBeneficiaries(res || []);
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const saveBeneficiary = useCallback(async ({ accountNumber, name, bank, nickname }) => {
    try {
      const res = await apiPost('/beneficiaries', { accountNumber, name, bank, nickname });
      if (res && res.id) {
        setBeneficiaries((prev) => {
          const exists = prev.some((b) => b.id === res.id);
          return exists ? prev.map((b) => (b.id === res.id ? res : b)) : [res, ...prev];
        });
        return { ok: true, beneficiary: res };
      }
      return { ok: false, error: 'Could not save this recipient.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const updateBeneficiary = useCallback(async (id, { nickname, isFavorite }) => {
    try {
      const res = await apiPatch(`/beneficiaries/${id}`, { nickname, isFavorite });
      if (res && res.id) {
        setBeneficiaries((prev) => prev.map((b) => (b.id === id ? res : b)));
        return { ok: true, beneficiary: res };
      }
      return { ok: false, error: 'Could not update this recipient.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const removeBeneficiary = useCallback(async (id) => {
    try {
      await apiDelete(`/beneficiaries/${id}`);
      setBeneficiaries((prev) => prev.filter((b) => b.id !== id));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  // ==========================================
  // Spending budgets — per-category monthly limits, backed by the real
  // /budgets endpoints so they sync across devices/reinstalls (unlike
  // savings goals/loans, which the backend has no GET for yet).
  // ==========================================
  const setBudgetLimit = useCallback(async (category, monthlyLimit) => {
    try {
      const res = await apiPost('/budgets', { category, monthlyLimit: parseFloat(monthlyLimit) });
      if (res && res.success && res.budget) {
        setBudgets((prev) => {
          const exists = prev.some((b) => b.category === category);
          return exists ? prev.map((b) => (b.category === category ? res.budget : b)) : [...prev, res.budget];
        });
        return { ok: true, budget: res.budget };
      }
      return { ok: false, error: res?.error || 'Could not save this budget.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const removeBudget = useCallback(async (category) => {
    try {
      await apiDelete(`/budgets/${encodeURIComponent(category)}`);
      setBudgets((prev) => prev.filter((b) => b.category !== category));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  // ==========================================
  // Disputes — real backend-tied transaction disputes (previously just a
  // local confirmation alert with a TODO).
  // ==========================================
  const createDispute = useCallback(async (transactionId, reason, details) => {
    try {
      const res = await apiPost('/disputes', { transactionId, reason, details });
      if (res && res.success && res.dispute) {
        setDisputes((prev) => {
          const exists = prev.some((d) => d.id === res.dispute.id);
          return exists ? prev : [res.dispute, ...prev];
        });
        return { ok: true, dispute: res.dispute, alreadyExists: !!res.alreadyExists };
      }
      return { ok: false, error: res?.error || 'Could not file this dispute.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  // ==========================================
  // Referrals — real referral code (generated at signup) + who signed up
  // using it.
  // ==========================================
  const fetchReferrals = useCallback(async () => {
    try {
      const res = await apiGet('/referrals/me');
      if (res) {
        setReferrals({ referralCode: res.referralCode, totalReferred: res.totalReferred || 0, referred: res.referred || [] });
        return { ok: true, data: res };
      }
      return { ok: false, error: 'Could not load referral info.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await apiGet('/referrals/leaderboard');
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const activateBusiness = useCallback(async (businessName) => {
    try {
      const res = await apiPost('/business/activate', { businessName });
      // The user's own record now carries businessName/businessAccountNumber
      // (from /user/me), so refresh it — this is how the rest of the app
      // (e.g. Transfer's own-account guard) learns the new number exists.
      setUser((prev) => (prev ? { ...prev, businessName: res.businessName, businessAccountNumber: res.businessAccountNumber } : prev));
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  const fetchBusinessProfile = useCallback(async () => {
    try {
      const res = await apiGet('/business/me');
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: err.message, notActivated: err.message?.includes('not been activated') };
    }
  }, []);

  const value = {
    loading, onboarded, completeOnboarding, user, isAuthenticated, token,
    signup, login, logout, loginWithBiometricToken, balance, transactions,
    transferMoney, payBill, buyAirtime, fetchVtpassServices, fetchVtpassVariations, verifyVtpassCustomer, purchaseVtpassBill, fetchVtpassBillTransaction, fundWallet, verifyFunding, getPendingFundingAttempt, syncWallet, recordInvoice,
    savingsGoals, createSavingsGoal, depositToSavings, withdrawFromSavings, savingsApy, lastInterestEarned,
    loan, creditLimit, requestLoan, repayLoan,
    isBalanceHidden, toggleBalanceHidden,
    requestVirtualCard, toggleCardFreeze, linkExternalCard, setDefaultCard, updateCardLimits, removeCard, fetchCardActivity, cards, invoices,
    fetchInvoices, fetchInvoiceDetail, markInvoicePaid,
    createRecurringTransfer, fetchRecurringTransfers, pauseRecurringTransfer, resumeRecurringTransfer, cancelRecurringTransfer,
    budgets, setBudgetLimit, removeBudget,
    disputes, createDispute,
    referrals, fetchReferrals, fetchLeaderboard, activateBusiness, fetchBusinessProfile,
    updateProfile, changePin, resolveRecipient, dailyCheckIn,
    beneficiaries, fetchBeneficiaries, saveBeneficiary, updateBeneficiary, removeBeneficiary,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
