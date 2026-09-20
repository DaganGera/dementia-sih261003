import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ArrowLeft, RefreshCw, Trophy, Sparkles, Play } from 'lucide-react';
import { StorageService } from '../services/storage';
import { AIEngineService } from '../services/ai';
import { useI18n } from '../i18n';
import { TextToSpeechService } from '../services/textToSpeech';

const COLORS = [
  { id: 'red', color: 'bg-red-500 hover:bg-red-600 border-red-700', activeColor: 'bg-red-300 ring-8 ring-red-400', labelKey: 'Red 🔴' },
  { id: 'blue', color: 'bg-blue-500 hover:bg-blue-600 border-blue-700', activeColor: 'bg-blue-300 ring-8 ring-blue-400', labelKey: 'Blue 🔵' },
  { id: 'green', color: 'bg-emerald-500 hover:bg-emerald-600 border-emerald-700', activeColor: 'bg-emerald-300 ring-8 ring-emerald-400', labelKey: 'Green 🟢' },
  { id: 'yellow', color: 'bg-amber-400 hover:bg-amber-500 border-amber-600', activeColor: 'bg-amber-200 ring-8 ring-amber-300', labelKey: 'Yellow 🟡' },
];

interface SequenceRecallProps {
  onBack: () => void;
}

export const SequenceRecall: React.FC<SequenceRecallProps> = ({ onBack }) => {
  const { language, t } = useI18n();
  const [sequenceLength, setSequenceLength] = useState<number>(3); // 3 items for level 1
  const [sequence, setSequence] = useState<string[]>([]);
  const [userSequence, setUserSequence] = useState<string[]>([]);
  const [isShowingSequence, setIsShowingSequence] = useState<boolean>(false);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [attempts, setAttempts] = useState<number>(1);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [sessionResult, setSessionResult] = useState<any>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());

  const speakInLang = (text: string) => {
    TextToSpeechService.speak(text, language);
  };

  const generateSequence = (len = sequenceLength) => {
    const seq: string[] = [];
    for (let i = 0; i < len; i++) {
      const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)].id;
      seq.push(randomColor);
    }
    setSequence(seq);
    setUserSequence([]);
    setStepIndex(0);
    setGameOver(false);
    setSessionResult(null);
    playSequence(seq);
  };

  const playSequence = async (seq: string[]) => {
    setIsShowingSequence(true);
    let watchMsg = 'Watch the sequence carefully.';
    if (language === 'kha') {
      watchMsg = 'Peit bniah ïa ka jingpynbeit rong.';
    } else if (language === 'as') {
      watchMsg = 'ৰঙৰ ক্ৰমটো মনোযোগেৰে চাওক।';
    } else if (language === 'bn') {
      watchMsg = 'রঙের ক্রমটি মনোযোগ দিয়ে দেখুন।';
    } else if (language === 'ne') {
      watchMsg = 'रंगको क्रम ध्यानपूर्वक हेर्नुहोस्।';
    } else if (language === 'ny') {
      watchMsg = 'Rong sequence kadope kape gwrka.';
    } else if (language === 'mni') {
      watchMsg = 'মচু সম্বন্ধ অসি চেকশিন্না য়েংবীয়ু।';
    } else if (language === 'lus') {
      watchMsg = 'A dawt hi uluk takin thlir rawh.';
    } else if (language === 'nag') {
      watchMsg = 'Rong laga sequence bhal pra sabhi.';
    }
    speakInLang(watchMsg);
    
    await new Promise(r => setTimeout(r, 1000));

    for (let i = 0; i < seq.length; i++) {
      const colorId = seq[i];
      const colorObj = COLORS.find(c => c.id === colorId);
      setActiveColor(colorId);
      if (colorObj) speakInLang(colorObj.labelKey);
      await new Promise(r => setTimeout(r, 800));
      setActiveColor(null);
      await new Promise(r => setTimeout(r, 300));
    }

    setIsShowingSequence(false);
    setStartTime(Date.now());
    let nowTapMsg = 'Now tap the buttons in the same sequence.';
    if (language === 'kha') {
      nowTapMsg = 'Mynta pynïahap biang ïa ki rong ha kajuh ka rukom.';
    } else if (language === 'as') {
      nowTapMsg = 'এতিয়া একে ক্ৰমত বুটামবোৰ টিপক।';
    } else if (language === 'bn') {
      nowTapMsg = 'এখন একই ক্রমে বোতামগুলো চাপুন।';
    } else if (language === 'ne') {
      nowTapMsg = 'अब उही क्रममा बटनहरू थिच्नुहोस्।';
    } else if (language === 'ny') {
      nowTapMsg = 'Lwnyi button khakhaan kape daban.';
    } else if (language === 'mni') {
      nowTapMsg = 'হৌজিক মসিগী মথং-মনাও অসিগুম্না বোতামশিং অদু নম্বীয়ু।';
    } else if (language === 'lus') {
      nowTapMsg = 'Tunah chuan a dawt inzawm chiah in button hi hmet rawh.';
    } else if (language === 'nag') {
      nowTapMsg = 'Etiya ekohi sequence te button dabi.';
    }
    speakInLang(nowTapMsg);
  };

  useEffect(() => {
    generateSequence();
  }, [sequenceLength]);

  const handleColorClick = (colorId: string) => {
    if (isShowingSequence || gameOver) return;

    const colorObj = COLORS.find(c => c.id === colorId);
    if (colorObj) speakInLang(colorObj.labelKey);

    const nextUserSeq = [...userSequence, colorId];
    setUserSequence(nextUserSeq);

    const currentIndex = nextUserSeq.length - 1;

    if (colorId !== sequence[currentIndex]) {
      // Mistake made
      let mistakeMsg = 'Oops, incorrect color. Try watching the sequence again.';
      if (language === 'kha') {
        mistakeMsg = 'Bakla khyndiat. Ngin peit biang ïa ka rukom pynbeit.';
      } else if (language === 'as') {
        mistakeMsg = 'ভুল হৈছে। আহক আকৌ ক্ৰমটো চাওঁ।';
      } else if (language === 'bn') {
        mistakeMsg = 'ভুল হয়েছে। আবার দেখুন।';
      } else if (language === 'ny') {
        mistakeMsg = 'Sangeh, rong pat dei. Kape kanam.';
      }
      speakInLang(mistakeMsg);
      setAttempts(a => a + 1);
      setTimeout(() => {
        setUserSequence([]);
        playSequence(sequence);
      }, 1000);
      return;
    }

    // Correct color step
    if (nextUserSeq.length === sequence.length) {
      // Completed full sequence correctly!
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);
      setGameOver(true);
      confetti({ particleCount: 70, spread: 50 });

      const accuracy = Math.round((sequence.length / (sequence.length + attempts - 1)) * 100);
      const metrics = AIEngineService.calculateSessionMetrics(
        accuracy,
        durationSeconds,
        attempts,
        sequenceLength - 2,
        'attention'
      );

      const session = StorageService.saveGameSession({
        gameId: 'sequence-recall',
        gameTitle: 'Sequence Recall',
        category: 'attention',
        score: metrics.cognitiveScore,
        accuracy: metrics.accuracy,
        timeSeconds: durationSeconds,
        difficultyLevel: sequenceLength - 2,
        attempts,
      });

      setSessionResult({ session, metrics });
      let winMsg = `Splendid! Sequence reproduced perfectly with ${accuracy} percent accuracy.`;
      if (language === 'kha') {
        winMsg = `Bha shibun! Phi la pynïahap biang ïa ki rong da ${accuracy} percent jingshisha.`;
      } else if (language === 'as') {
        winMsg = `অতি উত্তম! আপুনি ${accuracy} শতাংশ শুদ্ধতাৰে ক্ৰমটো সম্পূৰ্ণ কৰিলে।`;
      } else if (language === 'ny') {
        winMsg = `Ayi gwrbope! No ${accuracy} percent sahi pattern dwnkam.`;
      } else if (language === 'mni') {
        winMsg = `য়াম্না ফরে! অদোম্না ${accuracy} শতাংশ চুম্না পরিং অদু লোইখ্রে।`;
      }
      speakInLang(winMsg);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 border border-[#E4DED4] shadow-xs text-[#26332F]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E4DED4]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 bg-[#F4EBD7] hover:bg-[#ecdcb9] rounded-xl text-[#26332F] font-bold transition text-sm border border-[#E4DED4] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> {t('btn.back')}
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-extrabold">{t('games.sequence')}</h2>
          <span className="text-xs bg-[#DDE9D9] text-[#176B61] font-extrabold px-3 py-0.5 rounded-full border border-[#B7D4CC]">
            {sequenceLength} {t('game.stepsPattern')}
          </span>
        </div>

        <button
          onClick={() => generateSequence()}
          className="p-2 bg-[#F4EBD7] hover:bg-[#ecdcb9] rounded-xl text-[#26332F] transition border border-[#E4DED4] cursor-pointer"
          title="Replay Pattern"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Status banner */}
      <div className="text-center mb-6">
        {isShowingSequence ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F4E4C8] text-[#26332F] font-extrabold rounded-2xl animate-pulse text-base border border-[#E4DED4]">
            <Play className="w-5 h-5 text-[#176B61]" /> {t('game.watchSequence')}
          </div>
        ) : !gameOver ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#DDE9D9] text-[#176B61] font-extrabold rounded-2xl text-base border border-[#B7D4CC]">
            {t('game.reproduceSequence')} ({userSequence.length} / {sequence.length})
          </div>
        ) : null}
      </div>

      {!gameOver ? (
        <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-6">
          {COLORS.map(c => {
            const isActive = activeColor === c.id;
            return (
              <button
                key={c.id}
                onClick={() => handleColorClick(c.id)}
                disabled={isShowingSequence}
                className={`h-32 rounded-3xl text-white font-extrabold text-lg flex items-center justify-center border-4 transition transform active:scale-95 shadow-md cursor-pointer ${
                  isActive ? c.activeColor : c.color
                }`}
              >
                {c.labelKey}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#FAF9F4] border border-[#E4DED4] rounded-3xl p-6 text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 bg-[#DDE9D9] text-[#176B61] rounded-full flex items-center justify-center mx-auto shadow-xs border border-[#B7D4CC]">
            <Trophy className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-[#26332F]">{t('feedback.activityComplete')}</h3>
            <p className="text-sm text-[#66736D] mt-1">{t('feedback.greatWork')}</p>
          </div>

          {sessionResult && (
            <div className="bg-white p-4 rounded-2xl border border-[#E4DED4] space-y-2 text-left shadow-xs">
              <div className="flex justify-between items-center text-sm font-bold text-[#26332F]">
                <span>{t('game.cognitiveScore')}:</span>
                <span className="text-[#176B61] text-lg font-extrabold">{sessionResult.metrics.cognitiveScore} / 100</span>
              </div>
              <div className="flex justify-between items-center text-xs text-[#66736D]">
                <span>{t('game.stepsPattern')}:</span>
                <span className="font-bold text-[#26332F]">{sequenceLength} {t('game.stepsPattern')}</span>
              </div>
              <div className="pt-2 border-t border-[#E4DED4] text-xs text-[#26332F] font-semibold flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-[#176B61] shrink-0 mt-0.5" />
                <span><strong>AI Feedback:</strong> {sessionResult.metrics.recommendationReason}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                setSequenceLength(s => Math.min(6, s + 1));
              }}
              className="flex-1 py-3 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold rounded-xl shadow-xs transition cursor-pointer"
            >
              {t('btn.playAgain')} ({sequenceLength + 1} steps)
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-3 bg-[#F4EBD7] hover:bg-[#ecdcb9] text-[#26332F] font-bold rounded-xl transition border border-[#E4DED4] cursor-pointer"
            >
              {t('btn.back')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
