import { SOSAlert, SOSLevel, SOSSource, SOSStatus } from '../types';
import { OfflineStorage } from '../offline/offlineStorage';
import { AlertEngineService } from './alertEngine';
import { syncManager } from '../offline/syncManager';
import { notifySyncEvent } from './realtime';

export const AlertService = {
  /**
   * Triggers an emergency SOS (accuracy or manual) with immediate local-first IndexedDB persistence
   */
  async triggerAlert(
    source: SOSSource,
    level: SOSLevel,
    accuracy: number | null,
    patientId: string = 'pat-demo-1',
    patientName: string = 'Meena Sharma'
  ): Promise<SOSAlert> {
    const alertItem: SOSAlert = {
      id: `sos-${source}-${Date.now()}`,
      patientId,
      patientName,
      type: 'SOS',
      source,
      level,
      accuracy,
      timestamp: Date.now(),
      status: 'active',
    };

    // 1. Save to IndexedDB immediately
    try {
      await OfflineStorage.saveAlert({
        id: alertItem.id,
        patient_id: alertItem.patientId,
        patient_name: alertItem.patientName,
        type: alertItem.type,
        source: alertItem.source,
        level: alertItem.level,
        accuracy: alertItem.accuracy,
        timestamp: alertItem.timestamp,
        status: alertItem.status,
        created_at: new Date(alertItem.timestamp).toISOString(),
      });
    } catch (e) {
      console.warn('Offline alert save warning', e);
    }

    // 2. Synchronize with existing AlertEngineService
    AlertEngineService.saveAlert(alertItem);

    // 3. Broadcast to Realtime & Local Tabs
    notifySyncEvent('accuracy_alert', {
      type: 'ACCURACY_ALERT_CHANGED',
      patientId,
      patientName,
      level,
      accuracy,
      timestamp: alertItem.timestamp,
      alert: alertItem,
    });

    // 4. Trigger cloud sync if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncManager.startSync().catch(() => {});
    }

    return alertItem;
  },

  async updateStatus(alertId: string, newStatus: SOSStatus): Promise<void> {
    try {
      await OfflineStorage.updateAlertStatus(alertId, newStatus);
    } catch (e) {
      console.warn('Offline alert status update warning', e);
    }

    AlertEngineService.updateAlertStatus(alertId, newStatus);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncManager.startSync().catch(() => {});
    }
  },

  async getAllAlerts(patientId?: string): Promise<SOSAlert[]> {
    try {
      const local = await OfflineStorage.getAlerts(patientId);
      if (local.length > 0) {
        return local.map((a) => ({
          id: a.id,
          patientId: a.patient_id,
          patientName: a.patient_name,
          type: a.type,
          source: a.source,
          level: a.level,
          accuracy: a.accuracy,
          timestamp: a.timestamp,
          status: a.status,
        }));
      }
    } catch {
      // Fallback
    }
    return AlertEngineService.getAllAlerts();
  },
};
