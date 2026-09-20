import { RoutineItem, Reminder } from '../types';
import { OfflineStorage } from '../offline/offlineStorage';
import { StorageService } from './storage';
import { syncManager } from '../offline/syncManager';

export const RoutineService = {
  async addRoutineItem(item: Omit<RoutineItem, 'id'>, patientId?: string): Promise<RoutineItem> {
    const pid = patientId || StorageService.getActivePatientId();
    const newItem = StorageService.addRoutineItem(item, pid);
    try {
      await OfflineStorage.saveRoutine({
        id: newItem.id,
        patient_id: pid,
        title: newItem.activity,
        description: newItem.description,
        scheduled_time: newItem.time,
        repeat_pattern: 'daily',
        enabled: true,
        category: newItem.category,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Offline routine save warning', e);
    }

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncManager.startSync().catch(() => {});
    }

    return newItem;
  },

  async addReminder(reminder: Partial<Reminder> & { title: string; time: string }, patientId?: string): Promise<Reminder> {
    const pid = patientId || StorageService.getActivePatientId();
    const newRem = StorageService.addReminder(reminder, pid);
    try {
      await OfflineStorage.saveRoutine({
        id: newRem.id,
        patient_id: pid,
        title: newRem.title,
        description: newRem.description,
        scheduled_time: newRem.time,
        repeat_pattern: newRem.repeat || 'daily',
        enabled: !newRem.isCompleted,
        category: newRem.category,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Offline reminder save warning', e);
    }

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncManager.startSync().catch(() => {});
    }

    return newRem;
  },
};
