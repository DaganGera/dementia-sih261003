import React, { useState } from 'react';
import { Database, KeyRound, ExternalLink, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';
import { getSupabaseUrl, getSupabaseAnonKey, saveRuntimeSupabaseCredentials } from '../lib/supabase';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavedAndContinue?: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onSavedAndContinue,
}) => {
  const [url, setUrl] = useState<string>(getSupabaseUrl() || '');
  const [anonKey, setAnonKey] = useState<string>(getSupabaseAnonKey() || '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim().startsWith('http')) {
      setError('Please enter a valid Supabase Project URL starting with https://');
      return;
    }
    if (anonKey.trim().length < 20) {
      setError('Please enter a valid Supabase Anon Public Key (starts with ey...)');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      saveRuntimeSupabaseCredentials(url.trim(), anonKey.trim());
      setSaving(false);
      onClose();
      if (onSavedAndContinue) {
        onSavedAndContinue();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save Supabase credentials');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 animate-in fade-in">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 border border-teal-200">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">Connect Supabase Cloud</h3>
              <p className="text-xs text-slate-500 font-medium">Required for Real-time Auth & Google OAuth</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Why this is required */}
        <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-950 space-y-1.5">
          <p className="font-bold flex items-center gap-1.5 text-sky-900">
            <AlertCircle className="w-4 h-4 text-sky-600 shrink-0" />
            Why is Supabase configuration needed?
          </p>
          <p className="leading-relaxed text-sky-800">
            Google OAuth requires a live Supabase backend to exchange tokens with Google's servers. 
            Once you provide your project URL and Anon Key, your Google sign-in button will redirect directly to Google's sign-in screen!
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl font-semibold">
            {error}
          </div>
        )}

        {/* Form to paste credentials */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Supabase Project URL *
            </label>
            <div className="relative">
              <Database className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://abcdefghijklm.supabase.co"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Supabase Anon Public Key *
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <textarea
                rows={2}
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                required
              />
            </div>
          </div>

          {/* Quick steps instructions */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="font-extrabold text-slate-800 flex items-center justify-between">
              <span>Where do I find these in Supabase?</span>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-teal-700 hover:underline inline-flex items-center gap-1 font-bold text-[11px]"
              >
                Open Supabase <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600">
              <li>Open your project at <strong>supabase.com/dashboard</strong></li>
              <li>Go to <strong>Project Settings</strong> (gear icon) $\rightarrow$ <strong>API</strong></li>
              <li>Copy <strong>Project URL</strong> and <strong>Project API Key (`anon` `public`)</strong></li>
              <li>Under <strong>Authentication</strong> $\rightarrow$ <strong>Providers</strong> $\rightarrow$ Enable <strong>Google</strong></li>
            </ol>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-2 py-3 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? 'Saving...' : 'Connect & Continue with Google'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
