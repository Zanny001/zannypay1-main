import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiGet, apiPatch } from '../services/apiClient';

const READ_IDS_KEY = 'zannypay:notifications:readIds';

const TYPE_META = {
  kyc_approved: { icon: 'checkmark-circle', title: 'Verification approved', category: 'payments' },
  kyc_rejected: { icon: 'alert-circle', title: 'Verification update', category: 'payments' },
  dispute_resolved: { icon: 'document-text', title: 'Dispute update', category: 'payments' },
  account_frozen: { icon: 'lock-closed', title: 'Account restricted', category: 'payments' },
  account_unfrozen: { icon: 'lock-open', title: 'Account reactivated', category: 'payments' },
  chat_reply: { icon: 'chatbubble-ellipses', title: 'Support reply', category: 'messages' },
  fraud_alert: { icon: 'shield-checkmark', title: 'Security notice', category: 'payments' },
  recurring_transfer_sent: { icon: 'repeat', title: 'Recurring transfer sent', category: 'payments' },
  recurring_transfer_failed: { icon: 'alert-circle', title: 'Recurring transfer failed', category: 'payments' },
  recurring_transfer_paused: { icon: 'pause-circle', title: 'Recurring transfer paused', category: 'payments' },
  transfer_sent: { icon: 'arrow-up-circle', title: 'Money sent', category: 'payments' },
  transfer_received: { icon: 'arrow-down-circle', title: 'Money received', category: 'payments' },
  bill_paid: { icon: 'receipt', title: 'Bill payment', category: 'payments' },
  airtime_purchased: { icon: 'phone-portrait', title: 'Airtime & data', category: 'payments' },
  transaction_reversed: { icon: 'return-up-back', title: 'Transaction reversed', category: 'payments' },
  card_frozen: { icon: 'card', title: 'Card frozen', category: 'payments' },
  card_funded: { icon: 'card', title: 'Card funded', category: 'payments' },
  loan_disbursed: { icon: 'cash', title: 'Loan disbursed', category: 'payments' },
  loan_repayment_due: { icon: 'alarm', title: 'Repayment due', category: 'payments' },
};

export async function fetchServerNotifications() {
  const rows = await apiGet('/notifications');
  if (!Array.isArray(rows)) {
    throw new Error('The notifications service returned an unexpected response.');
  }
  return rows.map((n) => ({
    id: `server:${n.id}`,
    title: TYPE_META[n.type]?.title || n.title || 'ZannyPay update',
    body: n.body || 'You have a new account update.',
    icon: TYPE_META[n.type]?.icon || 'information-circle',
    category: TYPE_META[n.type]?.category || 'payments',
    timestamp: n.createdAt || null,
    serverRead: Boolean(n.isRead),
    serverId: n.id,
    type: n.type,
    metadata: n.metadata || {},
  }));
}

// Pass a list of backend notification IDs to mark only those items read.
// Omit ids (or pass null) only when an explicit mark-everything action is intended.
export async function markServerNotificationsRead(ids = null) {
  try {
    if (Array.isArray(ids)) {
      if (ids.length === 0) return true;
      await apiPatch('/notifications/read', { ids });
    } else {
      await apiPatch('/notifications/read', { all: true });
    }
    return true;
  } catch (error) {
    return false;
  }
}

export async function fetchServerUnreadCount() {
  try {
    const res = await apiGet('/notifications/unread-count');
    return Number.isFinite(Number(res?.count)) ? Number(res.count) : 0;
  } catch (e) {
    return 0;
  }
}

export function buildNotificationFeed(transactions = [], serverNotifications = []) {
  const txnNotifications = (transactions || []).slice(0, 30).map((txn) => {
    const isCredit = txn.type === 'credit';
    const isInvoice = txn.type === 'invoice';
    let title = isInvoice ? 'Invoice sent' : isCredit ? 'Money received' : 'Payment sent';
    let icon = isInvoice ? 'document-text' : isCredit ? 'arrow-down-circle' : 'arrow-up-circle';

    if (txn.category === 'Savings') {
      title = isCredit ? 'Savings withdrawal' : 'Saved to Cashbox';
      icon = 'wallet';
    }
    if (txn.category === 'Flexi Credit') {
      title = isCredit ? 'Loan disbursed' : 'Loan repayment';
      icon = 'card';
    }

    return {
      id: `txn:${txn.id}`,
      title,
      body: txn.title || 'Transaction update',
      icon,
      category: 'payments',
      timestamp: txn.createdAt || txn.date || null,
      txn,
    };
  });

  const systemNotifications = [
    {
      id: 'system:welcome',
      title: 'Welcome to ZannyPay',
      body: 'Your account is ready. Explore the services available in your wallet.',
      icon: 'sparkles',
      category: 'messages',
      timestamp: null,
    },
    {
      id: 'system:security',
      title: 'Security tip',
      body: 'Enable biometric login in Settings for faster, safer access.',
      icon: 'shield-checkmark',
      category: 'messages',
      timestamp: null,
    },
  ];

  const timestamped = [...(serverNotifications || []), ...txnNotifications].sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });

  return [...timestamped, ...systemNotifications];
}

export async function getReadIds() {
  try {
    const raw = await AsyncStorage.getItem(READ_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export async function markAllRead(ids) {
  try {
    await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify(Array.from(new Set(ids || []))));
    return true;
  } catch (e) {
    return false;
  }
}

export async function getUnreadCount(transactions) {
  const feed = buildNotificationFeed(transactions);
  const readIds = await getReadIds();
  const localUnread = feed.filter((n) => !readIds.includes(n.id)).length;
  const serverUnread = await fetchServerUnreadCount();
  return localUnread + serverUnread;
}

export async function getUnreadCountsByCategory(transactions, serverNotifications = []) {
  const feed = buildNotificationFeed(transactions, serverNotifications);
  const readIds = await getReadIds();
  const counts = { payments: 0, messages: 0 };
  for (const n of feed) {
    const isUnread = n.serverId ? !n.serverRead : !readIds.includes(n.id);
    if (isUnread) counts[n.category] = (counts[n.category] || 0) + 1;
  }
  return counts;
}
