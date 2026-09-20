import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RefreshCw, Trophy, ArrowLeft, Clock, Sparkles, Star, Zap } from 'lucide-react';
import { StorageService } from '../services/storage';
import { AIEngineService } from '../services/ai';
import { AdaptiveEngineService } from '../services/adaptiveEngine';
import { GamificationService } from '../services/gamification';
import { useI18n } from '../i18n';
import { TextToSpeechService } from '../services/textToSpeech';

interface Card {
  id: number;
  symbol: string;
  labelKey: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const SYMBOL_POOL = [
  { symbol: '🌸', labelKey: 'Flower' },
  { symbol: '🍎', labelKey: 'Apple' },
  { symbol: '⭐', labelKey: 'Star' },
  { symbol: '🫖', labelKey: 'Teapot' },
  { symbol: '🏡', labelKey: 'House' },
  { symbol: '☀️', labelKey: 'Sun' },
  { symbol: '🕊️', labelKey: 'Bird' },
  { symbol: '🎨', labelKey: 'Palette' },
  { symbol: '🔔', labelKey: 'Bell' },
  { symbol: '🎁', labelKey: 'Gift' },
];

interface MemoryMatchProps {
  onBack: () => void;
}

export const MemoryMatch: React.FC<MemoryMatchProps> = ({ onBack }) => {
  const { language, t } = useI18n();
  const [level, setLevel] = useState<number>(2); // Default level 2 (3 pairs)
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [attempts, setAttempts] = useState<number>(0);
  const [matches, setMatches] = useState<number>(0);
  const [timeSeconds, setTimeSeconds] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [completionData, setCompletionData] = useState<any>(null);

  const totalPairs = level === 1 ? 2 : level === 2 ? 3 : level === 3 ? 4 : level === 4 ? 6 : 8;

  const speakInLang = (text: string) => {
    TextToSpeechService.speak(text, language);
  };

  const initializeGame = (lvl = level) => {
    const selectedSymbols = SYMBOL_POOL.slice(0, totalPairs);
    const cardPairs = [...selectedSymbols, ...selectedSymbols];

    const shuffled = cardPairs
      .map((item, index) => ({
        id: index,
        symbol: item.symbol,
        labelKey: item.labelKey,
        isFlipped: false,
        isMatched: false,
      }))
      .sort(() => Math.random() - 0.5);

    setCards(shuffled);
    setFlippedCards([]);
    setAttempts(0);
    setMatches(0);
    setTimeSeconds(0);
    setTimerActive(true);
    setGameOver(false);
    setCompletionData(null);
    setGameStarted(true);

    let startMsg = `Memory Match Level ${lvl}. Match all ${totalPairs} pairs.`;
    if (language === 'kha') {
      startMsg = `Jingïalehkai Card Kyrdan ${lvl}. Pynïahap ïa ki ${totalPairs} jur ki card.`;
    } else if (language === 'as') {
      startMsg = `কাৰ্ড স্মৃতি খেল স্তৰ ${lvl}। সকলো ${totalPairs} জোৰা মিলাওক।`;
    } else if (language === 'bn') {
      startMsg = `মেমরি ম্যাচ লেভেল ${lvl}। সব ${totalPairs} জোড়া মিলিয়ে নিন।`;
    } else if (language === 'ne') {
      startMsg = `मेमोरी म्याच स्तर ${lvl}। सबै ${totalPairs} जोडी मिलाउनुहोस्।`;
    } else if (language === 'mni') {
      startMsg = `কার্দ মেমোরি শান্নবা তাঙ্কক ${lvl}। কার্দ যোর ${totalPairs} মপুং ফাহনবীয়ু।`;
    } else if (language === 'lus') {
      startMsg = `Memory Match Level ${lvl}. Card inmil ${totalPairs} zawng rawh.`;
    } else if (language === 'nag') {
      startMsg = `Memory Match Level ${lvl}. Sob ${totalPairs} jura milabi.`;
    } else if (language === 'ny') {
      startMsg = `Memory Match Level ${lvl}. ${totalPairs} jura haphika.`;
    }

    speakInLang(startMsg);
  };

  useEffect(() => {
    let interval: any = null;
    if (timerActive && !gameOver) {
      interval = setInterval(() => setTimeSeconds(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, gameOver]);

  const handleCardClick = (index: number) => {
    if (gameOver || cards[index].isFlipped || cards[index].isMatched || flippedCards.length === 2) {
      return;
    }

    const updatedCards = [...cards];
    updatedCards[index].isFlipped = true;
    setCards(updatedCards);

    const newFlipped = [...flippedCards, index];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setAttempts(a => a + 1);
      const [firstIndex, secondIndex] = newFlipped;

      if (cards[firstIndex].symbol === cards[secondIndex].symbol) {
        // Match found!
        updatedCards[firstIndex].isMatched = true;
        updatedCards[secondIndex].isMatched = true;
        setCards(updatedCards);
        setFlippedCards([]);
        const newMatches = matches + 1;
        setMatches(newMatches);

        let matchAlert = 'Match found!';
        if (language === 'kha') {
          matchAlert = 'La ïahap ka jur!';
        } else if (language === 'as') {
          matchAlert = 'জোৰা মিলিল!';
        } else if (language === 'bn') {
          matchAlert = 'জোড়া মিলেছে!';
        } else if (language === 'ne') {
          matchAlert = 'जोडी मिल्यो!';
        } else if (language === 'mni') {
          matchAlert = 'যোর চান্নরে!';
        } else if (language === 'lus') {
          matchAlert = 'A inmil e!';
        } else if (language === 'nag') {
          matchAlert = 'Jura milishe!';
        } else if (language === 'ny') {
          matchAlert = 'Jura haphikam!';
        }
        speakInLang(matchAlert);

        if (newMatches === totalPairs) {
          // Game Complete
          setGameOver(true);
          setTimerActive(false);
          confetti({ particleCount: 90, spread: 60 });

          const accuracy = Math.round((totalPairs / Math.max(1, attempts + 1)) * 100);
          const score = Math.round(accuracy * 0.7 + (100 - Math.min(100, timeSeconds)) * 0.3);

          const adaptive = AdaptiveEngineService.getNextDifficulty(
            accuracy,
            level,
            StorageService.getGameSessions()
          );

          const session = StorageService.saveGameSession({
            gameId: 'memory-match',
            gameTitle: '🧩 Memory Match',
            category: 'memory',
            score,
            accuracy,
            timeSeconds,
            difficultyLevel: level,
            attempts: attempts + 1,
          });

          const rewards = GamificationService.rewardSession(session);

          setCompletionData({
            accuracy,
            score,
            adaptive,
            rewards,
          });

          let completeMsg = `Great job! You completed Memory Match with ${accuracy} percent accuracy.`;
          if (language === 'kha') {
            completeMsg = `Bha shibun! Phi la pyndep ïa ka Jingïalehkai Pynïahap Kot da ${accuracy} percent jingshisha.`;
          } else if (language === 'as') {
            completeMsg = `অতি উত্তম! আপুনি ${accuracy} শতাংশ শুদ্ধতাৰে খেল সম্পূৰ্ণ কৰিলে।`;
          } else if (language === 'bn') {
            completeMsg = `দারুণ! আপনি ${accuracy} শতাংশ নির্ভুলতায় গেম শেষ করেছেন।`;
          } else if (language === 'ny') {
            completeMsg = `Ayi bha! No Memory Match ${accuracy} percent sahi minyikam.`;
          } else if (language === 'mni') {
            completeMsg = `য়াম্না ফরে! অদোম্না মেমোরী ম্যাচ শান্নপোৎ ${accuracy} শতাংশ চুম্না লোইখ্রে।`;
          } else if (language === 'lus') {
            completeMsg = `Hna tha tak a ni! Card Inmil Zawng infiamna hi ${accuracy} percent a dikin i zo e.`;
          } else if (language === 'nag') {
            completeMsg = `Bhal kaam! Apuni Card Jura Milabi khel ${accuracy} percent sahi pra khotom kurise.`;
          }
          speakInLang(completeMsg);
        }
      } else {
        setTimeout(() => {
          const resetCards = [...cards];
          resetCards[firstIndex].isFlipped = false;
          resetCards[secondIndex].isFlipped = false;
          setCards(resetCards);
          setFlippedCards([]);
        }, 900);
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 border border-[#E4DED4] shadow-xs text-[#26332F]">
      {/* Game Start Modal Screen */}
      {!gameStarted ? (
        <div className="text-center space-y-6 py-6">
          <div className="w-20 h-20 bg-[#DDE9D9] text-[#176B61] rounded-3xl flex items-center justify-center mx-auto text-5xl shadow-inner border border-[#B7D4CC]">
            🧩
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-[#26332F]">{t('games.memoryMatch')}</h2>
            <p className="text-sm font-semibold text-[#176B61] mt-1">{t('games.memoryMatchDesc')}</p>
          </div>

          <div className="bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] max-w-sm mx-auto space-y-2 text-xs text-[#66736D] font-bold">
            <div className="flex justify-between">
              <span>{t('game.difficulty')}:</span>
              <span className="text-[#176B61]">{'⭐'.repeat(level)} ({t('game.level')} {level})</span>
            </div>
            <div className="flex justify-between">
              <span>{t('game.cardsGrid')}:</span>
              <span className="text-[#26332F]">{totalPairs * 2} {t('game.cards')} ({totalPairs} {t('game.pairs')})</span>
            </div>
            <div className="flex justify-between">
              <span>{t('game.potentialRewards')}:</span>
              <span className="text-[#176B61] font-extrabold">+15 ⭐ {t('game.mindPoints')} | +25 {t('game.xp')}</span>
            </div>
          </div>

          <div className="flex gap-3 max-w-sm mx-auto">
            <button
              onClick={() => initializeGame()}
              className="flex-1 py-4 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-lg rounded-2xl shadow-xs transition cursor-pointer"
            >
              {t('btn.startGame')} ➔
            </button>
            <button
              onClick={onBack}
              className="px-5 py-4 bg-[#F4EBD7] hover:bg-[#ecdcb9] text-[#26332F] font-bold rounded-2xl transition text-sm border border-[#E4DED4] cursor-pointer"
            >
              {t('btn.back')}
            </button>
          </div>
        </div>
      ) : !gameOver ? (
        /* Playing View */
        <>
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E4DED4]">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F4EBD7] hover:bg-[#ecdcb9] rounded-xl text-[#26332F] font-bold text-xs border border-[#E4DED4] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> {t('btn.exit')}
            </button>

            <div className="text-center">
              <h3 className="text-xl font-extrabold text-[#26332F]">{t('games.memoryMatch')}</h3>
              <span className="text-xs bg-[#DDE9D9] text-[#176B61] font-extrabold px-3 py-0.5 rounded-full border border-[#B7D4CC]">
                {t('game.level')} {level}
              </span>
            </div>

            <button
              onClick={() => initializeGame()}
              className="p-2 bg-[#F4EBD7] hover:bg-[#ecdcb9] rounded-xl text-[#26332F] transition border border-[#E4DED4] cursor-pointer"
              title="Restart"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6 bg-[#FAF9F4] p-4 rounded-2xl border border-[#E4DED4] text-center text-xs">
            <div>
              <div className="text-[#66736D] font-bold">{t('game.attempts')}</div>
              <div className="text-lg font-extrabold text-[#26332F]">{attempts}</div>
            </div>
            <div>
              <div className="text-[#66736D] font-bold">{t('game.matchedPairs')}</div>
              <div className="text-lg font-extrabold text-[#176B61]">
                {matches} / {totalPairs}
              </div>
            </div>
            <div>
              <div className="text-[#66736D] font-bold flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {t('game.timeSpent')}
              </div>
              <div className="text-lg font-extrabold text-[#26332F]">{timeSeconds}s</div>
            </div>
          </div>

          <div
            className={`grid gap-3 ${
              totalPairs <= 3 ? 'grid-cols-3' : totalPairs <= 6 ? 'grid-cols-4' : 'grid-cols-4'
            }`}
          >
            {cards.map((card, index) => (
              <button
                key={card.id}
                onClick={() => handleCardClick(index)}
                className={`aspect-square rounded-2xl text-4xl sm:text-5xl flex items-center justify-center font-bold transition transform duration-200 shadow-xs cursor-pointer ${
                  card.isFlipped || card.isMatched
                    ? 'bg-white border-4 border-[#176B61] text-[#26332F] rotate-0 scale-100'
                    : 'bg-[#DCEEEF] hover:bg-[#cbe8ea] text-[#176B61] border-4 border-white hover:scale-105 active:scale-95'
                }`}
              >
                {card.isFlipped || card.isMatched ? card.symbol : '❓'}
              </button>
            ))}
          </div>
        </>
      ) : (
        /* Game Completion & Rewards View */
        <div className="bg-[#FAF9F4] border border-[#E4DED4] rounded-3xl p-6 text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 bg-[#DDE9D9] text-[#176B61] rounded-full flex items-center justify-center mx-auto shadow-xs border border-[#B7D4CC]">
            <Trophy className="w-10 h-10" />
          </div>

          <div>
            <h3 className="text-2xl font-extrabold text-[#26332F]">🎉 {t('feedback.activityComplete')}</h3>
            <p className="text-xs text-[#66736D] mt-0.5">{t('feedback.greatWork')}</p>
          </div>

          {completionData && (
            <div className="space-y-3">
              {/* Rewards Banner */}
              <div className="flex items-center justify-center gap-4 bg-white p-4 rounded-2xl border border-[#E4DED4] shadow-xs">
                <div className="flex items-center gap-1.5 text-[#176B61] font-extrabold text-base">
                  <Star className="w-5 h-5 fill-current" /> +{completionData.rewards.mindPointsEarned} {t('game.mindPoints')}
                </div>
                <div className="h-6 w-px bg-[#E4DED4]"></div>
                <div className="flex items-center gap-1.5 text-[#A2A1CD] font-extrabold text-base">
                  <Zap className="w-5 h-5 fill-current" /> +{completionData.rewards.xpEarned} {t('game.xp')}
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E4DED4] text-left text-xs space-y-2 text-[#26332F]">
                <div className="flex justify-between font-bold">
                  <span>{t('game.accuracy')}:</span>
                  <span className="text-[#176B61] font-extrabold text-sm">{completionData.accuracy}%</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>{t('game.timeSpent')}:</span>
                  <span>{timeSeconds} {t('history.seconds')}</span>
                </div>
                <div className="pt-2 border-t border-[#E4DED4] text-[#176B61] font-semibold flex items-start gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#176B61] shrink-0 mt-0.5" />
                  <span><strong>{t('game.aiRecommendation')}:</strong> {completionData.adaptive.recommendationReason}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                setLevel(completionData?.adaptive?.nextDifficulty || level);
                initializeGame(completionData?.adaptive?.nextDifficulty || level);
              }}
              className="flex-1 py-3 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-sm rounded-xl shadow-xs transition cursor-pointer"
            >
              {t('btn.playAgain')} ({t('game.level')} {completionData?.adaptive?.nextDifficulty || level})
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-3 bg-[#F4EBD7] hover:bg-[#ecdcb9] text-[#26332F] font-bold text-sm rounded-xl transition border border-[#E4DED4] cursor-pointer"
            >
              {t('btn.back')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
