import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ArrowLeft, RefreshCw, Trophy, Sparkles, Star, Zap, Eye, Delete } from 'lucide-react';
import { StorageService } from '../services/storage';
import { AdaptiveEngineService } from '../services/adaptiveEngine';
import { GamificationService } from '../services/gamification';
import { useI18n } from '../i18n';
import { TextToSpeechService } from '../services/textToSpeech';

interface NumberMemoryProps {
  onBack: () => void;
}

export const NumberMemory: React.FC<NumberMemoryProps> = ({ onBack }) => {
  const { language, t } = useI18n();
  const [level, setLevel] = useState<number>(2); // Level 1: 2 digits, Level 2: 3 digits, Level 3: 4 digits, Level 4: 5 digits, Level 5: 6 digits
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [targetNumber, setTargetNumber] = useState<string>('');
  const [userInput, setUserInput] = useState<string>('');
  const [isMemorizing, setIsMemorizing] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(5);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [completionData, setCompletionData] = useState<any>(null);

  const digitCount = level + 1;

  const speakInLang = (text: string) => {
    TextToSpeechService.speak(text, language);
  };

  const initializeGame = (lvl = level) => {
    let numStr = '';
    for (let i = 0; i < digitCount; i++) {
      numStr += Math.floor(Math.random() * 9 + 1).toString();
    }
    setTargetNumber(numStr);
    setUserInput('');
    setIsMemorizing(true);
    setCountdown(5);
    setGameOver(false);
    setCompletionData(null);
    setGameStarted(true);

    let startMsg = `Remember this ${digitCount} digit number. You have 5 seconds.`;
    if (language === 'kha') {
      startMsg = `Kynmaw ïa une u ${digitCount} dak jingkhein. Phi don 5 sec.`;
    } else if (language === 'as') {
      startMsg = `এই ${digitCount} টা সংখ্যা মনত ৰাখক। আপোনাৰ হাতত ৫ ছেকেণ্ড সময় আছে।`;
    } else if (language === 'bn') {
      startMsg = `এই ${digitCount} টি সংখ্যা মনে রাখুন। আপনার কাছে ৫ সেকেন্ড সময় আছে।`;
    } else if (language === 'ne') {
      startMsg = `यो ${digitCount} अङ्कको नम्बर सम्झनुहोस्। तपाईंसँग ५ सेकेन्ड छ।`;
    } else if (language === 'mni') {
      startMsg = `মশীং ${digitCount} অসি নীংশিংবীয়ু। অদোমগী ৫ সেকেন্দ লৈ।`;
    } else if (language === 'lus') {
      startMsg = `He number ${digitCount} hi vawng rawh. Sec 5 i nei.`;
    } else if (language === 'nag') {
      startMsg = `Etu ${digitCount} number yaad rakhibi. 5 sec ase.`;
    } else if (language === 'ny') {
      startMsg = `Siyo ${digitCount} number minyi dwnam. 5 sec dwnam.`;
    }

    speakInLang(startMsg);
  };

  useEffect(() => {
    let timer: any = null;
    if (gameStarted && isMemorizing && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    } else if (gameStarted && isMemorizing && countdown === 0) {
      setIsMemorizing(false);
      let timeUpMsg = 'Time is up! Enter the number using the keypad.';
      if (language === 'kha') {
        timeUpMsg = 'La kut ka por! Pyndon ïa u keypad ban thoh u number.';
      } else if (language === 'as') {
        timeUpMsg = 'সময় উকলিল! কিবৰ্ড ব্যৱহাৰ কৰি সংখ্যাটো লিখক।';
      } else if (language === 'bn') {
        timeUpMsg = 'সময় শেষ! কিপ্যাড ব্যবহার করে সংখ্যাটি লিখুন।';
      } else if (language === 'ne') {
        timeUpMsg = 'समय सकियो! किप्याड प्रयोग गरेर नम्बर प्रविष्ट गर्नुहोस्।';
      } else if (language === 'mni') {
        timeUpMsg = 'মতৌ লোইরে! কিপাদ শীজিন্নদুনা মশীং অদু ইবীয়ু।';
      } else if (language === 'lus') {
        timeUpMsg = 'Hun a tawp! Keypad hmangin number hi chhu rawh.';
      } else if (language === 'nag') {
        timeUpMsg = 'Time khotom! Keypad use kori number likhibi.';
      } else if (language === 'ny') {
        timeUpMsg = 'Time khotom! Keypad lw number basika.';
      }
      speakInLang(timeUpMsg);
    }
    return () => clearInterval(timer);
  }, [gameStarted, isMemorizing, countdown, language]);

  const handleKeypadPress = (val: string) => {
    if (userInput.length < digitCount) {
      setUserInput(prev => prev + val);
    }
  };

  const handleBackspace = () => {
    setUserInput(prev => prev.slice(0, -1));
  };

  const handleSubmitNumber = () => {
    if (!userInput.trim()) return;

    setGameOver(true);
    const isCorrect = userInput.trim() === targetNumber;
    const accuracy = isCorrect ? 100 : 40;

    if (isCorrect) {
      confetti({ particleCount: 80, spread: 60 });
      let correctMsg = `Correct! The number was indeed ${targetNumber}.`;
      if (language === 'kha') {
        correctMsg = `Dei paka! U number u dei ${targetNumber}.`;
      } else if (language === 'as') {
        correctMsg = `সঠিক উত্তৰ! সংখ্যাটো প্ৰকৃততে ${targetNumber} আছিল।`;
      } else if (language === 'bn') {
        correctMsg = `সঠিক উত্তর! সংখ্যাটি ছিল ${targetNumber}।`;
      } else if (language === 'ne') {
        correctMsg = `सहि उत्तर! नम्बर वास्तवमा ${targetNumber} थियो।`;
      } else if (language === 'mni') {
        correctMsg = `চুম্লে! মশীং অদু অচুম্বা ${targetNumber} নি।`;
      } else if (language === 'lus') {
        correctMsg = `A dik e! Number chu ${targetNumber} a ni e.`;
      } else if (language === 'nag') {
        correctMsg = `Ekdom thik! Number toh ${targetNumber} thakishe.`;
      } else if (language === 'ny') {
        correctMsg = `Thik nam! Number siyo ${targetNumber} dwnam.`;
      }
      speakInLang(correctMsg);
    } else {
      let wrongMsg = `Good effort! The correct number was ${targetNumber}.`;
      if (language === 'kha') {
        wrongMsg = `Jingpyrshang kaba bha! U number ba dei u dei ${targetNumber}.`;
      } else if (language === 'as') {
        wrongMsg = `ভাল প্ৰচেষ্টা! সঠিক সংখ্যাটো আছিল ${targetNumber}।`;
      } else if (language === 'bn') {
        wrongMsg = `ভালো প্রচেষ্টা! সঠিক সংখ্যাটি ছিল ${targetNumber}।`;
      } else if (language === 'ne') {
        wrongMsg = `राम्रो प्रयास! सही नम्बर ${targetNumber} थियो।`;
      }
      speakInLang(wrongMsg);
    }

    const adaptive = AdaptiveEngineService.getNextDifficulty(
      accuracy,
      level,
      StorageService.getGameSessions()
    );

    const session = StorageService.saveGameSession({
      gameId: 'number-memory',
      gameTitle: '🔢 Number Memory',
      category: 'memory',
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
          <div className="w-20 h-20 bg-amber-100 text-amber-700 rounded-3xl flex items-center justify-center mx-auto text-5xl shadow-inner">
            🔢
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900">{t('games.numberMemory')}</h2>
            <p className="text-sm font-semibold text-amber-700 mt-1">{t('games.numberMemoryDesc')}</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-w-sm mx-auto space-y-2 text-xs text-slate-600 font-bold">
            <div className="flex justify-between">
              <span>{t('game.difficulty')}:</span>
              <span className="text-amber-500">{'⭐'.repeat(level)} ({t('game.level')} {level})</span>
            </div>
            <div className="flex justify-between">
              <span>{t('game.digits')}:</span>
              <span className="text-slate-900">{digitCount} {t('game.digits')}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('game.potentialRewards')}:</span>
              <span className="text-amber-700 font-extrabold">+15 ⭐ {t('game.mindPoints')} | +25 {t('game.xp')}</span>
            </div>
          </div>

          <div className="flex gap-3 max-w-sm mx-auto">
            <button
              onClick={() => initializeGame()}
              className="flex-1 py-4 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-lg rounded-2xl shadow-xl transition"
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
        <div className="space-y-6 max-w-md mx-auto">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <button
              onClick={onBack}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1" /> {t('btn.exit')}
            </button>
            <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-3 py-0.5 rounded-full">
              {digitCount} {t('game.digits')}
            </span>
          </div>

          {isMemorizing ? (
            <div className="text-center space-y-6 py-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-900 font-extrabold rounded-2xl text-base">
                <Eye className="w-5 h-5 text-amber-600 animate-pulse" /> {t('game.memorizeNumber')} ({countdown}{t('game.seconds')})
              </div>
              <div className="text-6xl sm:text-7xl font-extrabold font-mono tracking-widest text-slate-900 bg-slate-50 p-6 rounded-3xl border-4 border-amber-300 shadow-inner">
                {targetNumber}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-extrabold text-slate-900">{t('game.whatWasNumber')}</h3>
                <p className="text-xs text-slate-500 mt-1">{t('game.useKeypad')}</p>
              </div>

              {/* Input Display Box */}
              <div className="h-20 bg-slate-900 text-teal-400 font-mono text-5xl font-extrabold flex items-center justify-center rounded-2xl border-4 border-teal-500 tracking-widest shadow-inner">
                {userInput || '_____'}
              </div>

              {/* Large Keypad */}
              <div className="grid grid-cols-3 gap-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    onClick={() => handleKeypadPress(num)}
                    className="py-4 bg-slate-100 hover:bg-slate-200 font-extrabold text-2xl rounded-2xl text-slate-900 shadow active:scale-95 transition"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleBackspace}
                  className="py-4 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded-2xl flex items-center justify-center"
                >
                  <Delete className="w-6 h-6" />
                </button>
                <button
                  onClick={() => handleKeypadPress('0')}
                  className="py-4 bg-slate-100 hover:bg-slate-200 font-extrabold text-2xl rounded-2xl text-slate-900 shadow active:scale-95 transition"
                >
                  0
                </button>
                <button
                  onClick={handleSubmitNumber}
                  disabled={userInput.length === 0}
                  className="py-4 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-lg rounded-2xl shadow transition disabled:opacity-50"
                >
                  {t('btn.submit')}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 bg-amber-600 text-white rounded-full flex items-center justify-center mx-auto shadow-xl">
            <Trophy className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">
              {completionData?.isCorrect ? `🎉 ${t('feedback.correct')}` : t('feedback.goodEffort')}
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Target: <strong>{targetNumber}</strong> | {userInput}
            </p>
          </div>

          {completionData && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-4 bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
                <div className="flex items-center gap-1.5 text-amber-600 font-extrabold text-base">
                  <Star className="w-5 h-5 fill-current" /> +{completionData.rewards.mindPointsEarned} {t('game.mindPoints')}
                </div>
                <div className="h-6 w-px bg-slate-200"></div>
                <div className="flex items-center gap-1.5 text-amber-700 font-extrabold text-base">
                  <Zap className="w-5 h-5 fill-current" /> +{completionData.rewards.xpEarned} {t('game.xp')}
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
              className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-sm rounded-xl shadow-md transition"
            >
              {t('btn.playAgain')} ({t('game.level')} {completionData?.adaptive?.nextDifficulty || level})
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
