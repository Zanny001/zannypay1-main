import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@zannypay_sync_queue';

// AsyncStorage has no compare-and-swap operation. Serialize queue mutations
// so simultaneous enqueue/cancel calls cannot overwrite one another.
let queueMutation = Promise.resolve();
let inFlight = null;

function withQueueMutation(operation) {
  const next = queueMutation.then(operation, operation);
  queueMutation = next.then(() => undefined, () => undefined);
  return next;
}

async function readQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  const queue = JSON.parse(raw);
  if (!Array.isArray(queue)) throw new Error('Stored sync queue is invalid.');
  return queue;
}

async function writeQueue(queue) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function runQueue(retryHandler) {
  const snapshot = await withQueueMutation(readQueue);
  if (!snapshot.length || !retryHandler) return;

  const remaining = [];
  for (const item of snapshot) {
    try {
      await retryHandler(item);
    } catch (error) {
      if (__DEV__) console.log(
        `[SyncEngine] Retry failed for ${item.type}, keeping queued:`,
        error?.message
      );
      remaining.push(item);
    }
  }

  // Merge against the latest persisted queue. New items enqueued during the
  // network pass survive; items cancelled during the pass are not resurrected.
  await withQueueMutation(async () => {
    const stored = await readQueue();
    const snapshotIds = new Set(snapshot.map((item) => item.id));
    const storedIds = new Set(stored.map((item) => item.id));
    const merged = [
      ...remaining.filter((item) => storedIds.has(item.id)),
      ...stored.filter((item) => !snapshotIds.has(item.id)),
    ];
    await writeQueue(merged);
  });
}

export const SyncEngine = {
  // Returns the generated id so a completed USSD fallback can cancel its
  // matching queued retry and avoid sending the same transaction twice.
  enqueue: async (actionType, payload) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await withQueueMutation(async () => {
        const queue = await readQueue();
        queue.push({
          id,
          type: actionType,
          payload,
          timestamp: new Date().toISOString(),
        });
        await writeQueue(queue);
      });
      if (__DEV__) console.log(`[SyncEngine] Queued action: ${actionType} (${id})`);
    } catch (error) {
      console.error('[SyncEngine] Failed to enqueue action', error);
    }
    return id;
  },

  cancel: async (id) => {
    if (!id) return;
    try {
      await withQueueMutation(async () => {
        const queue = await readQueue();
        await writeQueue(queue.filter((item) => item.id !== id));
      });
      if (__DEV__) console.log(`[SyncEngine] Cancelled queued action ${id}`);
    } catch (error) {
      console.error('[SyncEngine] Failed to cancel action', error);
    }
  },

  processQueue: (retryHandler) => {
    if (inFlight) return inFlight;
    inFlight = runQueue(retryHandler)
      .catch((error) => {
        console.error('[SyncEngine] Failed to process queue', error);
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  },
};
