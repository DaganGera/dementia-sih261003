import React from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import { useI18n, SUPPORTED_LANGUAGES_LIST } from '../i18n';
import { Volume2, VolumeX, Eye, Globe, Languages, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AccessibilityControls: React.FC = () => {
  const { settings, setTextSize, toggleHighContrast, toggleVoiceGuidance } = useAccessibility();
  const { language, setLanguage, bilingualMode, toggleBilingualMode, t } = useI18n();
  const { role, switchRole } = useAuth();

  return (
    <div className="bg-[#F4EBD7] text-[#26332F] px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#E4DED4]">

      {/* ── LEFT: Utility Controls ──────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Language Selector */}
        <div className="flex items-center gap-1.5 bg-white/80 border border-[#E4DED4] rounded-xl px-2.5 py-1">
          <Globe className="w-3.5 h-3.5 text-[#176B61]" strokeWidth={2} />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-transparent text-[#26332F] text-xs font-semibold outline-none cursor-pointer"
          >
            {SUPPORTED_LANGUAGES_LIST.map((lang) => (
              <option key={lang.languageCode} value={lang.languageCode} className="bg-[#FAF9F4] text-[#26332F]">
                {lang.flag} {lang.nativeName} ({lang.state})
              </option>
            ))}
          </select>
        </div>

        {/* Bilingual Mode */}
        <button
          onClick={toggleBilingualMode}
          title="Toggle dual language display"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-semibold transition ${
            bilingualMode
              ? 'bg-[#DDE9D9] text-[#176B61] border-[#BFCFC5]'
              : 'bg-white/80 text-[#26332F]/80 border-[#E4DED4] hover:text-[#26332F]'
          }`}
        >
          <Languages className="w-3.5 h-3.5" strokeWidth={2} />
          Bilingual
        </button>

        {/* Font Size */}
        <div className="flex items-center bg-white/80 border border-[#E4DED4] rounded-xl overflow-hidden">
          {(['small', 'medium', 'large'] as const).map((size, i) => (
            <button
              key={size}
              onClick={() => setTextSize(size)}
              title={size === 'small' ? 'Standard' : size === 'medium' ? 'Large' : 'Extra Large'}
              className={`px-2.5 py-1 text-xs font-bold transition ${
                settings.textSize === size
                  ? 'bg-[#DDE9D9] text-[#176B61]'
                  : 'text-[#26332F]/70 hover:text-[#26332F]'
              }`}
              style={{ fontSize: size === 'small' ? 11 : size === 'medium' ? 12 : 13 }}
            >
              {size === 'small' ? 'A' : size === 'medium' ? 'A+' : 'A++'}
            </button>
          ))}
        </div>

        {/* High Contrast */}
        <button
          onClick={toggleHighContrast}
          title="Toggle high contrast mode"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-semibold transition ${
            settings.highContrast
              ? 'bg-[#F8E9D9] text-[#26332F] border-[#176B61]'
              : 'bg-white/80 text-[#26332F]/80 border-[#E4DED4] hover:text-[#26332F]'
          }`}
        >
          <Eye className="w-3.5 h-3.5" strokeWidth={2} />
          Contrast
        </button>

        {/* Voice Guidance */}
        <button
          onClick={toggleVoiceGuidance}
          title="Toggle voice guidance"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-semibold transition ${
            settings.voiceGuidance
              ? 'bg-[#DDE9D9] text-[#176B61] border-[#BFCFC5]'
              : 'bg-white/80 text-[#26332F]/80 border-[#E4DED4] hover:text-[#26332F]'
          }`}
        >
          {settings.voiceGuidance
            ? <Volume2 className="w-3.5 h-3.5" strokeWidth={2} />
            : <VolumeX className="w-3.5 h-3.5" strokeWidth={2} />
          }
          Voice
        </button>
      </div>

      {/* ── RIGHT: Role Switcher (Demo) ─────────────────────── */}
      <button
        onClick={() => switchRole(role === 'caregiver' ? 'elderly' : 'caregiver')}
        title="Switch view mode (demo)"
        className="flex items-center gap-1.5 px-2.5 py-1 bg-white/80 border border-[#E4DED4] text-[#26332F] hover:bg-white rounded-xl text-xs font-semibold transition"
      >
        <RefreshCw className="w-3.5 h-3.5 text-[#176B61]" strokeWidth={2} />
        {role === 'caregiver' ? 'Elderly View' : 'Caregiver View'}
      </button>

    </div>
  );
};
