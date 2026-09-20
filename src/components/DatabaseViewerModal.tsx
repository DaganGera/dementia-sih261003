import React, { useState, useEffect } from 'react';
import { db } from '../offline/db';
import { syncManager } from '../offline/syncManager';
import { OfflineStorage } from '../offline/offlineStorage';
import { Database, X, RefreshCw, Layers, ShieldCheck, Trophy, Siren, BookOpen, Clock, ArrowUpDown, CheckCircle, UserCheck } from 'lucide-react';

interface DatabaseViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TableName = 'profiles' | 'patients' | 'gameAttempts' | 'alerts' | 'memories' | 'routines' | 'syncQueue';

export const DatabaseViewerModal: React.FC<DatabaseViewerModalProps> = ({ isOpen, onClose }) => {
  const [activeTable, setActiveTable] = useState<TableName>('profiles');
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<TableName, number>>({
    profiles: 0,
    patients: 0,
    gameAttempts: 0,
    alerts: 0,
    memories: 0,
    routines: 0,
    syncQueue: 0,
  });

  const handleResolveAlert = async (alertId: string) => {
    setResolvingId(alertId);
    try {
      await OfflineStorage.updateAlertStatus(alertId, 'resolved');
      await loadData();
    } finally {
      setResolvingId(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Reconcile any resolved alerts first
      await OfflineStorage.reconcileAlerts();

      // Trigger background sync to Supabase
      syncManager.startSync().catch(() => {});

      // 1. Fetch counts for all tables
      const [profilesCount, attemptsCount, alertsCount, patientsCount, memoriesCount, routinesCount, queueCount] = await Promise.all([
        db.profiles.count(),
        db.gameAttempts.count(),
        db.alerts.count(),
        db.patients.count(),
        db.memories.count(),
        db.routines.count(),
        db.syncQueue.count(),
      ]);

      setCounts({
        profiles: profilesCount,
        gameAttempts: attemptsCount,
        alerts: alertsCount,
        patients: patientsCount,
        memories: memoriesCount,
        routines: routinesCount,
        syncQueue: queueCount,
      });

      // 2. Fetch active table data
      let data: any[] = [];
      if (activeTable === 'profiles') {
        data = await db.profiles.toArray();
      } else if (activeTable === 'gameAttempts') {
        data = await db.gameAttempts.orderBy('created_at').reverse().toArray();
      } else if (activeTable === 'alerts') {
        data = await db.alerts.orderBy('timestamp').reverse().toArray();
      } else if (activeTable === 'patients') {
        data = await db.patients.toArray();
      } else if (activeTable === 'memories') {
        data = await db.memories.toArray();
      } else if (activeTable === 'routines') {
        data = await db.routines.toArray();
      } else if (activeTable === 'syncQueue') {
        data = await db.syncQueue.toArray();
      }

      setTableData(data);
    } catch (e) {
      console.error('Error loading table data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTable]);

  if (!isOpen) return null;

  const tableTabs: Array<{ id: TableName; label: string; icon: any; color: string }> = [
    { id: 'profiles', label: 'User Profiles', icon: UserCheck, color: 'text-purple-500' },
    { id: 'patients', label: 'Patients', icon: ShieldCheck, color: 'text-emerald-500' },
    { id: 'gameAttempts', label: 'Game Attempts', icon: Trophy, color: 'text-amber-500' },
    { id: 'alerts', label: 'SOS Alerts', icon: Siren, color: 'text-rose-500' },
    { id: 'memories', label: 'Memories', icon: BookOpen, color: 'text-sky-500' },
    { id: 'routines', label: 'Routines & Meds', icon: Clock, color: 'text-indigo-500' },
    { id: 'syncQueue', label: 'Sync Queue', icon: ArrowUpDown, color: 'text-teal-500' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">SIROI — Database Explorer</h2>
                <span className="bg-teal-500/20 text-teal-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-teal-500/40">
                  IndexedDB + PostgreSQL Schema
                </span>
              </div>
              <p className="text-xs text-slate-400">All input data is stored in relational stores and synced to PostgreSQL</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── TABLE TABS ─────────────────────────────────────────── */}
        <div className="bg-slate-100 px-6 py-2 flex gap-2 border-b border-slate-200 overflow-x-auto">
          {tableTabs.map((tab) => {
            const Icon = tab.icon;
            const count = counts[tab.id];
            const isActive = activeTable === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTable(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── TABLE CONTENT ──────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {tableData.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <Layers className="w-10 h-10 mx-auto opacity-40 text-slate-500" />
              <div className="text-sm font-bold text-slate-600">No records found in table "{activeTable}"</div>
              <div className="text-xs text-slate-400">Play a game or add a profile/reminder to populate rows.</div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-800 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    {Object.keys(tableData[0] || {})
                      .filter((col) => col !== 'raw_profile' && col !== 'metadata' && col !== 'medical_history')
                      .map((col) => (
                        <th key={col} className="px-4 py-3">
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                    {activeTable === 'alerts' && (
                      <th className="px-4 py-3 text-right">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {tableData.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-slate-50/80 transition">
                      {Object.entries(row)
                        .filter(([col]) => col !== 'raw_profile' && col !== 'metadata' && col !== 'medical_history')
                        .map(([col, val]: [string, any], cIdx) => (
                          <td key={cIdx} className="px-4 py-2.5 max-w-[200px] truncate">
                            {col === 'status' ? (
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                val === 'active'
                                  ? 'bg-rose-100 text-rose-800'
                                  : val === 'acknowledged'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {String(val)}
                              </span>
                            ) : col === 'level' ? (
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                val === 'sos'
                                  ? 'bg-rose-600 text-white font-black'
                                  : val === 'caution'
                                  ? 'bg-amber-500 text-white font-bold'
                                  : 'bg-slate-200 text-slate-700'
                              }`}>
                                {String(val)}
                              </span>
                            ) : col === 'accuracy' ? (
                              <span className="font-extrabold text-teal-700">{val}%</span>
                            ) : typeof val === 'object' ? (
                              JSON.stringify(val)
                            ) : (
                              String(val ?? '—')
                            )}
                          </td>
                        ))}
                      {activeTable === 'alerts' && (
                        <td className="px-4 py-2.5 text-right font-sans">
                          {row.status !== 'resolved' ? (
                            <button
                              onClick={() => handleResolveAlert(row.id)}
                              disabled={resolvingId === row.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle className="w-3 h-3" />
                              {resolvingId === row.id ? 'Resolving...' : 'Resolve'}
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Resolved
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────── */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <strong>{tableData.length}</strong> records in <code className="bg-slate-200 px-1.5 py-0.5 rounded font-bold text-slate-700">{activeTable}</code>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400">Database: Dexie IndexedDB (Offline) ↔ Supabase PostgreSQL (Cloud)</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
