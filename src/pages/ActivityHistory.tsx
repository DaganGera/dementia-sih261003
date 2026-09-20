import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import { GameSession, CognitiveCategory } from '../types';
import { useI18n } from '../i18n';
import { Clock, Filter, Trophy, Calendar, Award } from 'lucide-react';

export const ActivityHistory: React.FC = () => {
  const { t, languageProfile } = useI18n();
  const [sessions] = useState<GameSession[]>(StorageService.getGameSessions());
  const [filterCategory, setFilterCategory] = useState<CognitiveCategory | 'all'>('all');

  const filteredSessions = sessions.filter(s => {
    if (filterCategory === 'all') return true;
    return s.category === filterCategory;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 text-[#26332F]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-[#26332F]">{t('history.title')}</h1>
            <span className="text-xs font-bold px-2 py-0.5 bg-[#DDE9D9] text-[#176B61] rounded-full border border-[#B7D4CC]">
              {languageProfile.flag} {languageProfile.nativeName}
            </span>
          </div>
          <p className="text-sm text-[#66736D]">{t('history.subtitle')}</p>
        </div>

        {/* Category Filter buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-[#E4DED4] shadow-xs">
          <span className="text-xs font-bold text-[#66736D] px-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> {t('history.filter')}
          </span>
          {(['all', 'memory', 'attention', 'recall', 'recognition'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-extrabold capitalize transition cursor-pointer ${
                filterCategory === cat
                  ? 'bg-[#176B61] text-white shadow-xs'
                  : 'text-[#66736D] hover:bg-[#F4EBD7] hover:text-[#26332F]'
              }`}
            >
              {t(`cat.${cat}` as any)}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-3xl border border-[#E4DED4] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF9F4] border-b border-[#E4DED4] text-xs uppercase font-extrabold text-[#66736D] tracking-wider">
                <th className="py-4 px-6">{t('history.colDate')}</th>
                <th className="py-4 px-6">{t('history.colGame')}</th>
                <th className="py-4 px-6">{t('history.colCategory')}</th>
                <th className="py-4 px-6">{t('history.colScore')}</th>
                <th className="py-4 px-6">{t('history.colAccuracy')}</th>
                <th className="py-4 px-6">{t('history.colDuration')}</th>
                <th className="py-4 px-6">{t('history.colLevel')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4DED4]/60 text-sm font-semibold text-[#26332F]">
              {filteredSessions.map(session => (
                <tr key={session.id} className="hover:bg-[#FAF9F4] transition">
                  <td className="py-4 px-6 text-xs text-[#66736D]">
                    {new Date(session.timestamp).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-4 px-6 font-extrabold text-[#26332F]">{session.gameTitle}</td>
                  <td className="py-4 px-6">
                    <span className="text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-[#DDE9D9] text-[#176B61] border border-[#B7D4CC]">
                      {t(`cat.${session.category}` as any)}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-extrabold text-[#176B61]">{session.score} / 100</td>
                  <td className="py-4 px-6 font-extrabold">{session.accuracy}%</td>
                  <td className="py-4 px-6 text-xs text-[#66736D]">{session.timeSeconds} {t('history.seconds')}</td>
                  <td className="py-4 px-6">
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#FAF9F4] text-[#26332F] border border-[#E4DED4]">
                      {t('game.level')} {session.difficultyLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
