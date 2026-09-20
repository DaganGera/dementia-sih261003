// Real-time cross-device synchronization service using Supabase Realtime, BroadcastChannel, & LocalStorage events
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const CHANNEL_NAME = 'mindcare_realtime_sync_channel';

export type SyncEventType = 'UPDATE' | 'REMINDER_ADDED' | 'GAME_COMPLETED' | 'DEVICE_CONNECTED' | 'ACCURACY_ALERT_CHANGED';

export interface SyncPayload {
  key: string;
  data: any;
  timestamp: number;
  type?: SyncEventType;
}

type SyncCallback = (payload: SyncPayload) => void;

let broadcastChannel: BroadcastChannel | null = null;
let realtimeChannel: any = null;
const listeners: Set<SyncCallback> = new Set();
const processedEventIds = new Set<string>();

// 1. BroadcastChannel API for same-browser cross-tab sync (100% offline-ready)
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.onmessage = (event: MessageEvent<SyncPayload>) => {
      handleIncomingPayload(event.data);
    };
  } catch (e) {
    console.warn('BroadcastChannel creation failed', e);
  }
}

// 2. Helper to handle and dispatch incoming sync payloads across clients
function handleIncomingPayload(payload: SyncPayload) {
  if (!payload || !payload.key) return;

  const eventKey = `${payload.key}-${payload.timestamp}-${JSON.stringify(payload.data?.alert?.id || '')}`;
  if (processedEventIds.has(eventKey)) return;
  processedEventIds.add(eventKey);

  // Keep set size manageable
  if (processedEventIds.size > 200) {
    const firstItem = processedEventIds.values().next().value;
    if (firstItem) processedEventIds.delete(firstItem);
  }

  // If payload contains alert data, sync to localStorage for immediate UI refresh
  if (payload.key === 'mindcare_sos_alerts' || payload.key === 'accuracy_alert') {
    if (payload.data && payload.data.alert) {
      try {
        const currentAlertsStr = localStorage.getItem('mindcare_sos_alerts');
        const currentAlerts = currentAlertsStr ? JSON.parse(currentAlertsStr) : [];
        const exists = currentAlerts.some((a: any) => a.id === payload.data.alert.id);
        if (!exists) {
          const updated = [payload.data.alert, ...currentAlerts];
          localStorage.setItem('mindcare_sos_alerts', JSON.stringify(updated));
        } else {
          // Update existing alert status if changed
          const updated = currentAlerts.map((a: any) =>
            a.id === payload.data.alert.id ? { ...a, ...payload.data.alert } : a
          );
          localStorage.setItem('mindcare_sos_alerts', JSON.stringify(updated));
        }
      } catch (e) {
        console.error('Error updating received SOS alert in storage', e);
      }
    }
  }

  // Dispatch payload to UI listeners (Caregiver Dashboard)
  listeners.forEach((cb) => {
    try {
      cb(payload);
    } catch (e) {
      console.warn('Sync listener error', e);
    }
  });
}

// 3. Supabase Realtime Channel Subscription (Cloud Cross-Device Sync)
export function initSupabaseRealtime() {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) return;
  if (realtimeChannel) return; // Prevent duplicate channels

  try {
    realtimeChannel = (supabase as any)
      .channel('mindcare_public_realtime')
      // Direct client-to-client broadcast across all devices (Mobile to Laptop)
      .on(
        'broadcast',
        { event: 'SOS_ALERT' },
        (msg: any) => {
          const alert = msg?.payload;
          if (alert) {
            handleIncomingPayload({
              key: 'mindcare_sos_alerts',
              data: {
                alert,
                type: 'ACCURACY_ALERT_CHANGED',
              },
              timestamp: Date.now(),
              type: 'ACCURACY_ALERT_CHANGED',
            });
          }
        }
      )
      // Realtime alerts from database (Instant SOS to Caregiver)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        (change: any) => {
          const row: any = change.new || change.old;
          if (!row) return;

          const alertPayload = {
            id: row.id,
            patientId: row.patient_id,
            patientName: row.patient_name,
            type: row.type || 'SOS',
            source: row.source,
            level: row.level,
            accuracy: row.accuracy,
            timestamp: new Date(row.timestamp).getTime(),
            status: row.status,
          };

          handleIncomingPayload({
            key: 'accuracy_alert',
            data: {
              type: 'ACCURACY_ALERT_CHANGED',
              patientId: row.patient_id,
              patientName: row.patient_name,
              level: row.level,
              accuracy: row.accuracy,
              timestamp: Date.now(),
              alert: alertPayload,
            },
            timestamp: Date.now(),
            type: 'ACCURACY_ALERT_CHANGED',
          });
        }
      )
      // Realtime game attempts
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_attempts' },
        (change: any) => {
          handleIncomingPayload({
            key: 'mindcare_game_sessions',
            data: change.new,
            timestamp: Date.now(),
            type: 'GAME_COMPLETED',
          });
        }
      )
      // Realtime cognitive profiles
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cognitive_profiles' },
        (change: any) => {
          handleIncomingPayload({
            key: 'mindcare_cognitive_profile',
            data: change.new,
            timestamp: Date.now(),
            type: 'UPDATE',
          });
        }
      )
      // Realtime patient profile updates (Multi-Caregiver synchronization)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patients' },
        (change: any) => {
          handleIncomingPayload({
            key: 'mindcare_patient_profile',
            data: change.new,
            timestamp: Date.now(),
            type: 'UPDATE',
          });
        }
      )
      .subscribe((status: any) => {
        if (status === 'SUBSCRIBED') {
          console.log('⚡ Supabase Realtime connected for Caregiver Monitoring.');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('Supabase Realtime channel error, retrying...');
          setTimeout(() => {
            if (realtimeChannel) {
              supabase.removeChannel(realtimeChannel);
              realtimeChannel = null;
            }
            initSupabaseRealtime();
          }, 5000);
        }
      });
  } catch (e) {
    console.warn('Supabase Realtime subscription notice', e);
  }
}

// 4. Fallback Storage Event listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key && event.key.startsWith('mindcare_')) {
      try {
        const payload: SyncPayload = {
          key: event.key,
          data: event.newValue ? JSON.parse(event.newValue) : null,
          timestamp: Date.now(),
          type: 'UPDATE',
        };
        handleIncomingPayload(payload);
      } catch (e) {
        // Ignore parse errors
      }
    }
  });
}

// Automatically start Realtime if configured
if (typeof window !== 'undefined') {
  initSupabaseRealtime();
}

export function notifySyncEvent(key: string, data: any, type: SyncEventType = 'UPDATE') {
  const payload: SyncPayload = {
    key,
    data,
    timestamp: Date.now(),
    type,
  };

  // 1. Broadcast locally to other tabs
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch (e) {
      console.warn('Error broadcasting sync message', e);
    }
  }

  // 2. Broadcast across network/devices via Supabase Realtime channel
  if (realtimeChannel && (key === 'mindcare_sos_alerts' || key === 'accuracy_alert')) {
    try {
      const alertItem = data?.alert || data;
      realtimeChannel.send({
        type: 'broadcast',
        event: 'SOS_ALERT',
        payload: alertItem,
      });
    } catch (e) {
      console.warn('Error sending Supabase realtime broadcast', e);
    }
  }

  // 3. Trigger local listeners
  handleIncomingPayload(payload);
}

export function subscribeToSync(callback: SyncCallback): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Cleanup function for logout:
 * Unsubscribes from Realtime channels, clears listeners,
 * and resets active states without wiping user data.
 */
export function cleanupRealtimeAndBroadcast() {
  if (realtimeChannel && isSupabaseConfigured()) {
    try {
      supabase.removeChannel(realtimeChannel);
    } catch (e) {
      console.warn('Realtime channel removal notice', e);
    }
    realtimeChannel = null;
  }
  listeners.clear();
  processedEventIds.clear();
}
