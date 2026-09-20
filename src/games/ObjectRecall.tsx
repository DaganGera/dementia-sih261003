import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ArrowLeft, RefreshCw, Trophy, Sparkles, Eye, CheckCircle2 } from 'lucide-react';
import { StorageService } from '../services/storage';
import { AIEngineService } from '../services/ai';
import { useI18n } from '../i18n';
import { TextToSpeechService } from '../services/textToSpeech';

interface Item {
  id: string;
  nameKey: string;
  emoji: string;
}

const OBJECT_POOL: Item[] = [
  { id: '1', nameKey: 'Teapot', emoji: '🫖' },
  { id: '2', nameKey: 'Glasses', emoji: '👓' },
  { id: '3', nameKey: 'Key', emoji: '🔑' },
  { id: '4', nameKey: 'Clock', emoji: '⏰' },
  { id: '5', nameKey: 'Umbrella', emoji: '☂️' },
  { id: '6', nameKey: 'Vase', emoji: '🏺' },
  { id: '7', nameKey: 'Book', emoji: '📖' },
  { id: '8', nameKey: 'Hand Fan', emoji: '🪭' },
];

interface ObjectRecallProps {
  onBack: () => void;
}

export const ObjectRecall: React.FC<ObjectRecallProps> = ({ onBack }) => {
  const { language, t } = useI18n();
  const [targetCount, setTargetCount] = useState<number>(4);
  const [targetObjects, setTargetObjects] = useState<Item[]>([]);
  const [isMemorizing, setIsMemorizing] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(6);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [sessionResult, setSessionResult] = useState<any>(null);

  const speakInLang = (text: string) => {
    TextToSpeechService.speak(text, language);
  };

  const startNewGame = (count = targetCount) => {
    const shuffled = [...OBJECT_POOL].sort(() => Math.random() - 0.5);
    const selectedTargets = shuffled.slice(0, count);
    setTargetObjects(selectedTargets);
    setIsMemorizing(true);
    setCountdown(6);
    setSelectedIds([]);
    setGameOver(false);
    setSessionResult(null);

    let observeMsg = `Observe these ${count} objects carefully. You have 6 seconds.`;
    if (language === 'kha') {
      observeMsg = `Kynmaw bniah ïa kine ki ${count} tylli ki mar. Phi don 6 sec.`;
    } else if (language === 'as') {
      observeMsg = `এই ${count} টা বস্তু মনোযোগেৰে চাওক। আপোনাৰ হাতত ৬ ছেকেণ্ড সময় আছে।`;
    } else if (language === 'bn') {
      observeMsg = `এই ${count} টি জিনিস মনোযোগ দিয়ে দেখুন। আপনার কাছে ৬ সেকেন্ড সময় আছে।`;
    } else if (language === 'ny') {
      observeMsg = `Si ${count}ta saman khedapnam chika. 6 sec dwnam.`;
    } else if (language === 'mni') {
      observeMsg = `পোৎলম ${count} অসি খোপ্না য়েংবীয়ু। অদোমগী ৬ সেকেন্দ লৈ।`;
    } else if (language === 'lus') {
      observeMsg = `Heng bungraw ${count} te hi uluk takin en rawh. Chawlkar 6 i nei.`;
    } else if (language === 'nag') {
      observeMsg = `Etu ${count} ta saman bhal pra sabhi. Apuni laga 6 sec time ase.`;
    }

    speakInLang(observeMsg);
  };

  useEffect(() => {
    startNewGame();
  }, [targetCount]);

  useEffect(() => {
    let timer: any = null;
    if (isMemorizing && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    } else if (isMemorizing && countdown === 0) {
      setIsMemorizing(false);
      let timeUpMsg = `Time is up! Select the ${targetCount} objects you just saw.`;
      if (language === 'kha') {
        timeUpMsg = `La kut ka por! Jied ïa ki ${targetCount} tylli ki mar ba phi la ïohi.`;
      } else if (language === 'as') {
        timeUpMsg = `সময় উকলিল! আপুনি দেখা ${targetCount} টা বস্তু বাছক।`;
      } else if (language === 'bn') {
        timeUpMsg = `সময় শেষ! আপনি দেখা ${targetCount} টি জিনিস নির্বাচন করুন।`;
      } else if (language === 'ny') {
        timeUpMsg = `Time poba dope! No chikam ${targetCount}ta saman basika.`;
      } else if (language === 'mni') {
        timeUpMsg = `মতম লোইরে! অদোম্না উখিবা পোৎলম ${targetCount} অদু খনগৎলু।`;
      } else if (language === 'lus') {
        timeUpMsg = `Hun a tawp! Thil ${targetCount} i hmuh zo chiah te kha thlang rawh.`;
      } else if (language === 'nag') {
        timeUpMsg = `Time khotom hoise! Apuni dekhi thaka ${targetCount} ta saman chunibi.`;
      }
      speakInLang(timeUpMsg);
    }
    return () => clearInterval(timer);
  }, [isMemorizing, countdown, language]);

  const toggleSelectObject = (id: string) => {
    if (gameOver || isMemorizing) return;
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      if (selectedIds.length < targetCount) {
        setSelectedIds([...selectedIds, id]);
      }
    }
  };

  const handleSubmitAnswers = () => {
    if (selectedIds.length === 0) return;

    setGameOver(true);

    const correctCount = selectedIds.filter(id => targetObjects.some(t => t.id === id)).length;
    const accuracy = Math.round((correctCount / targetCount) * 100);

    if (accuracy >= 75) {
      confetti({ particleCount: 75, spread: 60 });
    }

    const metrics = AIEngineService.calculateSessionMetrics(
      accuracy,
      40,
      1,
      targetCount - 2,
      'recall'
    );

    const session = StorageService.saveGameSession({
      gameId: 'object-recall',
      gameTitle: 'Object Recall',
      category: 'recall',
      score: metrics.cognitiveScore,
      accuracy: metrics.accuracy,
      timeSeconds: 40,
      difficultyLevel: targetCount - 2,
    });

    setSessionResult({ session, metrics, correctCount });
    let finishMsg = `You identified ${correctCount} out of ${targetCount} objects correctly.`;
    if (language === 'kha') {
      finishMsg = `Phi la jied beit ${correctCount} na ki ${targetCount} tylli ki mar.`;
    } else if (language === 'as') {
      finishMsg = `আপুনি ${targetCount} টাৰ ভিতৰত ${correctCount} টা বস্তু সঠিকভাৱে বাছিলে।`;
    } else if (language === 'ny') {
      finishMsg = `No ${targetCount} ho ${correctCount}ta saman sahi basikam.`;
    } else if (language === 'mni') {
      finishMsg = `অদোম্না পোৎলম ${targetCount} গী মনুংদা ${correctCount} চুম্না খংলে।`;
    }
    speakInLang(finishMsg);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 border border-slate-200 shadow-xl text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-bold transition text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> {t('btn.back')}
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-extrabold">{t('games.objectRecall')}</h2>
          <span className="text-xs bg-purple-100 text-purple-800 font-extrabold px-3 py-0.5 rounded-full">
            {targetCount} {t('game.objects')}
          </span>
        </div>

        <button
          onClick={() => startNewGame()}
          className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition"
          title="Restart Game"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Memorization Stage */}
      {isMemorizing ? (
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-900 font-extrabold rounded-2xl text-lg">
            <Eye className="w-5 h-5 text-purple-600 animate-pulse" /> {t('game.memorizeObjects')} ({countdown}{t('game.seconds')})
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {targetObjects.map(obj => (
              <div
                key={obj.id}
                className="bg-gradient-to-b from-slate-50 to-purple-50 border-2 border-purple-200 p-6 rounded-3xl text-center shadow-md animate-fade-in"
              >
                <div className="text-5xl mb-2">{obj.emoji}</div>
                <div className="font-extrabold text-base text-slate-900">{obj.nameKey}</div>
              </div>
            ))}
          </div>
        </div>
      ) : !gameOver ? (
        /* Selection Stage */
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-xl font-extrabold text-slate-900">{t('game.whatObjectsSaw')}</h3>
            <p className="text-xs text-slate-500 mt-1">{t('game.selectObjects')}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {OBJECT_POOL.map(obj => {
              const isSelected = selectedIds.includes(obj.id);
              return (
                <button
                  key={obj.id}
                  onClick={() => toggleSelectObject(obj.id)}
                  className={`p-4 rounded-2xl text-center border-2 transition transform active:scale-95 flex flex-col items-center ${
                    isSelected
                      ? 'bg-purple-100 border-purple-600 ring-4 ring-purple-300 font-bold scale-105'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-4xl mb-1">{obj.emoji}</div>
                  <div className="text-sm font-extrabold text-slate-900">{obj.nameKey}</div>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleSubmitAnswers}
            disabled={selectedIds.length === 0}
            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-lg rounded-2xl shadow-lg transition disabled:opacity-50"
          >
            {t('btn.submit')} ({selectedIds.length} / {targetCount} {t('game.selected')})
          </button>
        </div>
      ) : (
        /* Result Stage */
        <div className="bg-purple-50 border-2 border-purple-300 rounded-3xl p-6 text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center mx-auto shadow-xl">
            <Trophy className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">{t('feedback.activityComplete')}</h3>
            <p className="text-sm text-slate-600 mt-1">
              {t('game.identifiedObjects')} {sessionResult?.correctCount} / {targetCount} {t('game.objects')}!
            </p>
          </div>

          {sessionResult && (
            <div className="bg-white p-4 rounded-2xl border border-purple-200 space-y-2 text-left">
              <div className="flex justify-between items-center text-sm font-bold text-slate-800">
                <span>{t('game.cognitiveScore')}:</span>
                <span className="text-purple-700 text-lg">{sessionResult.metrics.cognitiveScore} / 100</span>
              </div>
              <div className="pt-2 border-t border-slate-100 text-xs text-purple-900 font-semibold flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span><strong>{t('game.aiRecommendation')}:</strong> {sessionResult.metrics.recommendationReason}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => startNewGame()}
              className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl shadow-md transition"
            >
              {t('btn.playAgain')}
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition"
            >
              {t('btn.back')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
