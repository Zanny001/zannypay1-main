import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@zannypay_sync_queue';

export const SyncEngine = {
  // Add a failed action to the queue. Returns the id it generated, so the
  // caller can cancel this specific item later (see `cancel` below) — this
  // matters when the same failure also offers a USSD fallback: if the user
  // dials out and completes the transaction that way, the queued retry for
  // the *same* action must be cancelled, or reconnecting later replays it
  // as a second, real transaction.
  enqueue: async (actionType, payload) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const existingQueue = await AsyncStorage.getItem(QUEUE_KEY);
      const queue = existingQueue ? JSON.parse(existingQueue) : [];

      queue.push({
        id,
        type: actionType,
        payload,
        timestamp: new Date().toISOString()
      });

      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      if (__DEV__) console.log(`[SyncEngine] Queued action: ${actionType} (${id})`);
    } catch (e) {
      console.error('[SyncEngine] Failed to enqueue action', e);
    }
    return id;
  },

  // Removes a specific queued item without waiting for connectivity to
  // return and retrying it. Use this the instant an equivalent alternative
  // (e.g. the USSD fallback) has already completed the same action, so it
  // can't also be replayed automatically later.
  cancel: async (id) => {
    if (!id) return;
    try {
      const existingQueue = await AsyncStorage.getItem(QUEUE_KEY);
      if (!existingQueue) return;
      const queue = JSON.parse(existingQueue);
      const remaining = queue.filter((item) => item.id !== id);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
      if (__DEV__) console.log(`[SyncEngine] Cancelled queued action ${id}`);
    } catch (e) {
      console.error('[SyncEngine] Failed to cancel queued action', e);
    }
  },

  // Process the queue when connection is restored. Pass a `retryHandler`
  // (e.g. one that re-fires the original apiPost call) to actually replay
  // queued requests; items that fail again stay queued for next time.
  processQueue: async (retryHandler) => {
    try {
      const existingQueue = await AsyncStorage.getItem(QUEUE_KEY);
      if (!existingQueue) return;

      const queue = JSON.parse(existingQueue);
      if (queue.length === 0) return;

      if (__DEV__) console.log(`[SyncEngine] Processing ${queue.length} queued items...`);

      if (!retryHandler) {
        // No handler provided — nothing to safely retry, leave the queue intact.
        return;
      }

      const remaining = [];
      for (const item of queue) {
        try {
          await retryHandler(item);
        } catch (e) {
          if (__DEV__) console.log(`[SyncEngine] Retry failed for ${item.type}, keeping queued:`, e.message);
          remaining.push(item);
        }
      }

      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
      if (__DEV__) console.log(`[SyncEngine] Queue processed. ${remaining.length} item(s) still pending.`);
    } catch (e) {
      console.error('[SyncEngine] Failed to process queue', e);
    }
  }
};
