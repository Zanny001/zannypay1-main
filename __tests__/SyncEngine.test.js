import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncEngine } from '../src/services/SyncEngine';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('SyncEngine queue safety', () => {
  beforeEach(async () => AsyncStorage.clear());

  it('persists an enqueued action', async () => {
    const id = await SyncEngine.enqueue('POST_RETRY', { endpoint: '/wallet/transfer' });
    const queue = JSON.parse(await AsyncStorage.getItem('@zannypay_sync_queue'));
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ id, type: 'POST_RETRY' });
  });

  it('does not lose items during concurrent enqueue calls', async () => {
    const ids = await Promise.all(Array.from({ length: 30 }, (_, i) =>
      SyncEngine.enqueue('POST_RETRY', { endpoint: `/parallel/${i}` })
    ));
    const queue = JSON.parse(await AsyncStorage.getItem('@zannypay_sync_queue'));
    expect(queue).toHaveLength(30);
    expect(new Set(queue.map((item) => item.id))).toEqual(new Set(ids));
  });

  it('cancels only the selected item', async () => {
    const first = await SyncEngine.enqueue('POST_RETRY', { endpoint: '/one' });
    const second = await SyncEngine.enqueue('POST_RETRY', { endpoint: '/two' });
    await SyncEngine.cancel(first);
    const queue = JSON.parse(await AsyncStorage.getItem('@zannypay_sync_queue'));
    expect(queue.map((item) => item.id)).toEqual([second]);
  });

  it('retains failed retries and removes successful retries', async () => {
    await SyncEngine.enqueue('POST_RETRY', { endpoint: '/success' });
    await SyncEngine.enqueue('POST_RETRY', { endpoint: '/retry' });
    const handler = jest.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('offline'));
    await SyncEngine.processQueue(handler);
    const queue = JSON.parse(await AsyncStorage.getItem('@zannypay_sync_queue'));
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.endpoint).toBe('/retry');
  });

  it('prevents overlapping drains from replaying the same item twice', async () => {
    await SyncEngine.enqueue('POST_RETRY', { endpoint: '/once' });
    let release;
    const handler = jest.fn(() => new Promise((resolve) => { release = resolve; }));
    const first = SyncEngine.processQueue(handler);
    const second = SyncEngine.processQueue(handler);
    for (let i = 0; i < 50 && !release; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    release();
    await Promise.all([first, second]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('preserves newly enqueued work while a replay pass is running', async () => {
    await SyncEngine.enqueue('POST_RETRY', { endpoint: '/old' });
    const handler = jest.fn(async () => {
      await SyncEngine.enqueue('POST_RETRY', { endpoint: '/new' });
      throw new Error('offline');
    });
    await SyncEngine.processQueue(handler);
    const queue = JSON.parse(await AsyncStorage.getItem('@zannypay_sync_queue'));
    expect(queue.map((item) => item.payload.endpoint).sort()).toEqual(['/new', '/old']);
  });

  it('does not resurrect a cancelled item after the replay pass', async () => {
    const id = await SyncEngine.enqueue('POST_RETRY', { endpoint: '/ussd-completed' });
    const handler = jest.fn(async () => {
      await SyncEngine.cancel(id);
      throw new Error('offline');
    });
    await SyncEngine.processQueue(handler);
    expect(JSON.parse(await AsyncStorage.getItem('@zannypay_sync_queue'))).toEqual([]);
  });
});
