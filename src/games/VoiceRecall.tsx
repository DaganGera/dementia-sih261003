import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ArrowLeft, RefreshCw, Trophy, Sparkles, Mic, Star, Zap, Volume2 } from 'lucide-react';
import { StorageService } from '../services/storage';
import { AdaptiveEngineService } from '../services/adaptiveEngine';
import { GamificationService } from '../services/gamification';
import { useI18n } from '../i18n';
import { TextToSpeechService } from '../services/textToSpeech';
import { SpeechRecognitionService } from '../services/speechRecognition';

const WORD_SETS_BY_LANG: Record<string, string[][]> = {
  kha: [
    ['Soh apple', 'Kper syntiew', 'Kot'],
    ['Sha', 'Tiewkulab', 'Sngi'],
    ['Step', 'Jingrwai', 'Samrkhie'],
    ['Slap', 'It ïing', 'Tiew'],
  ],
  as: [
    ['আপেল', 'ফুলনি', 'কিতাপ'],
    ['চাহ', 'গোলাপ', 'ৰ’দালি'],
    ['পুৱা', 'গান', 'হাঁহি'],
    ['বৰষুণ', 'খিৰিকী', 'ফুল'],
  ],
  bn: [
    ['আপেল', 'বাগান', 'বই'],
    ['চা', 'গোলাপ', 'সূর্য'],
    ['সকাল', 'গান', 'হাসি'],
    ['বৃষ্টি', 'জানালা', 'ফুল'],
  ],
  ne: [
    ['स्याउ', 'बगैंचा', 'किताब'],
    ['चिया', 'गुलाब', 'घाम'],
    ['बिहान', 'गीत', 'हाँसो'],
  ],
  mni: [
    ['আপেল', 'লৈফম', 'লাইরিক'],
    ['চা', 'গোলাপ', 'নুমিৎ'],
    ['অয়ুক', 'ঈশৈ', 'নোংমিৎ'],
  ],
  ny: [
    ['Apple', 'Phool bagan', 'Book'],
    ['Cha', 'Gulap phool', 'Lwnyi sngi'],
    ['Rati pua', 'Agam', 'Minynam'],
    ['Wsi', 'Window', 'Phool'],
  ],
  lus: [
    ['Eppal', 'Huan', 'Lehabu'],
    ['Thingpui', 'Rose', 'Ni eng'],
    ['Zing', 'Zai', 'Nuih'],
    ['Ruah', 'Tukverh', 'Pangpar'],
  ],
  nag: [
    ['Apple', 'Bagan', 'Kitab'],
    ['Cha', 'Gulaab', 'Dhup'],
    ['Fajur', 'Gaan', 'Habi'],
    ['Pani', 'Khirki', 'Phool'],
  ],
  default: [
    ['Apple', 'Garden', 'Book'],
    ['Teapot', 'Rose', 'Sunlight'],
    ['Morning', 'Music', 'Smile'],
    ['Rain', 'Window', 'Flower'],
  ],
};

interface VoiceRecallProps {
  onBack: () => void;
}

export const VoiceRecall: React.FC<VoiceRecallProps> = ({ onBack }) => {
  const { language, t } = useI18n();
  const [level, setLevel] = useState<number>(1);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [targetWords, setTargetWords] = useState<string[]>([]);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [isMemorizing, setIsMemorizing] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(6);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [completionData, setCompletionData] = useState<any>(null);

  const speakInLang = (text: string) => {
    TextToSpeechService.speak(text, language);
  };

  const initializeGame = () => {
    const sets = WORD_SETS_BY_LANG[language] || WORD_SETS_BY_LANG.default;
    const selected = sets[Math.floor(Math.random() * sets.length)];
    setTargetWords(selected);
    setRecognizedText('');
    setIsMemorizing(true);
    setCountdown(6);
    setIsListening(false);
    setGameOver(false);
    setCompletionData(null);
    setGameStarted(true);

    let remWordsMsg = `Please remember these three words: ${selected.join(', ')}.`;
    if (language === 'kha') {
      remWordsMsg = `Sngewbha kynmaw ïa kine ki 3 tylli ki ktien: ${selected.join(', ')}.`;
    } else if (language === 'as') {
      remWordsMsg = `অনুগ্ৰহ কৰি এই তিনিটা শব্দ মনত ৰাখক: ${selected.join(', ')}।`;
    } else if (language === 'bn') {
      remWordsMsg = `অনুগ্রহ করে এই তিনটি শব্দ মনে রাখুন: ${selected.join(', ')}।`;
    } else if (language === 'ny') {
      remWordsMsg = `Agam 3ta khedapnam minyi dwnka: ${selected.join(', ')}.`;
    } else if (language === 'mni') {
      remWordsMsg = `চাংয়েং অসিগী ৱাহৈ ৩ অসি নীংশিংবীয়ু: ${selected.join(', ')}।`;
    } else if (language === 'lus') {
      remWordsMsg = `Khawngaihin heng thumal pathumte hi hre reng rawh: ${selected.join(', ')}.`;
    } else if (language === 'nag') {
      remWordsMsg = `Etu tin ta kotha yaad rakhibi: ${selected.join(', ')}.`;
    }

    speakInLang(remWordsMsg);
  };

  useEffect(() => {
    let timer: any = null;
    if (gameStarted && isMemorizing && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    } else if (gameStarted && isMemorizing && countdown === 0) {
      setIsMemorizing(false);
      let timeUpMsg = 'Time is up! Tell me or type the three words you remember.';
      if (language === 'kha') {
        timeUpMsg = 'La kut ka por! Kren lane thoh ïa ki 3 tylli ki ktien ba phi kynmaw.';
      } else if (language === 'as') {
        timeUpMsg = 'সময় উকলিল! আপুনি মনত ৰখা তিনিটা শব্দ কওক বা লিখক।';
      } else if (language === 'bn') {
        timeUpMsg = 'সময় শেষ! মনে রাখা তিনটি শব্দ বলুন বা লিখুন।';
      } else if (language === 'ny') {
        timeUpMsg = 'Time poba dope! Agam 3ta koboka.';
      } else if (language === 'mni') {
        timeUpMsg = 'মতম লোইরে! নীংশিংলিবা ৱাহৈ ৩ অদু হায়বীয়ু নত্রগা ইবীয়ু।';
      }
      speakInLang(timeUpMsg);
    }
    return () => clearInterval(timer);
  }, [gameStarted, isMemorizing, countdown, language]);

  const handleStartVoice = () => {
    setIsListening(true);
    SpeechRecognitionService.startListening({
      languageCode: language,
      onResult: (transcript) => {
        setRecognizedText(transcript);
        setIsListening(false);
      },
      onError: () => {
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
  };

  const handleSubmitRecall = () => {
    if (!recognizedText.trim()) return;

    setGameOver(true);
    const userWords = recognizedText.toLowerCase().split(/[\s,]+/);

    let matchCount = 0;
    targetWords.forEach(w => {
      if (userWords.some(uw => uw.includes(w.toLowerCase()))) {
        matchCount += 1;
      }
    });

    const accuracy = Math.round((matchCount / targetWords.length) * 100);

    if (accuracy >= 66) {
      confetti({ particleCount: 75, spread: 60 });
    }

    const adaptive = AdaptiveEngineService.getNextDifficulty(
      accuracy,
      level,
      StorageService.getGameSessions()
    );

    const session = StorageService.saveGameSession({
      gameId: 'voice-recall',
      gameTitle: '🗣️ Voice Recall',
      category: 'language',
      score: accuracy,
      accuracy,
      timeSeconds: 30,
      difficultyLevel: level,
    });

    const rewards = GamificationService.rewardSession(session);

    setCompletionData({
      accuracy,
      matchCount,
      adaptive,
      rewards,
    });

    let doneMsg = `Voice recall complete! You remembered ${matchCount} out of ${targetWords.length} words.`;
    if (language === 'kha') {
      doneMsg = `La dep ka jingkynmaw sur! Phi la kynmaw ${matchCount} na ki ${targetWords.length} tylli ki ktien.`;
    } else if (language === 'as') {
      doneMsg = `মৌখিক স্মৃতি সম্পূৰ্ণ হ’ল! আপুনি ${targetWords.length} টাৰ ভিতৰত ${matchCount} টা শব্দ সঠিকভাৱে মনত পেলালে।`;
    } else if (language === 'ny') {
      doneMsg = `Voice recall dope! No ${targetWords.length} ho ${matchCount} agam khedapkam.`;
    } else if (language === 'mni') {
      doneMsg = `খোঞ্জেল নীংশিংবা লোইরে! অদোম্না ৱাহৈ ${targetWords.length} গী মনুংদা ${matchCount} নীংশিংবা ঙমখ্রে।`;
    }

    speakInLang(doneMsg);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 border border-slate-200 shadow-xl text-slate-900">
      {!gameStarted ? (
        <div className="text-center space-y-6 py-6">
          <div className="w-20 h-20 bg-rose-100 text-rose-700 rounded-3xl flex items-center justify-center mx-auto text-5xl shadow-inner">
            🗣️
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900">{t('games.voiceRecall')}</h2>
            <p className="text-sm font-semibold text-rose-700 mt-1">{t('games.voiceRecallDesc')}</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-w-sm mx-auto space-y-2 text-xs text-slate-600 font-bold">
            <div className="flex justify-between">
              <span>{t('game.targetWords')}:</span>
              <span className="text-slate-900">{t('game.threeWords')}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('game.potentialRewards')}:</span>
              <span className="text-rose-700 font-extrabold">+15 ⭐ {t('game.mindPoints')} | +25 {t('game.xp')}</span>
            </div>
          </div>

          <div className="flex gap-3 max-w-sm mx-auto">
            <button
              onClick={() => initializeGame()}
              className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-lg rounded-2xl shadow-xl transition"
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
              className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1" /> {t('btn.exit')}
            </button>
            <span className="text-xs bg-rose-100 text-rose-800 font-extrabold px-3 py-0.5 rounded-full">
              {t('game.threeWords')}
            </span>
          </div>

          {isMemorizing ? (
            <div className="text-center space-y-6 py-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-900 font-extrabold rounded-2xl text-base">
                {t('game.remember3Words')} ({countdown}{t('game.seconds')})
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {targetWords.map((word, i) => (
                  <span
                    key={i}
                    className="px-5 py-3 bg-slate-900 text-white font-extrabold text-2xl rounded-2xl shadow border-2 border-rose-400"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5 text-center">
              <h3 className="text-xl font-extrabold text-slate-900">{t('game.tellMeWords')}</h3>
              <p className="text-xs text-slate-500">{t('game.tapMicOrType')}</p>

              <button
                onClick={handleStartVoice}
                className={`p-6 rounded-full mx-auto shadow-xl transition transform active:scale-95 flex items-center justify-center ${
                  isListening ? 'bg-rose-600 text-white ring-8 ring-rose-300 animate-pulse' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                }`}
              >
                <Mic className="w-10 h-10" />
              </button>

              <div className="space-y-2">
                <input
                  type="text"
                  value={recognizedText}
                  onChange={e => setRecognizedText(e.target.value)}
                  placeholder="e.g. Soh apple, Kper syntiew, Kot"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-center text-lg font-bold focus:ring-2 focus:ring-rose-500 outline-none"
                />
                <button
                  onClick={handleSubmitRecall}
                  disabled={!recognizedText.trim()}
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-base rounded-2xl shadow transition disabled:opacity-50"
                >
                  {t('btn.submit')}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-6 text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 bg-rose-600 text-white rounded-full flex items-center justify-center mx-auto shadow-xl">
            <Trophy className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">🎉 {t('feedback.activityComplete')}</h3>
            <p className="text-xs text-slate-600 mt-1">
              {t('game.wordsRemembered')} <strong>{completionData?.matchCount} / {targetWords.length}</strong> ({completionData?.accuracy}%)
            </p>
          </div>

          {completionData && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-4 bg-white p-4 rounded-2xl border border-rose-200 shadow-sm">
                <div className="flex items-center gap-1.5 text-amber-600 font-extrabold text-base">
                  <Star className="w-5 h-5 fill-current" /> +{completionData.rewards.mindPointsEarned} {t('game.mindPoints')}
                </div>
                <div className="h-6 w-px bg-slate-200"></div>
                <div className="flex items-center gap-1.5 text-rose-700 font-extrabold text-base">
                  <Zap className="w-5 h-5 fill-current" /> +{completionData.rewards.xpEarned} {t('game.xp')}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => initializeGame()}
              className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm rounded-xl shadow-md transition"
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
