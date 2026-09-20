import { StorageService } from './storage';
import { notifySyncEvent } from './realtime';
import { GameSession, SOSAlert, SOSLevel, SOSStatus } from '../types';
import { OfflineStorage } from '../offline/offlineStorage';
import { syncManager } from '../offline/syncManager';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Named thresholds as required
export const SOS_ACCURACY_THRESHOLD = 30;
export const CAUTION_ACCURACY_THRESHOLD = 50;
export const MIN_ATTEMPTS_FOR_ALERT = 3;

const ALERT_STORAGE_KEY = 'mindcare_sos_alerts';
const PREV_LEVEL_KEY_PREFIX = 'mindcare_prev_alert_level_';

// Timestamp guard to prevent audio overlapping when multiple triggers occur
let lastAlarmPlayTimestamp = 0;

/**
 * Plays a loud, piercing, high-urgency emergency alarm sound with an adjustable interval between beeps.
 * Uses dual-harmonic oscillators with dynamic range compression for maximum volume and clarity.
 * Intended EXCLUSIVELY for the Caregiver Dashboard.
 * @param times Number of beeps to play (default 3)
 * @param intervalSeconds Gap in seconds between each beep (default 5 seconds)
 */
export function playEmergencyAlarmSound(times = 3, intervalSeconds = 5): void {
  const now = Date.now();
  // Debounce guard: prevent overlapping alarm instances while an alarm sequence is active
  const sequenceDurationMs = Math.max(times * intervalSeconds * 1000, 3000);
  if (now - lastAlarmPlayTimestamp < sequenceDurationMs) {
    return;
  }
  lastAlarmPlayTimestamp = now;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Dynamics Compressor to maximize loudness without clipping or distortion
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-12, ctx.currentTime);
    compressor.knee.setValueAtTime(24, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.2, ctx.currentTime);
    compressor.connect(ctx.destination);

    // Master Gain for peak volume
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
    masterGain.connect(compressor);

    for (let i = 0; i < times; i++) {
      const startTime = ctx.currentTime + (i * intervalSeconds);
      const toneDuration = 0.75; // 750ms pulse followed by silence until next interval (2.5s)

      // Primary loud emergency siren: two-tone hi-lo warble (980 Hz -> 760 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      
      // Hi tone for first half of pulse, Lo tone for second half
      osc1.frequency.setValueAtTime(980, startTime);
      osc1.frequency.setValueAtTime(980, startTime + 0.35);
      osc1.frequency.setValueAtTime(760, startTime + 0.36);
      osc1.frequency.setValueAtTime(760, startTime + toneDuration);

      gain1.gain.setValueAtTime(0, startTime);
      gain1.gain.linearRampToValueAtTime(0.95, startTime + 0.02);
      gain1.gain.setValueAtTime(0.95, startTime + toneDuration - 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.01, startTime + toneDuration);
      gain1.gain.setValueAtTime(0, startTime + toneDuration + 0.01);

      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(startTime);
      osc1.stop(startTime + toneDuration + 0.02);

      // Resonant lower harmonic (490 Hz -> 380 Hz) for full, deep acoustic body
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';

      osc2.frequency.setValueAtTime(490, startTime);
      osc2.frequency.setValueAtTime(490, startTime + 0.35);
      osc2.frequency.setValueAtTime(380, startTime + 0.36);
      osc2.frequency.setValueAtTime(380, startTime + toneDuration);

      gain2.gain.setValueAtTime(0, startTime);
      gain2.gain.linearRampToValueAtTime(0.75, startTime + 0.02);
      gain2.gain.setValueAtTime(0.75, startTime + toneDuration - 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.01, startTime + toneDuration);
      gain2.gain.setValueAtTime(0, startTime + toneDuration + 0.01);

      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(startTime);
      osc2.stop(startTime + toneDuration + 0.02);
    }
  } catch (e) {
    // Audio restrictions handled
  }
}

export const AlertEngineService = {
  /**
   * Calculates rolling average accuracy from recent 5-10 game attempts
   */
  calculateRollingAccuracy(sessions: GameSession[]): number | null {
    if (!sessions || sessions.length < MIN_ATTEMPTS_FOR_ALERT) {
      return null;
    }
    // Take recent 5-10 attempts (slice top 10 as per adaptive engine window)
    const recentWindow = sessions.slice(0, 10);
    const sumAccuracy = recentWindow.reduce((acc, s) => acc + (s.accuracy || 0), 0);
    return Math.round((sumAccuracy / recentWindow.length) * 100) / 100;
  },

  /**
   * Determines alert level based strictly on rolling accuracy threshold
   */
  getAlertLevel(accuracy: number | null): SOSLevel {
    if (accuracy === null) {
      return 'none';
    }
    if (accuracy >= CAUTION_ACCURACY_THRESHOLD) {
      return 'none';
    }
    if (accuracy >= SOS_ACCURACY_THRESHOLD && accuracy < CAUTION_ACCURACY_THRESHOLD) {
      return 'caution';
    }
    return 'sos';
  },

  /**
   * Retrieves previous alert level for patient from localStorage
   */
  getPreviousLevel(patientId: string): SOSLevel {
    try {
      const val = localStorage.getItem(`${PREV_LEVEL_KEY_PREFIX}${patientId}`);
      return (val as SOSLevel) || 'none';
    } catch {
      return 'none';
    }
  },

  /**
   * Sets previous alert level for patient in localStorage
   */
  setPreviousLevel(patientId: string, level: SOSLevel): void {
    try {
      localStorage.setItem(`${PREV_LEVEL_KEY_PREFIX}${patientId}`, level);
    } catch (e) {
      console.error('Error persisting alert level', e);
    }
  },

  /**
   * Evaluates rolling accuracy after a game attempt is logged and triggers broadcast ONLY if level changes
   */
  checkAccuracyAlert(patientId: string = 'pat-demo-1', patientName: string = 'Meena Sharma'): SOSAlert | null {
    const sessions = StorageService.getGameSessions();
    const rollingAccuracy = this.calculateRollingAccuracy(sessions);
    const newLevel = this.getAlertLevel(rollingAccuracy);
    const prevLevel = this.getPreviousLevel(patientId);

    // Only broadcast/persist if the alert level CHANGED
    if (newLevel === prevLevel) {
      return null;
    }

    // Save updated level state
    this.setPreviousLevel(patientId, newLevel);

    if (newLevel === 'none') {
      // Broadcast level return to normal
      notifySyncEvent('accuracy_alert', {
        type: 'ACCURACY_ALERT_CHANGED',
        patientId,
        patientName,
        level: 'none',
        accuracy: rollingAccuracy,
        timestamp: Date.now(),
      });
      return null;
    }

    // Create new SOSAlert
    const alertItem: SOSAlert = {
      id: `sos-${Date.now()}`,
      patientId,
      patientName,
      type: 'SOS',
      source: 'accuracy',
      level: newLevel,
      accuracy: rollingAccuracy,
      timestamp: Date.now(),
      status: 'active',
    };

    // Save alert item to persistent storage
    this.saveAlert(alertItem);

    // Broadcast over BroadcastChannel
    notifySyncEvent('accuracy_alert', {
      type: 'ACCURACY_ALERT_CHANGED',
      patientId,
      patientName,
      level: newLevel,
      accuracy: rollingAccuracy,
      timestamp: alertItem.timestamp,
      alert: alertItem,
    });

    // Trigger Native Browser Notification for SOS
    if (newLevel === 'sos') {
      this.triggerNativeNotification(
        'SIROI — Patient SOS Alert',
        `${patientName}'s recent cognitive-game accuracy has fallen to ${rollingAccuracy}%.`
      );
    }

    return alertItem;
  },

  /**
   * Triggers a Manual SOS request from the Patient dashboard
   */
  triggerManualSOS(patientId: string = 'pat-demo-1', patientName: string = 'Meena Sharma'): SOSAlert {
    const alertItem: SOSAlert = {
      id: `sos-manual-${Date.now()}`,
      patientId,
      patientName,
      type: 'SOS',
      source: 'manual',
      level: 'sos',
      accuracy: null,
      timestamp: Date.now(),
      status: 'active',
    };

    this.saveAlert(alertItem);

    // Broadcast over BroadcastChannel
    notifySyncEvent('accuracy_alert', {
      type: 'ACCURACY_ALERT_CHANGED',
      patientId,
      patientName,
      level: 'sos',
      accuracy: null,
      timestamp: alertItem.timestamp,
      alert: alertItem,
    });

    // Native Browser Notification
    this.triggerNativeNotification(
      'SIROI — Manual SOS Help Request',
      `${patientName} has pressed the manual emergency help button.`
    );

    return alertItem;
  },

  /**
   * Helper to send browser desktop notifications if permitted
   */
  triggerNativeNotification(title: string, body: string) {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
          });
        } catch (e) {
          console.warn('Native notification failed', e);
        }
      }
    }
  },

  /**
   * Directly syncs an SOS alert to Supabase alerts table with UUID resolution
   */
  async syncAlertToSupabase(alert: SOSAlert): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
      let resolvedPatientId = alert.patientId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedPatientId);
      if (!isUuid) {
        const p = StorageService.getPatientProfile(resolvedPatientId);
        if (p?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id)) {
          resolvedPatientId = p.id;
        } else {
          // Lookup patient UUID from Supabase patients table by name
          const { data: found } = await supabase
            .from('patients')
            .select('id')
            .ilike('full_name', `%${alert.patientName}%`)
            .limit(1);
          if (found && found.length > 0) {
            resolvedPatientId = found[0].id;
          } else {
            const { data: anyPat } = await supabase.from('patients').select('id').limit(1);
            if (anyPat && anyPat.length > 0) {
              resolvedPatientId = anyPat[0].id;
            }
          }
        }
      }

      await supabase.from('alerts').upsert({
        id: alert.id,
        patient_id: resolvedPatientId,
        patient_name: alert.patientName,
        type: alert.type || 'SOS',
        source: alert.source,
        level: alert.level,
        accuracy: alert.accuracy,
        timestamp: new Date(alert.timestamp).toISOString(),
        status: alert.status,
      }, { onConflict: 'id' });
    } catch (err) {
      console.warn('Direct syncAlertToSupabase notice:', err);
    }
  },

  /**
   * Fetches latest SOS alerts directly from Supabase cloud database
   */
  async fetchAlertsFromCloud(): Promise<SOSAlert[]> {
    if (!isSupabaseConfigured()) return this.getAllAlerts();
    try {
      const { data: cloudAlerts, error } = await supabase
        .from('alerts')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (cloudAlerts && !error) {
        const mapped: SOSAlert[] = cloudAlerts.map((a: any) => ({
          id: a.id,
          patientId: a.patient_id,
          patientName: a.patient_name || 'Patient',
          type: a.type || 'SOS',
          source: a.source || 'manual',
          level: a.level || 'sos',
          accuracy: a.accuracy,
          timestamp: new Date(a.timestamp).getTime(),
          status: a.status || 'active',
        }));

        // Merge with local alerts
        const local = this.getAllAlerts();
        const map = new Map<string, SOSAlert>();
        local.forEach(a => map.set(a.id, a));
        mapped.forEach(a => map.set(a.id, a));
        const merged = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);

        try {
          localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(merged));
        } catch {}

        return merged;
      }
    } catch (e) {
      console.warn('fetchAlertsFromCloud notice', e);
    }
    return this.getAllAlerts();
  },

  /**
   * Persists an SOS alert to LocalStorage, Dexie, and Supabase Cloud
   */
  saveAlert(alert: SOSAlert): void {
    const alerts = this.getAllAlerts();
    const updated = [alert, ...alerts.filter(a => a.id !== alert.id)];
    try {
      localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving SOS alert', e);
    }

    // Save to IndexedDB (Dexie)
    OfflineStorage.saveAlert({
      id: alert.id,
      patient_id: alert.patientId,
      patient_name: alert.patientName,
      type: alert.type,
      source: alert.source,
      level: alert.level,
      accuracy: alert.accuracy,
      timestamp: alert.timestamp,
      status: alert.status,
      created_at: new Date(alert.timestamp).toISOString(),
    }).catch(() => {});

    // Direct immediate sync to Supabase Cloud
    this.syncAlertToSupabase(alert).catch(() => {});

    // Broadcast across network/devices
    notifySyncEvent('mindcare_sos_alerts', { alert, type: 'ACCURACY_ALERT_CHANGED' });

    // Trigger background cloud sync if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncManager.startSync().catch(() => {});
    }
  },

  /**
   * Retrieves all SOS alerts from LocalStorage
   */
  getAllAlerts(): SOSAlert[] {
    try {
      const item = localStorage.getItem(ALERT_STORAGE_KEY);
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  },

  /**
   * Updates an alert status (active -> acknowledged -> resolved)
   */
  updateAlertStatus(alertId: string, status: SOSStatus): void {
    const alerts = this.getAllAlerts();
    const updated = alerts.map(a => (a.id === alertId ? { ...a, status } : a));
    try {
      localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(updated));
      notifySyncEvent('mindcare_sos_alerts', {
        type: 'ACCURACY_ALERT_CHANGED',
        alertId,
        status,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error('Error updating alert status', e);
    }

    // Direct update to Supabase Cloud
    if (isSupabaseConfigured()) {
      Promise.resolve(
        supabase.from('alerts').update({
          status,
          acknowledged_at: status === 'acknowledged' ? new Date().toISOString() : undefined,
          resolved_at: status === 'resolved' ? new Date().toISOString() : undefined,
        }).eq('id', alertId)
      ).catch((e: any) => console.warn('Supabase update alert status warning', e));
    }

    // Update in IndexedDB
    OfflineStorage.updateAlertStatus(alertId, status).catch(() => {});

    // Trigger cloud sync if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncManager.startSync().catch(() => {});
    }
  },
};
