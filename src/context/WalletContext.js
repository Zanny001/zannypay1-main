import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { saveJSON, loadJSON } from '../utils/storage';
import { apiGet, apiPost, apiPatch, apiDelete, getSavedToken, saveToken, clearToken } from '../services/apiClient';
import { logLoginActivity } from '../utils/loginActivity';
import { SyncEngine } from '../services/SyncEngine';
import { BiometricAuth } from '../services/biometricAuth';

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
};

const SAVINGS_APY = 0.15;
const STARTING_BALANCE = 0;
const BASE_CREDIT_LIMIT = 50000;

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
  const [savingsApy, setSavingsApy] = useState(SAVINGS_APY);
  const [loan, setLoan] = useState(null);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [serverCreditLimit, setServerCreditLimit] = useState(null);
  const [cards, setCards] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [referrals, setReferrals] = useState({ referralCode: null, totalReferred: 0, referred: [] });

  const localInvoicesRef = useRef([]);

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
    // An explicit logout means fully logged out — the biometric
    // convenience credential goes with it, not just the active session.
    if (user?.phone) await BiometricAuth.clearFor(user.phone);
  }, [user]);

  const transferMoney = useCallback(async ({ recipientAccount, amount, pin, bank, note, recipientName }) => {
    try {
      const payload = { recipientAccount, amount: parseFloat(amount), pin, bank, note, recipientName };
      const res = await apiPost('/wallet/transfer', payload, { type: 'transfer', amount, account: recipientAccount });
      if (res && res.success) {
        const data = await syncWallet();
        const txn = data?.transactions?.find((t) => t.id === res.transactionId) || null;
        return { ok: true, txn, transactionId: res.transactionId };
      }
      return { ok: false, error: res?.error || 'Transfer was rejected.' };
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

  const fundWallet = useCallback(async (amount) => {
    try {
      const res = await apiPost('/wallet/fund', { amount: parseFloat(amount) });
      if (res && res.success) {
        return { ok: true, authorizationUrl: res.authorizationUrl, reference: res.reference };
      }
      return { ok: false, error: res?.error || 'Funding request failed.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  // Fallback confirmation for Paystack funding — webhooks can be slow,
  // unconfigured in dev, or never reach an unpublished backend at all, so
  // this asks Paystack directly (via the backend) whether the payment went
  // through, right after the checkout browser session returns.
  const verifyFunding = useCallback(async (reference) => {
    try {
      const res = await apiGet(`/wallet/verify/${reference}`);
      return { ok: !!res?.success, status: res?.status || 'pending' };
    } catch (err) {
      return { ok: false, status: 'pending', error: err.message };
    }
  }, []);

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

  const requestVirtualCard = useCallback(async () => {
    try {
      const res = await apiPost('/cards/request');
      if (res && res.cardNumber) {
        await syncWallet();
        return { ok: true };
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

  const totalCredits = useMemo(() => {
    return (transactions || []).filter((t) => t.type === 'credit').reduce((sum, t) => sum + Math.abs(toNumber(t.amount)), 0);
  }, [transactions]);

  const computedCreditLimit = useMemo(() => {
    const computed = BASE_CREDIT_LIMIT + totalCredits * 0.15;
    return Math.min(Math.round(computed / 1000) * 1000, 1000000);
  }, [totalCredits]);

  const creditLimit = serverCreditLimit !== null ? serverCreditLimit : computedCreditLimit;

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
    transferMoney, payBill, buyAirtime, fundWallet, verifyFunding, syncWallet, recordInvoice,
    savingsGoals, createSavingsGoal, depositToSavings, withdrawFromSavings, savingsApy,
    loan, creditLimit, requestLoan, repayLoan,
    isBalanceHidden, toggleBalanceHidden,
    requestVirtualCard, toggleCardFreeze, cards, invoices,
    budgets, setBudgetLimit, removeBudget,
    disputes, createDispute,
    referrals, fetchReferrals, fetchLeaderboard, activateBusiness, fetchBusinessProfile,
    updateProfile, changePin, resolveRecipient, dailyCheckIn,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
