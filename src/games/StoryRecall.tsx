import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ArrowLeft, RefreshCw, Trophy, Sparkles, BookOpen, CheckCircle2 } from 'lucide-react';
import { StorageService } from '../services/storage';
import { AIEngineService } from '../services/ai';
import { useI18n } from '../i18n';
import { TextToSpeechService } from '../services/textToSpeech';

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
}

const STORIES_BY_LANG: Record<string, { title: string; text: string; questions: Question[] }> = {
  kha: {
    title: 'Ka Step ba kmen ha Kper Syntiew',
    text: 'Ka Meieit Meena ka la leit sha kper syntiew bad ka khun jong ka ka Anitha ha ka por 10:30 AM. Ki la kheit 3 tylli ki tiewkulab basaw bad dih sha sngiang lang.',
    questions: [
      {
        id: 1,
        question: 'Shaei ka Meieit Meena ka la leit bad ka Anitha?',
        options: ['Sha Kper Syntiew', 'Sha Iew Bah', 'Sha Station'],
        correctAnswer: 'Sha Kper Syntiew',
      },
      {
        id: 2,
        question: 'Kiei ki syntiew ba ki la kheit?',
        options: ['3 Tylli ki Tiewkulab basaw', '5 Tylli ki Tiewstem', 'Ki Tiewlieh'],
        correctAnswer: '3 Tylli ki Tiewkulab basaw',
      },
      {
        id: 3,
        question: 'Kaei ba ki la dih lang?',
        options: ['Ka Sha sngiang', 'Ka Dud', 'Ka Umsoh'],
        correctAnswer: 'Ka Sha sngiang',
      },
    ],
  },
  as: {
    title: 'ফুলনি বাগিচাত ৰৌদ্ৰোজ্জ্বল পুৱা',
    text: 'আইতা মীনাই তেওঁৰ জীয়াৰী অনিতাৰ সৈতে পুৱা ১০:৩০ বজাত ফুলনি বাগিচালৈ গৈছিল। তেওঁলোকে ৩ পাহ ৰঙা গোলাপ ফুল চিঙিলে আৰু পখিলা চাই চাই গৰম আদা চাহ খালে।',
    questions: [
      {
        id: 1,
        question: 'আইতা মীনা অনিতাৰ সৈতে ক’লৈ গৈছিল?',
        options: ['ফুলনি বাগিচালৈ', 'বজাৰলৈ', 'ৰে’ল ষ্টেচনলৈ'],
        correctAnswer: 'ফুলনি বাগিচালৈ',
      },
      {
        id: 2,
        question: 'তেওঁলোকে কি ফুল চিঙিলে?',
        options: ['৩ পাহ ৰঙা গোলাপ', '৫ পাহ হালধীয়া গাঁদা', 'বগা বেলি ফুল'],
        correctAnswer: '৩ পাহ ৰঙা গোলাপ',
      },
      {
        id: 3,
        question: 'তেওঁলোকে একেলগে কি খালে?',
        options: ['গৰম আদা চাহ', 'গাখীৰ', 'কমলাৰ ৰস'],
        correctAnswer: 'গৰম আদা চাহ',
      },
    ],
  },
  bn: {
    title: 'ফুলের বাগানে সুন্দর সকাল',
    text: 'ঠাকুমা মীনা তাঁর মেয়ে অনিতার সাথে সকাল ১০:৩০ টায় বাগানে গিয়েছিলেন। তাঁরা ৩টি লাল গোলাপ তুললেন এবং প্রজাপতি দেখতে দেখতে গরম আদা চা খেলেন।',
    questions: [
      {
        id: 1,
        question: 'ঠাকুমা মীনা অনিতার সাথে কোথায় গিয়েছিলেন?',
        options: ['ফুলের বাগানে', 'শহরের বাজারে', 'রেল স্টেশনে'],
        correctAnswer: 'ফুলের বাগানে',
      },
      {
        id: 2,
        question: 'তাঁরা কি ফুল তুলেছিলেন?',
        options: ['৩টি লাল গোলাপ', '৫টি হলুদ গাঁদা', 'সাদা জবা'],
        correctAnswer: '৩টি লাল গোলাপ',
      },
      {
        id: 3,
        question: 'তাঁরা একসাথে কি পান করেছিলেন?',
        options: ['গরম আদা চা', 'তাজা দুধ', 'কমলার জুস'],
        correctAnswer: 'গরম আদা চা',
      },
    ],
  },
  mni: {
    title: 'লৈরাং লৈফমদা অয়ুক্কী ফজবা নুমিৎ',
    text: 'ইবেন মীনানা মহাক্কী ইচানুপী অনিতাগা লোয়ননা অয়ুক ১০:৩০ দা লৈরাং লৈফমদা চৎখি। মখোয়না ইরাং বাক্পা ৩ খাইখ্রগা পখিলা য়েংলগা শিঙদা চা থকখি।',
    questions: [
      {
        id: 1,
        question: 'ইবেন মীনা অনিতাগা কদাইদা চৎখিবগে?',
        options: ['লৈরাং লৈফমদা', 'কৈথেলদা', 'ষ্টেশনদা'],
        correctAnswer: 'লৈরাং লৈফমদা',
      },
      {
        id: 2,
        question: 'মখোয়না করি লৈরাং খাইখিবগে?',
        options: ['ইরাং বাক্পা ৩', 'মচু অঙাংবা ৫', 'অঙৌবা গোলাপ'],
        correctAnswer: 'ইরাং বাক্পা ৩',
      },
      {
        id: 3,
        question: 'মখোয়না পুন্না করি থকখিবগে?',
        options: ['শিঙদা চা', 'সংগোম', 'জুস'],
        correctAnswer: 'শিঙদা চা',
      },
    ],
  },
  ny: {
    title: 'Gwnam Lwnyi Phool Bagan Lw',
    text: 'Meena Sharma ome Anitha lwngpa 10:30 AM lw phool bagan lw wlasang. Tai 3ta red gulap phool hapkan aro gwnam cha donam.',
    questions: [
      {
        id: 1,
        question: 'Meena Sharma Anitha lwngpa kot wlasang?',
        options: ['Phool Bagan Lw', 'Bazar Lw', 'Station Lw'],
        correctAnswer: 'Phool Bagan Lw',
      },
      {
        id: 2,
        question: 'Siyo ki phool hapkan?',
        options: ['3ta Red Gulap', '5ta Peet Gulap', 'White Phool'],
        correctAnswer: '3ta Red Gulap',
      },
      {
        id: 3,
        question: 'Siyo lwngpa ki donam?',
        options: ['Gwnam Cha', 'Dudh', 'Juice'],
        correctAnswer: 'Gwnam Cha',
      },
    ],
  },
  lus: {
    title: 'Huan thala ni mawi tak',
    text: 'Pipi Meena-i chu a fanu Anitha-i nen zing dar 10:30 ah huanah an kal a. Rose sen 3 an thliah a, thingpui sa rualin phetlep mawi tak tak an thlir dun a ni.',
    questions: [
      {
        id: 1,
        question: 'Pipi Meena-i leh Anitha-i khawi ah nge an kal?',
        options: ['Phool Huanah', 'Dawr Hmunah', 'Rel Station-ah'],
        correctAnswer: 'Phool Huanah',
      },
      {
        id: 2,
        question: 'Huanah khan pangpar engzat nge an thliah?',
        options: ['Rose sen 3', 'Bawngthah eng 5', 'Jasmine var'],
        correctAnswer: 'Rose sen 3',
      },
      {
        id: 3,
        question: 'Tlang takin eng nge an in dun?',
        options: ['Thingpui sa', 'Bawnghnute', 'Serhtui'],
        correctAnswer: 'Thingpui sa',
      },
    ],
  },
  nag: {
    title: 'Phool Bagan te Dhup Din',
    text: 'Aima Meena tai laga baji Anitha logote 10:30 AM te phool bagan te jaise. Tai khan 3 ta lall gulaab phool thulise aru garam aada cha khaise.',
    questions: [
      {
        id: 1,
        question: 'Aima Meena Anitha logote kot jaise?',
        options: ['Phool Bagan te', 'Bazar te', 'Station te'],
        correctAnswer: 'Phool Bagan te',
      },
      {
        id: 2,
        question: 'Tai khan ki phool thulise?',
        options: ['3 ta Lall Gulaab', '5 ta Pila Phool', 'Sada Phool'],
        correctAnswer: '3 ta Lall Gulaab',
      },
      {
        id: 3,
        question: 'Tai khan logote ki khaise?',
        options: ['Garam Aada Cha', 'Dudh', 'Juice'],
        correctAnswer: 'Garam Aada Cha',
      },
    ],
  },
  default: {
    title: 'A Sunny Morning in the Garden',
    text: 'Grandma Meena went to the garden with her daughter Anitha at 10:30 AM. They picked 3 red roses and drank warm ginger tea together while watching colorful butterflies.',
    questions: [
      {
        id: 1,
        question: 'Where did Grandma Meena go with Anitha?',
        options: ['The Flower Garden', 'The City Market', 'The Railway Station'],
        correctAnswer: 'The Flower Garden',
      },
      {
        id: 2,
        question: 'What flowers did they pick in the garden?',
        options: ['3 Red Roses', '5 Yellow Marigolds', 'White Jasmine'],
        correctAnswer: '3 Red Roses',
      },
      {
        id: 3,
        question: 'What beverage did they drink together?',
        options: ['Warm Ginger Tea', 'Fresh Milk', 'Orange Juice'],
        correctAnswer: 'Warm Ginger Tea',
      },
    ],
  },
};

interface StoryRecallProps {
  onBack: () => void;
}

export const StoryRecall: React.FC<StoryRecallProps> = ({ onBack }) => {
  const { language, t } = useI18n();
  const [readStory, setReadStory] = useState<boolean>(true);
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [sessionResult, setSessionResult] = useState<any>(null);

  const activeStory = STORIES_BY_LANG[language] || STORIES_BY_LANG.default;

  const speakInLang = (text: string) => {
    TextToSpeechService.speak(text, language);
  };

  useEffect(() => {
    speakInLang(`${activeStory.title}. ${activeStory.text}`);
  }, [language]);

  const handleStartQuestions = () => {
    setReadStory(false);
    speakInLang(activeStory.questions[0].question);
  };

  const handleAnswerSelect = (option: string) => {
    const q = activeStory.questions[questionIndex];
    const newAnswers = { ...userAnswers, [q.id]: option };
    setUserAnswers(newAnswers);

    if (questionIndex + 1 < activeStory.questions.length) {
      setQuestionIndex(i => i + 1);
      speakInLang(activeStory.questions[questionIndex + 1].question);
    } else {
      // Calculate final score
      let correctCount = 0;
      activeStory.questions.forEach(quest => {
        if (newAnswers[quest.id] === quest.correctAnswer) {
          correctCount += 1;
        }
      });

      setGameOver(true);
      const accuracy = Math.round((correctCount / activeStory.questions.length) * 100);
      confetti({ particleCount: 70, spread: 60 });

      const metrics = AIEngineService.calculateSessionMetrics(
        accuracy,
        45,
        1,
        2,
        'recall'
      );

      const session = StorageService.saveGameSession({
        gameId: 'story-recall',
        gameTitle: 'Story Recall',
        category: 'recall',
        score: metrics.cognitiveScore,
        accuracy: metrics.accuracy,
        timeSeconds: 45,
        difficultyLevel: 2,
      });

      setSessionResult({ session, metrics, correctCount, accuracy });
      let doneMsg = `Story recall complete! You answered ${correctCount} out of ${activeStory.questions.length} questions correctly.`;
      if (language === 'kha') {
        doneMsg = `La dep ka jingpynkynmaw puriskam! Phi la jubab beit ${correctCount} na ki ${activeStory.questions.length} tylli ki jingkylli.`;
      } else if (language === 'as') {
        doneMsg = `সাধু স্মৃতি সম্পূৰ্ণ হ’ল! আপুনি ${activeStory.questions.length} টাৰ ভিতৰত ${correctCount} টা প্ৰশ্নৰ সঠিক উত্তৰ দিলে।`;
      } else if (language === 'ny') {
        doneMsg = `Kahani minyi dope! No ${activeStory.questions.length} ho ${correctCount} question sahi agkam.`;
      } else if (language === 'mni') {
        doneMsg = `ৱারী নীংশিংবা লোইরে! অদোম্না ৱাহং ${activeStory.questions.length} গী মনুংদা ${correctCount} পাউখুম চুম্না পীখ্রে।`;
      }
      speakInLang(doneMsg);
    }
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
          <h2 className="text-2xl font-extrabold">{t('games.storyRecall')}</h2>
          <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-3 py-0.5 rounded-full">
            {t('cat.recall')}
          </span>
        </div>

        <div className="w-8"></div>
      </div>

      {readStory ? (
        /* Reading Story Stage */
        <div className="space-y-6 max-w-lg mx-auto">
          <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-3xl shadow-sm text-center">
            <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 mb-2">{activeStory.title}</h3>
            <p className="text-base text-slate-700 leading-relaxed font-medium">"{activeStory.text}"</p>
          </div>

          <button
            onClick={handleStartQuestions}
            className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-lg rounded-2xl shadow-lg transition"
          >
            {t('game.readyForQuestions')}
          </button>
        </div>
      ) : !gameOver ? (
        /* Answering Questions Stage */
        <div className="space-y-6 max-w-md mx-auto">
          <div className="text-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-xs uppercase font-extrabold text-amber-700 tracking-wider">
              {t('game.question')} {questionIndex + 1} {t('game.of')} {activeStory.questions.length}
            </span>
            <h3 className="text-lg font-extrabold text-slate-900 mt-1">
              {activeStory.questions[questionIndex].question}
            </h3>
          </div>

          <div className="space-y-3">
            {activeStory.questions[questionIndex].options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswerSelect(opt)}
                className="w-full py-4 px-6 bg-white hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-2xl text-left font-extrabold text-base text-slate-900 shadow-sm transition transform active:scale-98"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Game Over Stage */
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 bg-amber-600 text-white rounded-full flex items-center justify-center mx-auto shadow-xl">
            <Trophy className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">{t('feedback.activityComplete')}</h3>
            <p className="text-sm text-slate-600 mt-1">
              {t('feedback.greatWork')}
            </p>
          </div>

          {sessionResult && (
            <div className="bg-white p-4 rounded-2xl border border-amber-200 space-y-2 text-left">
              <div className="flex justify-between items-center text-sm font-bold text-slate-800">
                <span>{t('game.accuracy')}:</span>
                <span className="text-amber-700 text-lg">{sessionResult.accuracy}%</span>
              </div>
              <div className="pt-2 border-t border-slate-100 text-xs text-amber-900 font-semibold flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span><strong>{t('game.aiRecommendation')}:</strong> {sessionResult.metrics.recommendationReason}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={onBack}
              className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl shadow-md transition"
            >
              {t('btn.back')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
