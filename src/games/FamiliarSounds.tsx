import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ArrowLeft, RefreshCw, Trophy, Sparkles, Volume2, Star, Zap, Play } from 'lucide-react';
import { StorageService } from '../services/storage';
import { AdaptiveEngineService } from '../services/adaptiveEngine';
import { GamificationService } from '../services/gamification';
import { useI18n } from '../i18n';
import { TextToSpeechService } from '../services/textToSpeech';

interface SoundItem {
  id: string;
  nameKey: string;
  emoji: string;
  frequency: number;
  type: OscillatorType;
}

const SOUND_POOL: SoundItem[] = [
  { id: 'bird', nameKey: 'Bird Chirp', emoji: '🕊️', frequency: 880, type: 'sine' },
  { id: 'bell', nameKey: 'Doorbell Chime', emoji: '🔔', frequency: 523, type: 'triangle' },
  { id: 'rain', nameKey: 'Rainfall Stream', emoji: '🌧️', frequency: 330, type: 'sine' },
  { id: 'clock', nameKey: 'Clock Ticking', emoji: '⏰', frequency: 440, type: 'square' },
];

interface FamiliarSoundsProps {
  onBack: () => void;
}

export const FamiliarSounds: React.FC<FamiliarSoundsProps> = ({ onBack }) => {
  const { language, t } = useI18n();
  const [level, setLevel] = useState<number>(1);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [currentSound, setCurrentSound] = useState<SoundItem>(SOUND_POOL[0]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [completionData, setCompletionData] = useState<any>(null);

  const speakInLang = (text: string) => {
    TextToSpeechService.speak(text, language);
  };

  const playSynthTone = (freq = currentSound.frequency, type = currentSound.type) => {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 1.2);
      } catch (e) {
        console.warn('Audio Context tone synthesis fallback', e);
      }
    }
  };

  const initializeGame = () => {
    const selected = SOUND_POOL[Math.floor(Math.random() * SOUND_POOL.length)];
    setCurrentSound(selected);
    setSelectedAnswer(null);
    setGameOver(false);
    setCompletionData(null);
    setGameStarted(true);

    let startMsg = 'Familiar Sounds. Tap the play audio button to listen.';
    if (language === 'kha') {
      startMsg = 'Ki Sur ba tipmit. Tba ha ka button ban sngap ka sur.';
    } else if (language === 'as') {
      startMsg = 'পৰিচিত শব্দ। শব্দটো শুনিবলৈ বুটামত টিপক।';
    } else if (language === 'ny') {
      startMsg = 'Awaaz chintam minyi. Awaaz tatpa button daban.';
    } else if (language === 'mni') {
      startMsg = 'পাম্নরবা খোন্থোক। খোন্থোক তানবা নম্মু।';
    } else if (language === 'lus') {
      startMsg = 'Familiar Sounds. Ngaihthlak nan play audio button hi hmet rawh.';
    } else if (language === 'nag') {
      startMsg = 'Familiar Sounds. Awaaz sunibole play audio button te dabi.';
    }
    speakInLang(startMsg);
  };

  const handleOptionSelect = (name: string) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(name);

    const isCorrect = name === currentSound.nameKey;
    const accuracy = isCorrect ? 100 : 40;

    if (isCorrect) {
      confetti({ particleCount: 75, spread: 60 });
      let rightMsg = `Correct! You heard the ${currentSound.nameKey}.`;
      if (language === 'kha') {
        rightMsg = `Dei paka! Phi la ïohsngew ïa ka sur ${currentSound.nameKey}.`;
      } else if (language === 'as') {
        rightMsg = `সঠিক উত্তৰ! আপুনি ${currentSound.nameKey} শুনিলে।`;
      } else if (language === 'ny') {
        rightMsg = `Sahi! No ${currentSound.nameKey} awaaz hunam.`;
      } else if (language === 'mni') {
        rightMsg = `চুম্লে! অদোম্না ${currentSound.nameKey} গী খোন্থোক তাবগে।`;
      } else if (language === 'lus') {
        rightMsg = `A dik e! ${currentSound.nameKey} ri i hria e.`;
      } else if (language === 'nag') {
        rightMsg = `Sahi answer! Apuni ${currentSound.nameKey} sunise.`;
      }
      speakInLang(rightMsg);
    } else {
      let wrongMsg = `That was actually the ${currentSound.nameKey}.`;
      if (language === 'kha') {
        wrongMsg = `Kato ka sur ka dei ${currentSound.nameKey}.`;
      } else if (language === 'as') {
        wrongMsg = `সেইটো আচলতে ${currentSound.nameKey} আছিল।`;
      } else if (language === 'ny') {
        wrongMsg = `Siyo awaaz hi ${currentSound.nameKey} e.`;
      } else if (language === 'mni') {
        wrongMsg = `খোন্থোক অদু অচুম্বা ওইনা ${currentSound.nameKey} নি।`;
      } else if (language === 'lus') {
        wrongMsg = `Kha chu ${currentSound.nameKey} ri a ni zawk.`;
      } else if (language === 'nag') {
        wrongMsg = `Etu awaaz actually ${currentSound.nameKey} ase.`;
      }
      speakInLang(wrongMsg);
    }

    setGameOver(true);

    const adaptive = AdaptiveEngineService.getNextDifficulty(
      accuracy,
      level,
      StorageService.getGameSessions()
    );

    const session = StorageService.saveGameSession({
      gameId: 'familiar-sounds',
      gameTitle: '🎵 Familiar Sounds',
      category: 'recognition',
      score: accuracy,
      accuracy,
      timeSeconds: 20,
      difficultyLevel: level,
    });

    const rewards = GamificationService.rewardSession(session);

    setCompletionData({
      accuracy,
      isCorrect,
      adaptive,
      rewards,
    });
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 border border-slate-200 shadow-xl text-slate-900">
      {!gameStarted ? (
        <div className="text-center space-y-6 py-6">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-3xl flex items-center justify-center mx-auto text-5xl shadow-inner">
            🎵
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900">{t('games.familiarSounds')}</h2>
            <p className="text-sm font-semibold text-emerald-700 mt-1">{t('games.familiarSoundsDesc')}</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-w-sm mx-auto space-y-2 text-xs text-slate-600 font-bold">
            <div className="flex justify-between">
              <span>{t('game.potentialRewards')}:</span>
              <span className="text-emerald-700 font-extrabold">+15 ⭐ {t('game.mindPoints')} | +25 {t('game.xp')}</span>
            </div>
          </div>

          <div className="flex gap-3 max-w-sm mx-auto">
            <button
              onClick={() => initializeGame()}
              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-lg rounded-2xl shadow-xl transition"
            >
              {t('btn.startGame')} ➔
            </button>
            <button
              onClick={onBack}
              className="px-5 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition text-sm"
            >
              {t('btn.back')}
            </button>
          </div>
        </div>
      ) : !gameOver ? (
        <div className="space-y-6 max-w-md mx-auto text-center">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <button
              onClick={onBack}
              className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1" /> {t('btn.exit')}
            </button>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-3 py-0.5 rounded-full">
              {t('cat.recognition')}
            </span>
          </div>

          <h3 className="text-xl font-extrabold text-slate-900">{t('game.whatDidYouHear')}</h3>

          <button
            onClick={() => playSynthTone()}
            className="w-24 h-24 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full mx-auto shadow-2xl flex flex-col items-center justify-center transition transform active:scale-95 border-4 border-white"
          >
            <Volume2 className="w-10 h-10 mb-1" />
            <span className="text-[10px] font-extrabold uppercase">{t('game.replaySound')}</span>
          </button>

          <div className="grid grid-cols-2 gap-3 pt-4">
            {SOUND_POOL.map(snd => {
              const isSelected = selectedAnswer === snd.nameKey;
              let btnClass = 'bg-white border-2 border-slate-200 text-slate-900 hover:bg-slate-50';
              if (isSelected) {
                btnClass =
                  snd.nameKey === currentSound.nameKey
                    ? 'bg-emerald-100 border-2 border-emerald-600 text-emerald-900 font-extrabold'
                    : 'bg-rose-100 border-2 border-rose-600 text-rose-900 font-extrabold';
              }
              return (
                <button
                  key={snd.id}
                  onClick={() => handleOptionSelect(snd.nameKey)}
                  disabled={selectedAnswer !== null}
                  className={`p-4 rounded-2xl border-2 transition transform active:scale-95 text-center font-extrabold ${btnClass}`}
                >
                  <div className="text-3xl mb-1">{snd.emoji}</div>
                  <div className="text-sm">{snd.nameKey}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-6 text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-xl">
            <Trophy className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">
              {completionData?.isCorrect ? `🎉 ${t('feedback.correct')}` : t('feedback.goodEffort')}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {t('game.soundPlayed')} <strong>{currentSound.nameKey} {currentSound.emoji}</strong>
            </p>
          </div>

          {completionData && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-4 bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
                <div className="flex items-center gap-1.5 text-amber-600 font-extrabold text-base">
                  <Star className="w-5 h-5 fill-current" /> +{completionData.rewards.mindPointsEarned} {t('game.mindPoints')}
                </div>
                <div className="h-6 w-px bg-slate-200"></div>
                <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold text-base">
                  <Zap className="w-5 h-5 fill-current" /> +{completionData.rewards.xpEarned} {t('game.xp')}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => initializeGame()}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-md transition"
            >
              {t('btn.playAgain')}
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-sm rounded-xl transition"
            >
              {t('btn.back')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
