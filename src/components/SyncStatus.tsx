import React, { useState, useEffect } from 'react';
import { syncManager, SyncStatusInfo } from '../offline/syncManager';
import { useAuth } from '../context/AuthContext';
import { db } from '../offline/db';
import { DatabaseViewerModal } from './DatabaseViewerModal';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle, Database, ChevronDown, ChevronUp, TableProperties } from 'lucide-react';

export const SyncStatus: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<SyncStatusInfo>(() => syncManager.getStatus());
  const [showDebug, setShowDebug] = useState(false);
  const [showViewerModal, setShowViewerModal] = useState(false);
  const [dbCounts, setDbCounts] = useState<{
    attempts: number;
    alerts: number;
    routines: number;
    memories: number;
  }>({ attempts: 0, alerts: 0, routines: 0, memories: 0 });

  useEffect(() => {
    const unsub = syncManager.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    const updateCounts = async () => {
      try {
        const attempts = await db.gameAttempts.count();
        const alerts = await db.alerts.count();
        const routines = await db.routines.count();
        const memories = await db.memories.count();
        setDbCounts({ attempts, alerts, routines, memories });
      } catch {
        // Ignore count errors
      }
    };

    updateCounts();
    const interval = setInterval(updateCounts, 5000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = () => {
    syncManager.startSync();
  };

  return (
    <div className="text-xs">
      {/* ── ELDERLY-FRIENDLY STATUS INDICATOR PILL ─────────────────── */}
      <div className="flex items-center gap-2">
        {status.state === 'offline' ? (
          <div
            title="Your activities are saved safely on this device and will sync when internet returns."
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F4E4C8] text-[#26332F] border border-[#E4DED4] font-bold"
          >
            <WifiOff className="w-3.5 h-3.5 text-[#176B61] animate-pulse" />
            <span>Offline Mode (Saved Locally)</span>
          </div>
        ) : status.state === 'syncing' ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DCEEEF] text-[#26332F] border border-[#B7D4CC] font-bold">
            <RefreshCw className="w-3.5 h-3.5 text-[#176B61] animate-spin" />
            <span>Syncing activities...</span>
          </div>
        ) : status.pendingCount > 0 ? (
          <button
            onClick={handleManualSync}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F8E9D9] text-[#26332F] border border-[#E4DED4] font-bold hover:bg-[#F4EBD7] transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#176B61]" />
            <span>{status.pendingCount} pending sync</span>
          </button>
        ) : (
          <button
            onClick={handleManualSync}
            title="Click to force sync with Supabase"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DDE9D9] text-[#26332F] border border-[#BFCFC5] font-bold hover:bg-[#B9CDB3] transition cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#176B61]" />
            <span>{status.isCloudConfigured ? 'Connected & Synced (Click to Sync)' : 'Offline Database Active'}</span>
          </button>
        )}

        {/* Secret / Dev debug panel toggle */}
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="p-1 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
          title="Toggle Technical Diagnostics (Dev Only)"
        >
          {showDebug ? <ChevronUp className="w-3.5 h-3.5" /> : <Database className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ── DEVELOPER DIAGNOSTICS ACCORDION ────────────────────────── */}
      {showDebug && (
        <div className="fixed bottom-16 right-4 z-50 bg-slate-900 text-slate-100 p-4 rounded-2xl shadow-2xl border border-slate-700 max-w-xs w-full text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
            <span className="font-extrabold text-teal-400 flex items-center gap-1.5">
              <Database className="w-4 h-4" /> System Sync Diagnostics
            </span>
            <button
              onClick={() => setShowDebug(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Network:</span>
              <span className={status.state === 'offline' ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                {typeof navigator !== 'undefined' && navigator.onLine ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Cloud Config:</span>
              <span className={status.isCloudConfigured ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                {status.isCloudConfigured ? 'Supabase Connected' : 'Local Fallback'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Pending Sync Tasks:</span>
              <span className="text-amber-300 font-bold">{status.pendingCount}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">IndexedDB Attempts:</span>
              <span className="text-slate-200">{dbCounts.attempts}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">IndexedDB Alerts:</span>
              <span className="text-slate-200">{dbCounts.alerts}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Active User:</span>
              <span className="text-teal-300 truncate max-w-[130px]">{user?.email || 'Demo Session'}</span>
            </div>

            {status.lastSyncTime && (
              <div className="flex justify-between">
                <span className="text-slate-400">Last Sync:</span>
                <span className="text-slate-300">
                  {new Date(status.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            )}

            {status.lastError && (
              <div className="text-rose-400 text-[10px] mt-1 pt-1 border-t border-slate-800">
                Notice: {status.lastError}
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <button
              onClick={() => {
                setShowDebug(false);
                setShowViewerModal(true);
              }}
              className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white font-extrabold rounded-xl transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
            >
              <TableProperties className="w-4 h-4 text-teal-200" />
              <span>Inspect Database Tables</span>
            </button>

            <button
              onClick={handleManualSync}
              className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer text-[11px]"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Trigger Cloud Sync
            </button>
          </div>
        </div>
      )}

      {/* ── VISUAL DATABASE TABLE VIEWER MODAL ───────────────────────── */}
      <DatabaseViewerModal
        isOpen={showViewerModal}
        onClose={() => setShowViewerModal(false)}
      />
    </div>
  );
};

export default SyncStatus;
