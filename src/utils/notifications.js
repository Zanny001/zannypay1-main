import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiGet, apiPatch } from '../services/apiClient';

const READ_IDS_KEY = 'zannypay:notifications:readIds';

// Icon + friendly fallback title per server-driven notification type. Body
// text always comes from the backend (it already writes a full sentence),
// this only supplies the icon and a title fallback for older/unexpected types.
// `category` splits the feed the same way PalmPay's does: "Payments" for
// anything transactional or account/security-related, "Messages" for
// engagement/informational content. Every real event type today is
// transactional in nature (even a KYC decision or a freeze is about
// account/money status, not a marketing nudge) — "Messages" is currently
// only the two evergreen system notes below, but any future promotional
// notification type just needs `category: 'messages'` added here.
const TYPE_META = {
  kyc_approved: { icon: 'checkmark-circle', title: 'Verification approved', category: 'payments' },
  kyc_rejected: { icon: 'alert-circle', title: 'Verification update', category: 'payments' },
  dispute_resolved: { icon: 'document-text', title: 'Dispute update', category: 'payments' },
  account_frozen: { icon: 'lock-closed', title: 'Account restricted', category: 'payments' },
  account_unfrozen: { icon: 'lock-open', title: 'Account reactivated', category: 'payments' },
  chat_reply: { icon: 'chatbubble-ellipses', title: 'Support', category: 'payments' },
  fraud_alert: { icon: 'shield-checkmark', title: 'Security notice', category: 'payments' },
  recurring_transfer_sent: { icon: 'repeat', title: 'Recurring transfer sent', category: 'payments' },
  recurring_transfer_failed: { icon: 'alert-circle', title: 'Recurring transfer failed', category: 'payments' },
  recurring_transfer_paused: { icon: 'pause-circle', title: 'Recurring transfer paused', category: 'payments' },
  // Added alongside the backend's new call sites for these — previously a
  // transfer/bill/airtime purchase only ever reached the customer as an
  // email, never as a push or an in-app row like every other event type
  // here does.
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

// Real, backend-driven events — KYC decisions, dispute resolutions,
// account freeze/unfreeze, fraud holds, support replies. Previously these
// had no channel to the customer at all; the notification feed was built
// entirely from transaction history plus two hardcoded messages below.
export async function fetchServerNotifications() {
  try {
    const rows = await apiGet('/notifications');
    return (rows || []).map((n) => ({
      id: `server:${n.id}`,
      title: TYPE_META[n.type]?.title || n.title,
      body: n.body,
      icon: TYPE_META[n.type]?.icon || 'information-circle',
      category: TYPE_META[n.type]?.category || 'payments',
      timestamp: n.createdAt,
      serverRead: n.isRead,
      serverId: n.id,
      type: n.type,
      metadata: n.metadata,
    }));
  } catch (e) {
    // Never let a notifications-fetch failure block the rest of the app —
    // worst case, the feed just falls back to transaction-derived items.
    return [];
  }
}

export async function markServerNotificationsRead() {
  try {
    await apiPatch('/notifications/read', { all: true });
  } catch (e) {
    // best-effort
  }
}

export async function fetchServerUnreadCount() {
  try {
    const res = await apiGet('/notifications/unread-count');
    return res?.count || 0;
  } catch (e) {
    return 0;
  }
}

// Builds a notification feed from wallet transactions plus a couple of
// evergreen system messages. Kept separate from WalletContext so it can be
// reused anywhere (dashboard badge, notifications screen) without touching
// existing context code.
export function buildNotificationFeed(transactions = [], serverNotifications = []) {
  const txnNotifications = (transactions || []).slice(0, 30).map((txn) => {
    const isCredit = txn.type === 'credit';
    const isInvoice = txn.type === 'invoice';
    let title = isInvoice ? 'Invoice Sent' : isCredit ? 'Money Received' : 'Payment Sent';
    let icon = isInvoice ? 'document-text' : isCredit ? 'arrow-down-circle' : 'arrow-up-circle';

    if (txn.category === 'Savings') { title = isCredit ? 'Savings Withdrawal' : 'Saved to Cashbox'; icon = 'wallet'; }
    if (txn.category === 'Flexi Credit') { title = isCredit ? 'Loan Disbursed' : 'Loan Repayment'; icon = 'card'; }

    return {
      id: `txn:${txn.id}`,
      title,
      body: txn.title,
      icon,
      category: 'payments',
      timestamp: txn.createdAt || txn.date,
      txn,
    };
  });

  const systemNotifications = [
    {
      id: 'system:welcome',
      title: 'Welcome to ZannyPay',
      body: 'Your account is fully set up. Explore Savings, Flexi Credit, and more.',
      icon: 'sparkles',
      category: 'messages',
      timestamp: null,
    },
    {
      id: 'system:security',
      title: 'Security Tip',
      body: 'Enable biometric login in Settings for faster, safer access.',
      icon: 'shield-checkmark',
      category: 'messages',
      timestamp: null,
    },
  ];

  // Real events sort in among transaction notifications by actual time;
  // the two evergreen system messages (no timestamp) always sink to the
  // bottom, same as before.
  const timestamped = [...serverNotifications, ...txnNotifications].sort((a, b) => {
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return [...timestamped, ...systemNotifications];
}

export async function getReadIds() {
  try {
    const raw = await AsyncStorage.getItem(READ_IDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function markAllRead(ids) {
  try {
    await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify(ids));
  } catch (e) {
    // no-op — read state is a nice-to-have, never block the UI on it
  }
}

// Combines locally-tracked unread (transaction/system items) with the
// server's own unread count (real events) into one badge number — used by
// the Dashboard's single bell icon.
export async function getUnreadCount(transactions) {
  const feed = buildNotificationFeed(transactions);
  const readIds = await getReadIds();
  const localUnread = feed.filter((n) => !readIds.includes(n.id)).length;
  const serverUnread = await fetchServerUnreadCount();
  return localUnread + serverUnread;
}

// Same idea, split by category — used by the Payments/Messages tabs on the
// Notifications screen itself, each with its own badge.
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
