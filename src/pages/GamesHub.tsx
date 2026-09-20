import React, { useState } from 'react';
import { MemoryMatch } from '../games/MemoryMatch';
import { SequenceRecall } from '../games/SequenceRecall';
import { ObjectRecall } from '../games/ObjectRecall';
import { NameFaceMemory } from '../games/NameFaceMemory';
import { StoryRecall } from '../games/StoryRecall';
import { FamiliarPlacesGame } from '../games/FamiliarPlacesGame';
import { NumberMemory } from '../games/NumberMemory';
import { VoiceRecall } from '../games/VoiceRecall';
import { FamiliarSounds } from '../games/FamiliarSounds';

import { StorageService } from '../services/storage';
import { GameType, CognitiveCategory } from '../types';
import { useI18n } from '../i18n';
import {
  Play,
  Puzzle,
  Sparkles,
  User,
  MapPin,
  Binary,
  Mic,
  Eye,
  BookOpen,
  Music,
} from 'lucide-react';
import { SiroiLilyLogo } from '../components/SiroiBotanical';

interface GamesHubProps {
  initialGameId?: string | null;
}

export const GamesHub: React.FC<GamesHubProps> = ({ initialGameId }) => {
  const { t, languageProfile } = useI18n();
  const [activeGame, setActiveGame] = useState<GameType | null>((initialGameId as GameType) || null);
  const [selectedCategory, setSelectedCategory] = useState<CognitiveCategory | 'all'>('all');

  const sessions = StorageService.getGameSessions();

  const getGameStats = (gameId: GameType) => {
    const gameSessions = sessions.filter(s => s.gameId === gameId);
    if (gameSessions.length === 0) return { bestScore: '-', lastScore: '-', level: 1 };
    const bestScore = Math.max(...gameSessions.map(s => s.accuracy));
    const lastScore = gameSessions[0].accuracy;
    const level = gameSessions[0].difficultyLevel || 1;
    return { bestScore: `${bestScore}%`, lastScore: `${lastScore}%`, level };
  };

  const gamesList: Array<{
    id: GameType;
    titleKey: any;
    descKey: any;
    category: CognitiveCategory;
    catKey: any;
    renderIcon: (className: string) => React.ReactNode;
    cardBg: string;
    cardBorder: string;
    titleColor: string;
    descColor: string;
    iconColor: string;
    badgeBg: string;
    statsBg: string;
    statsLabel: string;
    statsValue: string;
    btnBg: string;
    time: string;
  }> = [
    // 1. Memory Match - Sage Green
    {
      id: 'memory-match',
      titleKey: 'games.memoryMatch',
      descKey: 'games.memoryMatchDesc',
      category: 'memory',
      catKey: 'cat.memory',
      renderIcon: (cls) => <Puzzle className={cls} />,
      cardBg: 'bg-[#D6E3D3]',
      cardBorder: 'border-[#C2D3BE]',
      titleColor: 'text-[#263D24]',
      descColor: 'text-[#3E523A]',
      iconColor: 'text-[#365432]',
      badgeBg: 'bg-[#E8EFE6] text-[#365432] border border-[#C5D5C1]',
      statsBg: 'bg-[#E3EDE0]/80 border border-[#C4D5C1]',
      statsLabel: 'text-[#4F634D]',
      statsValue: 'text-[#263D24]',
      btnBg: 'bg-[#F5EFE6] hover:bg-[#EAE2D5] text-[#3E3027] border border-[#DDD0BF]',
      time: '3 min',
    },
    // 2. Remember the Sequence - Warm Apricot Peach
    {
      id: 'sequence-recall',
      titleKey: 'games.sequence',
      descKey: 'games.sequenceDesc',
      category: 'attention',
      catKey: 'cat.attention',
      renderIcon: (cls) => <Sparkles className={cls} />,
      cardBg: 'bg-[#F1D4C1]',
      cardBorder: 'border-[#E3C0AB]',
      titleColor: 'text-[#451E0E]',
      descColor: 'text-[#5E3423]',
      iconColor: 'text-[#8A4222]',
      badgeBg: 'bg-[#F9E8DE] text-[#8A4222] border border-[#E3C0AB]',
      statsBg: 'bg-[#F5DECFA]/80 border border-[#E2BFAB]',
      statsLabel: 'text-[#774833]',
      statsValue: 'text-[#451E0E]',
      btnBg: 'bg-[#F5EFE6] hover:bg-[#EAE2D5] text-[#3E3027] border border-[#DDD0BF]',
      time: '3 min',
    },
    // 3. Who is This? - Soft Dusty Rose Mauve
    {
      id: 'name-face',
      titleKey: 'games.whoIsThis',
      descKey: 'games.whoIsThisDesc',
      category: 'recognition',
      catKey: 'cat.recognition',
      renderIcon: (cls) => <User className={cls} />,
      cardBg: 'bg-[#DDB4BD]',
      cardBorder: 'border-[#CBA0AB]',
      titleColor: 'text-[#3F141E]',
      descColor: 'text-[#56242F]',
      iconColor: 'text-[#662936]',
      badgeBg: 'bg-[#F0D5DB] text-[#662936] border border-[#D9AFB9]',
      statsBg: 'bg-[#E8C2CA]/80 border border-[#D1A6B0]',
      statsLabel: 'text-[#743B48]',
      statsValue: 'text-[#3F141E]',
      btnBg: 'bg-[#F5EFE6] hover:bg-[#EAE2D5] text-[#3E3027] border border-[#DDD0BF]',
      time: '3 min',
    },
    // 4. Familiar Places - Soft Periwinkle Lavender Blue
    {
      id: 'familiar-places',
      titleKey: 'games.familiarPlaces',
      descKey: 'games.familiarPlacesDesc',
      category: 'familiarity',
      catKey: 'cat.familiarity',
      renderIcon: (cls) => <MapPin className={cls} />,
      cardBg: 'bg-[#CCD3EE]',
      cardBorder: 'border-[#B6BFE2]',
      titleColor: 'text-[#1C2448]',
      descColor: 'text-[#313B65]',
      iconColor: 'text-[#2E3A68]',
      badgeBg: 'bg-[#E5E9F8] text-[#2E3A68] border border-[#BFC8E8]',
      statsBg: 'bg-[#D8DDF2]/80 border border-[#BDC6E6]',
      statsLabel: 'text-[#4B578A]',
      statsValue: 'text-[#1C2448]',
      btnBg: 'bg-[#F5EFE6] hover:bg-[#EAE2D5] text-[#3E3027] border border-[#DDD0BF]',
      time: '3 min',
    },
    // 5. Number Memory - Soft Warm Ochre Butter Caramel
    {
      id: 'number-memory',
      titleKey: 'games.numberMemory',
      descKey: 'games.numberMemoryDesc',
      category: 'memory',
      catKey: 'cat.memory',
      renderIcon: (cls) => <Binary className={cls} />,
      cardBg: 'bg-[#F8E4B3]',
      cardBorder: 'border-[#E8D098]',
      titleColor: 'text-[#432D06]',
      descColor: 'text-[#5A3D0B]',
      iconColor: 'text-[#745115]',
      badgeBg: 'bg-[#FCF2D5] text-[#745115] border border-[#EBD7A4]',
      statsBg: 'bg-[#F6E1AB]/80 border border-[#E7CD91]',
      statsLabel: 'text-[#7A581F]',
      statsValue: 'text-[#432D06]',
      btnBg: 'bg-[#E8C78F] hover:bg-[#DCB97E] text-[#3D2808] border border-[#D7B272]',
      time: '3 min',
    },
    // 6. Voice Recall - Soft Slate Blue-Grey
    {
      id: 'voice-recall',
      titleKey: 'games.voiceRecall',
      descKey: 'games.voiceRecallDesc',
      category: 'language',
      catKey: 'cat.language',
      renderIcon: (cls) => <Mic className={cls} />,
      cardBg: 'bg-[#C4CBD2]',
      cardBorder: 'border-[#AEB6BE]',
      titleColor: 'text-[#1C252E]',
      descColor: 'text-[#333F49]',
      iconColor: 'text-[#29343E]',
      badgeBg: 'bg-[#E0E5EA] text-[#29343E] border border-[#BFC6CE]',
      statsBg: 'bg-[#D2D8DE]/80 border border-[#B7BFC7]',
      statsLabel: 'text-[#4D5A67]',
      statsValue: 'text-[#1C252E]',
      btnBg: 'bg-[#F5EFE6] hover:bg-[#EAE2D5] text-[#3E3027] border border-[#DDD0BF]',
      time: '3 min',
    },
    // 7. What Did You See? (Object Recall) - Soft Lavender Violet
    {
      id: 'object-recall',
      titleKey: 'games.objectRecall',
      descKey: 'games.objectRecallDesc',
      category: 'recall',
      catKey: 'cat.recall',
      renderIcon: (cls) => <Eye className={cls} />,
      cardBg: 'bg-[#C5C3E3]',
      cardBorder: 'border-[#B1AFCE]',
      titleColor: 'text-[#251E45]',
      descColor: 'text-[#3D3464]',
      iconColor: 'text-[#383260]',
      badgeBg: 'bg-[#DFDEEF] text-[#383260] border border-[#C1BFDC]',
      statsBg: 'bg-[#D2D0EB]/80 border border-[#B9B7D5]',
      statsLabel: 'text-[#564E82]',
      statsValue: 'text-[#251E45]',
      btnBg: 'bg-[#F5EFE6] hover:bg-[#EAE2D5] text-[#3E3027] border border-[#DDD0BF]',
      time: '4 min',
    },
    // 8. Story Recall - Soft Blush Pink Rose
    {
      id: 'story-recall',
      titleKey: 'games.storyRecall',
      descKey: 'games.storyRecallDesc',
      category: 'recall',
      catKey: 'cat.recall',
      renderIcon: (cls) => <BookOpen className={cls} />,
      cardBg: 'bg-[#F8D8DE]',
      cardBorder: 'border-[#E7BDC5]',
      titleColor: 'text-[#47121C]',
      descColor: 'text-[#61212C]',
      iconColor: 'text-[#6F2533]',
      badgeBg: 'bg-[#FCECF0] text-[#6F2533] border border-[#E9C2C9]',
      statsBg: 'bg-[#F6CCD4]/80 border border-[#E5B5BE]',
      statsLabel: 'text-[#7F3442]',
      statsValue: 'text-[#47121C]',
      btnBg: 'bg-[#F5EFE6] hover:bg-[#EAE2D5] text-[#3E3027] border border-[#DDD0BF]',
      time: '5 min',
    },
    // 9. Familiar Sounds - Soft Mint Sage Emerald
    {
      id: 'familiar-sounds',
      titleKey: 'games.familiarSounds',
      descKey: 'games.familiarSoundsDesc',
      category: 'recognition',
      catKey: 'cat.recognition',
      renderIcon: (cls) => <Music className={cls} />,
      cardBg: 'bg-[#B7DEC8]',
      cardBorder: 'border-[#9ED0B3]',
      titleColor: 'text-[#0F3522]',
      descColor: 'text-[#1F4A33]',
      iconColor: 'text-[#1E5238]',
      badgeBg: 'bg-[#D7F0E2] text-[#1E5238] border border-[#A4D5B8]',
      statsBg: 'bg-[#C6E9D5]/80 border border-[#A2D2B5]',
      statsLabel: 'text-[#2F674A]',
      statsValue: 'text-[#0F3522]',
      btnBg: 'bg-[#F5EFE6] hover:bg-[#EAE2D5] text-[#3E3027] border border-[#DDD0BF]',
      time: '5 min',
    },
  ];

  const filteredGames = gamesList.filter(g => {
    if (selectedCategory === 'all') return true;
    return g.category === selectedCategory;
  });

  // Render individual active game without modifying game interface
  if (activeGame === 'memory-match') return <MemoryMatch onBack={() => setActiveGame(null)} />;
  if (activeGame === 'sequence-recall') return <SequenceRecall onBack={() => setActiveGame(null)} />;
  if (activeGame === 'name-face') return <NameFaceMemory onBack={() => setActiveGame(null)} />;
  if (activeGame === 'familiar-places') return <FamiliarPlacesGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'number-memory') return <NumberMemory onBack={() => setActiveGame(null)} />;
  if (activeGame === 'voice-recall') return <VoiceRecall onBack={() => setActiveGame(null)} />;
  if (activeGame === 'object-recall') return <ObjectRecall onBack={() => setActiveGame(null)} />;
  if (activeGame === 'story-recall') return <StoryRecall onBack={() => setActiveGame(null)} />;
  if (activeGame === 'familiar-sounds') return <FamiliarSounds onBack={() => setActiveGame(null)} />;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#FAF7F2] py-8 px-4 sm:px-6 md:px-8 select-none">
      <div className="max-w-6xl mx-auto space-y-7">
        
        {/* ── HEADER (MATCHING REFERENCE IMAGE) ────────────────────── */}
        <div className="text-center max-w-2xl mx-auto space-y-2 animate-fade-in">
          <div className="flex items-center justify-center gap-2.5">
            <SiroiLilyLogo className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 drop-shadow-2xs" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#2B211A] tracking-tight">
              {t('games.center')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#6E5D53] font-normal leading-relaxed max-w-xl mx-auto">
            {t('games.centerSubtitle')}
          </p>
        </div>

        {/* ── CATEGORY FILTER CHIPS (MATCHING REFERENCE PILLS) ─────── */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
          {(['all', 'memory', 'attention', 'recognition', 'recall', 'language', 'familiarity'] as const).map(cat => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition border cursor-pointer ${
                  isActive
                    ? 'bg-[#9E5536] text-white border-[#9E5536] shadow-xs'
                    : 'bg-white/80 hover:bg-white text-[#5C4D42] border-[#E8DACB] hover:border-[#D5C2AF]'
                }`}
              >
                {t(`cat.${cat}` as any)}
              </button>
            );
          })}
        </div>

        {/* ── 3x3 GAME CARDS GRID (SIROI BOTANICAL PALETTE) ───────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGames.map(game => {
            const stats = getGameStats(game.id);
            return (
              <div
                key={game.id}
                className={`p-6 rounded-[28px] sm:rounded-[32px] border ${game.cardBg} ${game.cardBorder} shadow-xs hover:shadow-md transition-all duration-200 transform hover:-translate-y-1 flex flex-col justify-between space-y-5`}
              >
                {/* Top Section: Icon & Category Badge */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/40 flex items-center justify-center shadow-2xs">
                      {game.renderIcon(`w-5 h-5 ${game.iconColor}`)}
                    </div>
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${game.badgeBg}`}>
                      {t(game.catKey)}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className={`text-xl font-black ${game.titleColor} tracking-tight`}>
                    {t(game.titleKey)}
                  </h3>
                  <p className={`text-xs ${game.descColor} font-medium mt-1 leading-relaxed min-h-[36px]`}>
                    {t(game.descKey)}
                  </p>
                </div>

                {/* Middle Section: Game Stats Strip */}
                <div className={`${game.statsBg} px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-xs`}>
                  <div className="text-left">
                    <span className={`text-[10px] ${game.statsLabel} font-bold uppercase tracking-wider block`}>
                      {t('game.difficulty')}
                    </span>
                    <span className={`${game.statsValue} font-extrabold text-xs`}>
                      {t('game.level')} {stats.level}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className={`text-[10px] ${game.statsLabel} font-bold uppercase tracking-wider block`}>
                      Best Score
                    </span>
                    <span className={`${game.statsValue} font-extrabold text-xs`}>
                      {stats.bestScore}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] ${game.statsLabel} font-bold uppercase tracking-wider block`}>
                      Est. Time
                    </span>
                    <span className={`${game.statsValue} font-extrabold text-xs`}>
                      {game.time}
                    </span>
                  </div>
                </div>

                {/* Bottom Section: Start Game Action Button */}
                <button
                  onClick={() => setActiveGame(game.id)}
                  className={`w-full py-3 px-4 ${game.btnBg} rounded-2xl shadow-xs hover:shadow-md transition flex items-center justify-center gap-2 cursor-pointer font-bold text-sm tracking-wide active:scale-98`}
                >
                  <Play className="w-3.5 h-3.5 fill-[#9E5536] text-[#9E5536]" />
                  <span>{t('btn.startGame')}</span>
                </button>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
