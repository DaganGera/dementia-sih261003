import React, { useState, useEffect, useCallback } from 'react';
import { StorageService } from '../services/storage';
import { Reminder } from '../types';
import { useI18n } from '../i18n';
import { TextToSpeechService } from '../services/textToSpeech';
import { Bell, Plus, CheckCircle2, Clock, Trash2, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { subscribeToSync } from '../services/realtime';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { generateUUID } from '../utils/uuid';

function formatPostgresTimeToDisplay(timeStr: string): string {
  if (!timeStr) return '08:00 AM';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const modifier = hours >= 12 ? 'PM' : 'AM';
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    const hh = hours.toString().padStart(2, '0');
    return `${hh}:${minutes} ${modifier}`;
  }
  return timeStr;
}

function convertToPostgresTime(timeStr: string): string {
  if (!timeStr) return '08:00:00';
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const modifier = match[3] ? match[3].toUpperCase() : 'AM';
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
  }
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr.trim())) {
    return timeStr.trim().length === 5 ? `${timeStr.trim()}:00` : timeStr.trim();
  }
  return '08:00:00';
}

export const Reminders: React.FC = () => {
  const { user, role } = useAuth();
  const { t, language, languageProfile } = useI18n();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  const activePatientId =
    StorageService.getActivePatientId(user?.id) ||
    (user?.id && user.role !== 'caregiver' ? user.id : undefined);

  // New Reminder form fields
  const [title, setTitle] = useState<string>('');
  const [time, setTime] = useState<string>('08:00 AM');
  const [category, setCategory] = useState<'activity' | 'routine' | 'visit' | 'medication' | 'general'>('routine');
  const [repeat, setRepeat] = useState<'daily' | 'weekly' | 'once'>('daily');

  const loadReminders = useCallback(async () => {
    try {
      const pid = activePatientId;
      let cloudLoaded = false;

      // 1. Fetch from Supabase routines table (authoritative source of truth)
      if (isSupabaseConfigured() && pid && pid !== 'pat-demo-1') {
        try {
          const { data: cloudRoutines, error } = await supabase
            .from('routines')
            .select('*')
            .eq('patient_id', pid)
            .order('scheduled_time', { ascending: true });

          if (!error && cloudRoutines) {
            const list: Reminder[] = cloudRoutines.map(r => ({
              id: r.id,
              title: r.title,
              time: formatPostgresTimeToDisplay(r.scheduled_time),
              category: (r.description && r.description.startsWith('Category: ')
                ? r.description.replace('Category: ', '')
                : 'routine') as any,
              repeat: r.repeat_pattern || 'daily',
              description: r.description || '',
              isCompleted: !r.enabled,
              createdAt: r.created_at,
            }));

            // Filter out any demo placeholders
            const cleaned = list.filter(
              r => r.id !== 'rem-1' && r.id !== 'rem-2' && r.id !== 'rem-3' &&
                   r.title !== 'Breakfast & Morning Routine' &&
                   r.title !== 'Daily Brain Exercise Game' &&
                   r.title !== 'Daughter Anitha Visit'
            );

            // Cleanse and overwrite local patient cache with authoritative cloud routines
            StorageService.savePatientReminders(cleaned, pid);
            setReminders(cleaned);
            cloudLoaded = true;
          }
        } catch (cloudErr) {
          console.warn('Cloud routines fetch error:', cloudErr);
        }
      }

      // 2. Offline fallback (or demo patient)
      if (!cloudLoaded) {
        const localReminders = StorageService.getReminders(pid);
        const cleaned = (localReminders || []).filter(
          r => r.id !== 'rem-1' && r.id !== 'rem-2' && r.id !== 'rem-3' &&
               r.title !== 'Breakfast & Morning Routine' &&
               r.title !== 'Daily Brain Exercise Game' &&
               r.title !== 'Daughter Anitha Visit'
        );
        setReminders(cleaned);
      }
    } finally {
      setLoading(false);
    }
  }, [activePatientId]);

  useEffect(() => {
    loadReminders();
    const unsub = subscribeToSync(() => loadReminders());
    return () => unsub();
  }, [loadReminders]);

  const handleToggle = async (id: string) => {
    const current = reminders.find(r => r.id === id);
    if (!current) return;
    const newStatus = !current.isCompleted;

    setReminders(prev => prev.map(r => r.id === id ? { ...r, isCompleted: newStatus } : r));

    const pid = activePatientId;
    StorageService.toggleReminder(id, pid);

    if (isSupabaseConfigured() && pid && pid !== 'pat-demo-1') {
      try {
        await supabase
          .from('routines')
          .update({ enabled: !newStatus, updated_at: new Date().toISOString() })
          .eq('id', id);
      } catch (e) {
        console.warn('Supabase routine toggle notice:', e);
      }
    }
  };

  const handleDelete = async (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));

    const pid = activePatientId;
    StorageService.deleteReminder(id, pid);

    if (isSupabaseConfigured() && pid && pid !== 'pat-demo-1') {
      try {
        await supabase.from('routines').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase routine delete notice:', e);
      }
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const pid = activePatientId;
    const newUuid = generateUUID();
    const formattedTime = convertToPostgresTime(time);

    // Save to Supabase cloud table
    if (isSupabaseConfigured() && pid && pid !== 'pat-demo-1') {
      try {
        await supabase.from('routines').upsert({
          id: newUuid,
          patient_id: pid,
          title: title.trim(),
          description: `Category: ${category}`,
          scheduled_time: formattedTime,
          repeat_pattern: repeat,
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      } catch (e) {
        console.warn('Supabase add reminder notice:', e);
      }
    }

    // Save to local storage
    StorageService.addReminder({
      id: newUuid,
      title: title.trim(),
      time,
      category,
      repeat,
    }, pid);

    const alertText = language === 'as'
      ? `নতুন সোঁৱৰণী সংৰক্ষণ কৰা হ’ল: ${title} (${time})`
      : language === 'bn'
      ? `নতুন অনুস্মারক যুক্ত হয়েছে: ${title} (${time})`
      : `New reminder set: ${title} at ${time}`;

    TextToSpeechService.speak(alertText, language);
    setTitle('');
    setShowAddModal(false);
    await loadReminders();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 text-[#26332F]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-[#26332F]">{t('reminders.title')}</h1>
            <span className="text-xs font-bold px-2 py-0.5 bg-[#DDE9D9] text-[#176B61] rounded-full border border-[#B7D4CC]">
              {languageProfile.flag} {languageProfile.nativeName}
            </span>
          </div>
          <p className="text-sm text-[#66736D]">{t('reminders.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-sm rounded-2xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-5 h-5" /> {t('reminders.add')}
        </button>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center justify-center p-8 text-[#176B61] font-semibold gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading daily reminders...
        </div>
      )}

      {/* Reminders List */}
      {!loading && (
        <div className="space-y-3">
          {reminders.length === 0 && (
            <div className="p-10 bg-white border border-[#E4DED4] rounded-3xl text-center space-y-3 shadow-xs">
              <div className="w-14 h-14 bg-[#DDE9D9] text-[#176B61] rounded-2xl flex items-center justify-center mx-auto border border-[#B7D4CC]">
                <Clock className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#26332F]">
                  {t('reminders.empty') || 'No Reminders Scheduled'}
                </h3>
                <p className="text-xs text-[#66736D] max-w-sm mx-auto mt-1">
                  Daily routine checkpoints and medications configured by your caregiver will appear here automatically.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#176B61] hover:text-[#12564E] bg-[#F4EBD7] px-3 py-1.5 rounded-xl border border-[#E4DED4] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Checkpoint
              </button>
            </div>
          )}

          {reminders.map(rem => (
            <div
              key={rem.id}
              className={`p-5 rounded-3xl border transition flex items-center justify-between shadow-xs ${
                rem.isCompleted
                  ? 'bg-[#FAF9F4] border-[#E4DED4] opacity-70'
                  : 'bg-white border-[#E4DED4] hover:border-[#176B61]/60'
              }`}
            >
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleToggle(rem.id)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition border-2 cursor-pointer ${
                    rem.isCompleted
                      ? 'bg-[#DDE9D9] border-[#176B61] text-[#176B61]'
                      : 'border-[#DDD9D0] hover:border-[#176B61] text-transparent'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5 stroke-[3]" />
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className={`text-lg font-extrabold ${rem.isCompleted ? 'line-through text-[#66736D]' : 'text-[#26332F]'}`}>
                      {rem.title}
                    </h4>
                    <span className="text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-[#F8E9D9] text-[#26332F] border border-[#DFB994]/60">
                      {rem.category}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#66736D] mt-1 flex items-center gap-2">
                    <span className="flex items-center gap-1 font-mono font-bold text-[#176B61]">
                      <Clock className="w-3.5 h-3.5" /> {rem.time}
                    </span>
                    <span>• {rem.repeat}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDelete(rem.id)}
                className="text-[#66736D] hover:text-[#D9A7A8] p-2 transition cursor-pointer"
                title="Delete Reminder"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Reminder Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#26332F]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E4DED4] shadow-2xl space-y-4">
            <h3 className="text-xl font-extrabold text-[#26332F]">{t('reminders.createTitle')}</h3>

            <form onSubmit={handleCreateReminder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#26332F] mb-1">{t('reminders.inputTitle')}</label>
                <input
                  type="text"
                  placeholder={t('reminders.inputTitlePlaceholder')}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none text-[#26332F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#26332F] mb-1">{t('reminders.time')}</label>
                  <input
                    type="text"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none text-[#26332F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#26332F] mb-1">{t('reminders.category')}</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none text-[#26332F] cursor-pointer"
                  >
                    <option value="routine">Routine</option>
                    <option value="activity">Activity</option>
                    <option value="visit">Family Visit</option>
                    <option value="medication">Medication</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#26332F] mb-1">{t('reminders.repeat')}</label>
                <select
                  value={repeat}
                  onChange={e => setRepeat(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none text-[#26332F] cursor-pointer"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="once">Once</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-sm rounded-xl shadow-xs transition cursor-pointer"
                >
                  {t('reminders.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-3 bg-[#F4EBD7] hover:bg-[#ecdcb9] text-[#26332F] font-bold text-sm rounded-xl transition border border-[#E4DED4] cursor-pointer"
                >
                  {t('reminders.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
