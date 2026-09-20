import { db, SyncQueueItem } from './db';

const MAX_RETRIES = 5;

export const SyncQueue = {
  async enqueue(
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    table: string,
    recordId: string,
    payload: any
  ): Promise<SyncQueueItem> {
    const item: SyncQueueItem = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      operation,
      table,
      recordId,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    try {
      await db.syncQueue.put(item);
    } catch (e) {
      console.error('Failed to enqueue sync task into IndexedDB', e);
    }

    return item;
  },

  async getPending(): Promise<SyncQueueItem[]> {
    try {
      return await db.syncQueue
        .where('status')
        .equals('pending')
        .toArray();
    } catch (e) {
      console.warn('Error reading pending sync items', e);
      return [];
    }
  },

  async markProcessing(id: string): Promise<void> {
    try {
      await db.syncQueue.update(id, { status: 'processing' });
    } catch (e) {
      console.warn('Error marking task processing', e);
    }
  },

  async markCompleted(id: string): Promise<void> {
    try {
      await db.syncQueue.delete(id);
    } catch (e) {
      console.warn('Error deleting completed sync task', e);
    }
  },

  async markFailed(id: string, errorMsg: string): Promise<void> {
    try {
      const existing = await db.syncQueue.get(id);
      if (existing) {
        const nextRetry = existing.retryCount + 1;
        if (nextRetry >= MAX_RETRIES) {
          // If task permanently failed MAX_RETRIES times (e.g. unauthenticated RLS), discard to prevent stuck badge
          await db.syncQueue.delete(id);
        } else {
          await db.syncQueue.update(id, {
            status: 'pending',
            retryCount: nextRetry,
            lastError: errorMsg,
          });
        }
      }
    } catch (e) {
      console.warn('Error marking task failed', e);
    }
  },

  async clearFailed(): Promise<void> {
    try {
      await db.syncQueue.where('status').equals('failed').delete();
    } catch {}
  },

  async countPending(): Promise<number> {
    try {
      return await db.syncQueue
        .where('status')
        .anyOf(['pending', 'processing'])
        .count();
    } catch {
      return 0;
    }
  },
};
