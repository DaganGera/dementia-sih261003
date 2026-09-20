import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { ArrowLeft, RefreshCw, Trophy, Sparkles, Heart, CheckCircle2, UserCheck, User } from 'lucide-react';
import { StorageService } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { AIEngineService } from '../services/ai';
import { useI18n } from '../i18n';
import { TextToSpeechService } from '../services/textToSpeech';
import { FamiliarPerson } from '../types';

interface NameFaceMemoryProps {
  onBack: () => void;
}

export const NameFaceMemory: React.FC<NameFaceMemoryProps> = ({ onBack }) => {
  const { language, t } = useI18n();
  const { user, role } = useAuth();

  const activePatientId =
    StorageService.getActivePatientId(user?.id) ||
    (user?.id && user.role !== 'caregiver' ? user.id : undefined);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [people, setPeople] = useState<FamiliarPerson[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [scoreCount, setScoreCount] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [sessionResult, setSessionResult] = useState<any>(null);

  const speakInLang = (text: string) => {
    TextToSpeechService.speak(text, language);
  };

  useEffect(() => {
    let isMounted = true;

    const loadPeople = async () => {
      setIsLoading(true);
      try {
        const targetId = activePatientId || StorageService.getActivePatientId(user?.id) || user?.id;
        let list: FamiliarPerson[] = await StorageService.fetchFamiliarPeopleFromCloud(targetId);
        if (!list || list.length === 0) {
          list = StorageService.getFamiliarPeople(targetId);
        }

        // Keep only valid entries created for this patient, filtering out legacy demo IDs
        const filtered = (list || [])
          .filter(p => p && p.name && p.name.trim() !== '' && p.id !== 'fp-1' && p.id !== 'fp-2' && p.id !== 'fp-3');

        // Deduplicate by name
        const seen = new Set<string>();
        const uniquePeople: FamiliarPerson[] = [];
        for (const p of filtered) {
          const norm = p.name.trim().toLowerCase();
          if (!seen.has(norm)) {
            seen.add(norm);
            uniquePeople.push({
              ...p,
              name: p.name.trim(),
              relationship: (p.relationship || '').trim(),
              photoUrl: (p.photoUrl || '').trim(),
            });
          }
        }

        if (isMounted) {
          setPeople(uniquePeople);
          setCurrentIndex(0);
          setGameOver(false);
          setSessionResult(null);
          setIsLoading(false);

          if (uniquePeople.length > 0) {
            let askMsg = 'Who is this family member? Select the correct name.';
            if (language === 'kha') {
              askMsg = 'Uei lane kaei kane ka baha-ïing? Jied ïa ka kyrteng ba dei.';
            } else if (language === 'as') {
              askMsg = 'এইজন পৰিয়ালৰ সদস্য কোন হয়? সঠিক নাম বাছক।';
            } else if (language === 'bn') {
              askMsg = 'ইনি পরিবারের কোন সদস্য? সঠিক নাম নির্বাচন করুন।';
            } else if (language === 'ne') {
              askMsg = 'यो परिवारको सदस्य को हुनुहुन्छ? सही नाम छान्नुहोस्।';
            } else if (language === 'ny') {
              askMsg = 'Si nyi hii kon dwnam? Naam sahi basika.';
            } else if (language === 'mni') {
              askMsg = 'ইমুংগী মীওই অসি কনানো? অচুম্বা মমিং খনগৎলু।';
            } else if (language === 'lus') {
              askMsg = 'He chhungte hi khawi ngei ngei nge? A hming dik zawk thlang rawh.';
            } else if (language === 'nag') {
              askMsg = 'Etu ghar manu kon ase? Sahi naam chunibi.';
            }
            speakInLang(askMsg);
          }
        }
      } catch (err) {
        console.warn('Error loading family members from profile:', err);
        if (isMounted) {
          setPeople([]);
          setIsLoading(false);
        }
      }
    };

    loadPeople();
    return () => { isMounted = false; };
  }, [language, activePatientId]);

  const currentPerson = people[currentIndex];

  const handleOptionSelect = (name: string) => {
    if (selectedAnswer !== null || !currentPerson) return;

    setSelectedAnswer(name);
    const correct = name === currentPerson.name;
    setIsCorrect(correct);

    if (correct) {
      setScoreCount(s => s + 1);
      let rightMsg = `Correct! That is ${currentPerson.name}, your ${currentPerson.relationship}.`;
      if (language === 'kha') {
        rightMsg = `Dei paka! Kane ka dei ${currentPerson.name}, ${currentPerson.relationship} jong phi.`;
      } else if (language === 'as') {
        rightMsg = `শুদ্ধ উত্তৰ! এইজন ${currentPerson.name}, আপোনাৰ ${currentPerson.relationship}।`;
      } else if (language === 'bn') {
        rightMsg = `সঠিক! ইনি ${currentPerson.name}, আপনার ${currentPerson.relationship}।`;
      } else if (language === 'ny') {
        rightMsg = `Sahi! Siyo ${currentPerson.name}, no laga ${currentPerson.relationship} e.`;
      } else if (language === 'mni') {
        rightMsg = `চুম্লে! মসিনা ${currentPerson.name}, অদোমগী ${currentPerson.relationship} নি।`;
      } else if (language === 'lus') {
        rightMsg = `A dik e! Kha chu ${currentPerson.name}, i ${currentPerson.relationship} a ni.`;
      } else if (language === 'nag') {
        rightMsg = `Sahi answer! Etu manu ${currentPerson.name} ase, apuni laga ${currentPerson.relationship}.`;
      }
      speakInLang(rightMsg);
    } else {
      let wrongMsg = `That is actually ${currentPerson.name}, your ${currentPerson.relationship}.`;
      if (language === 'kha') {
        wrongMsg = `Kane ka dei ${currentPerson.name}, ${currentPerson.relationship} jong phi.`;
      } else if (language === 'as') {
        wrongMsg = `এইজন প্ৰকৃততে ${currentPerson.name}, আপোনাৰ ${currentPerson.relationship}।`;
      } else if (language === 'ny') {
        wrongMsg = `Siyo hi ${currentPerson.name}, no laga ${currentPerson.relationship} e.`;
      } else if (language === 'mni') {
        wrongMsg = `মসিনা অচুম্বা ওইনা ${currentPerson.name}, অদোমগী ${currentPerson.relationship} নি।`;
      } else if (language === 'lus') {
        wrongMsg = `Kha chu ${currentPerson.name}, i ${currentPerson.relationship} a ni zawk.`;
      } else if (language === 'nag') {
        wrongMsg = `Etu manu actually ${currentPerson.name} ase, apuni laga ${currentPerson.relationship}.`;
      }
      speakInLang(wrongMsg);
    }

    setTimeout(() => {
      if (currentIndex + 1 < people.length) {
        setCurrentIndex(i => i + 1);
        setSelectedAnswer(null);
        setIsCorrect(null);
      } else {
        finishGame(scoreCount + (correct ? 1 : 0));
      }
    }, 1800);
  };

  const finishGame = (finalScore: number) => {
    setGameOver(true);
    const accuracy = Math.round((finalScore / Math.max(1, people.length)) * 100);
    confetti({ particleCount: 80, spread: 70 });

    const metrics = AIEngineService.calculateSessionMetrics(
      accuracy,
      30,
      1,
      2,
      'recognition'
    );

    const session = StorageService.saveGameSession({
      gameId: 'name-face',
      gameTitle: 'Name & Face Memory',
      category: 'recognition',
      score: metrics.cognitiveScore,
      accuracy: metrics.accuracy,
      timeSeconds: 30,
      difficultyLevel: 2,
    });

    setSessionResult({ session, metrics, accuracy, finalScore });
  };

  // Generate multiple-choice options from registered profile members
  const currentOptions = useMemo(() => {
    if (!currentPerson) return [];

    const optionsMap = new Map<string, { name: string; relationship: string }>();
    optionsMap.set(currentPerson.name, {
      name: currentPerson.name,
      relationship: currentPerson.relationship || 'Family Member',
    });

    // Add other members strictly from the patient's registered family list
    for (const p of people) {
      if (optionsMap.size >= 4) break;
      if (p.name !== currentPerson.name && !optionsMap.has(p.name)) {
        optionsMap.set(p.name, { name: p.name, relationship: p.relationship || 'Family' });
      }
    }

    // If only 1 family member exists in the profile, supply neutral role distractors
    if (optionsMap.size < 2) {
      const neutralRoles = language === 'kha' ? [
        { name: 'Doktor jong ka ïing', relationship: 'Nongsumar' },
        { name: 'Nongsumar ïing', relationship: 'Nongsumar' },
        { name: 'Para Marjan', relationship: 'Marjan' },
      ] : language === 'lus' ? [
        { name: 'Chhungkua Doctor', relationship: 'Doctor' },
        { name: 'In Enkawltu', relationship: 'Enkawltu' },
        { name: 'Thenawm', relationship: 'Thenawm' },
      ] : language === 'nag' ? [
        { name: 'Ghar laga Doctor', relationship: 'Doctor' },
        { name: 'Caregiver / Madat Manu', relationship: 'Caregiver' },
        { name: 'Chuburia / Osor Manu', relationship: 'Neighbor' },
      ] : language === 'ny' ? [
        { name: 'Doctor', relationship: 'Care Team' },
        { name: 'Caregiver', relationship: 'Caregiver' },
        { name: 'Kinar Nyishi', relationship: 'Neighbor' },
      ] : language === 'as' ? [
        { name: 'পৰিয়ালৰ চিকিৎসক', relationship: 'চিকিৎসক' },
        { name: 'কেয়াৰগিভাৰ', relationship: 'সহায়ক' },
        { name: 'চুবুৰীয়া', relationship: 'পৰিচিত' },
      ] : language === 'bn' ? [
        { name: 'পারিবারিক ডাক্তার', relationship: 'চিকিৎসক' },
        { name: 'কেয়ারগিভার', relationship: 'সহায়ক' },
        { name: 'প্রতিবেশী', relationship: 'পরিচিত' },
      ] : [
        { name: 'Family Doctor', relationship: 'Care Team' },
        { name: 'Home Nurse', relationship: 'Caregiver' },
        { name: 'Neighbor', relationship: 'Community' },
      ];
      for (const roleItem of neutralRoles) {
        if (optionsMap.size >= 3) break;
        if (!optionsMap.has(roleItem.name)) {
          optionsMap.set(roleItem.name, roleItem);
        }
      }
    }

    const array = Array.from(optionsMap.values());
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }, [currentPerson, people]);

  const restartGame = () => {
    setCurrentIndex(0);
    setScoreCount(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setGameOver(false);
    setSessionResult(null);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 border border-slate-200 shadow-xl text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-bold transition text-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> {t('btn.back')}
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-slate-900">{t('games.whoIsThis')}</h2>
          <span className="text-xs bg-rose-100 text-rose-800 font-extrabold px-3 py-0.5 rounded-full">
            {t('cat.recognition')}
          </span>
        </div>

        <div className="w-8"></div>
      </div>

      {/* Screen 1: Loading State */}
      {isLoading ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto animate-pulse shadow-inner border border-rose-200">
            <Heart className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-slate-900">
            {language === 'nag'
              ? 'Ghar laga manu khan taiyar kori ase...'
              : language === 'lus'
              ? 'Chhungte thlalak buatsaih mek a ni...'
              : language === 'kha'
              ? 'Pynkhreh ïa ki baha-ïing...'
              : language === 'ny'
              ? 'Nam laga nyishi taiyar lanta...'
              : language === 'as'
              ? 'পৰিয়ালৰ সদস্যসকল প্ৰস্তুত কৰা হৈছে...'
              : language === 'bn'
              ? 'পরিবারের সদস্যদের তথ্য লোড হচ্ছে...'
              : 'Loading Family Members...'}
          </h3>
          <p className="text-xs text-slate-500 font-semibold">
            {language === 'nag'
              ? 'Apuni laga family face yaad kora khel taiyar kori ase'
              : language === 'lus'
              ? 'I chhungte hmel hriatna inelna buatsaih mek a ni'
              : language === 'kha'
              ? 'Pynkhreh ïa ka jingkynmaw dur khmat jong ki baha-ïing'
              : language === 'ny'
              ? 'No laga family face minyi taiyar koringa'
              : language === 'as'
              ? 'আপোনাৰ পৰিয়ালৰ মুখ চিনাক্তকৰণ খেল প্ৰস্তুত কৰা হৈছে'
              : language === 'bn'
              ? 'আপনার পরিবারের চেনা মুখ মনে করার চ্যালেঞ্জ প্রস্তুত হচ্ছে'
              : 'Preparing your family face memory challenge'}
          </p>
        </div>
      ) : gameOver && sessionResult ? (
        /* Screen 2: Result Screen (Only after completing all questions!) */
        <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-6 sm:p-8 text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 bg-rose-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-xl">
            <Trophy className="w-9 h-9" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">🎉 {t('feedback.activityComplete')}</h3>
            <p className="text-sm text-slate-600 mt-1 font-medium">
              {t('feedback.greatWork')}{' '}
              {language === 'nag'
                ? `Apuni thik pora ${people.length} ta manu bitor te ${sessionResult.finalScore} ta manu sini paise!`
                : language === 'lus'
                ? `Chhungkhat zinga ${people.length} atangin ${sessionResult.finalScore} dik takin i hria e!`
                : language === 'kha'
                ? `Phi la ithuh beit ${sessionResult.finalScore} na ki ${people.length} ngut ki baha-ïing!`
                : language === 'ny'
                ? `No thik pora ${sessionResult.finalScore} / ${people.length} nyishi khenam!`
                : language === 'as'
                ? `আপুনি সঠিকভাৱে ${people.length} জনৰ ভিতৰত ${sessionResult.finalScore} জনক চিনাক্ত কৰিলে!`
                : language === 'bn'
                ? `আপনি সঠিকভাবে ${people.length} জনের মধ্যে ${sessionResult.finalScore} জনকে শনাক্ত করেছেন!`
                : `You correctly identified ${sessionResult.finalScore} of ${people.length} family members!`}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-rose-200 space-y-3 text-left shadow-xs">
            <div className="flex justify-between items-center text-sm font-bold text-slate-800">
              <span>{t('game.accuracy')}:</span>
              <span className="text-rose-700 text-xl font-black">{sessionResult.accuracy}%</span>
            </div>
            <div className="pt-2 border-t border-slate-100 text-xs text-rose-950 font-semibold flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span><strong>{t('game.aiRecommendation')}:</strong> {sessionResult.metrics.recommendationReason}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={restartGame}
              className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> {t('btn.playAgain')}
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition cursor-pointer"
            >
              {t('game.returnToHub')}
            </button>
          </div>
        </div>
      ) : currentPerson ? (
        /* Screen 3: Active Game Play Screen */
        <div className="space-y-6 max-w-md mx-auto">
          {/* Person Image Card */}
          <div className="bg-slate-50 p-5 rounded-3xl border-2 border-slate-200 shadow-sm text-center">
            {currentPerson.photoUrl ? (
              <img
                src={currentPerson.photoUrl}
                alt={currentPerson.name}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                className="w-52 h-52 object-cover rounded-2xl mx-auto shadow-md border-4 border-white mb-3"
              />
            ) : (
              <div className="w-48 h-48 bg-rose-50 text-rose-700 rounded-2xl flex flex-col items-center justify-center mx-auto shadow-inner border-2 border-rose-200 mb-3">
                <User className="w-16 h-16 text-rose-400 mb-2" />
                <span className="text-sm font-black text-slate-800">{currentPerson.name}</span>
                <span className="text-xs font-bold text-rose-600 uppercase tracking-wider mt-0.5">
                  {currentPerson.relationship || (language === 'nag' ? 'Ghar laga manu' : language === 'lus' ? 'Chhungkhat' : language === 'kha' ? 'Dkhot jong ka ïing' : language === 'ny' ? 'Nam laga nyi' : language === 'as' ? 'পৰিয়ালৰ সদস্য' : language === 'bn' ? 'পরিবারের সদস্য' : 'Family Member')}
                </span>
                {currentPerson.notes && (
                  <span className="text-xs text-slate-500 italic mt-1 px-4 text-center">"{currentPerson.notes}"</span>
                )}
              </div>
            )}
            <h3 className="text-xl font-black text-slate-900">{t('game.whoIsThisPerson')}</h3>
            <p className="text-xs text-slate-500 font-bold mt-1">
              {t('game.person')} {currentIndex + 1} {t('game.of')} {people.length}
            </p>
          </div>

          {/* Multiple-Choice Options */}
          <div className="space-y-3">
            {currentOptions.map((opt, i) => {
              const isSelected = selectedAnswer === opt.name;
              let btnClass = 'bg-white border-2 border-slate-200 text-slate-900 hover:bg-slate-50 hover:border-slate-300';

              if (isSelected) {
                btnClass = isCorrect
                  ? 'bg-emerald-100 border-2 border-emerald-600 text-emerald-950 font-extrabold ring-2 ring-emerald-400'
                  : 'bg-rose-100 border-2 border-rose-600 text-rose-950 font-extrabold ring-2 ring-rose-400';
              }

              return (
                <button
                  key={`${opt.name}-${i}`}
                  onClick={() => handleOptionSelect(opt.name)}
                  disabled={selectedAnswer !== null}
                  className={`w-full py-4 px-6 rounded-2xl text-base font-extrabold shadow-sm transition transform active:scale-98 flex items-center justify-between cursor-pointer disabled:cursor-not-allowed ${btnClass}`}
                >
                  <span className="text-base">{opt.name}</span>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {opt.relationship}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Screen 4: No Family Members Registered in Profile */
        <div className="text-center py-12 px-4 space-y-4 max-w-md mx-auto">
          <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-rose-200">
            <User className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">{t('games.whoIsThis')}</h3>
            <p className="text-sm font-semibold text-rose-700 mt-1">
              {language === 'nag'
                ? 'Profile te ghar laga manu photo hala nai'
                : language === 'lus'
                ? 'Profile-ah chhungte thlalak a la awm lo'
                : language === 'kha'
                ? 'Ym pat don baha-ïing ba la pynrung ha ka profile'
                : language === 'ny'
                ? 'Nam laga nyishi profile lw dalinai'
                : language === 'as'
                ? 'প্ৰফাইলত কোনো পৰিয়ালৰ সদস্য তালিকাভুক্ত নাই'
                : language === 'bn'
                ? 'প্রোফাইলে কোনো পরিবারের সদস্য নিবন্ধিত নেই'
                : 'No family members registered in profile'}
            </p>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {language === 'nag'
                ? 'Caregiver Profile Setup (Family & Places) te ghar manu laga photo aro naam dalishe koile si etu khel kheli paribo.'
                : language === 'lus'
                ? 'Enkawltuin Profile Setup (Chhungte & Hmun) atangin chhungkhat thlalak leh hming a dah hnuah he infiamna hi khelh theih a ni ang.'
                : language === 'kha'
                ? 'Ka nongsumar ka dei ban thep ïa ki dur bad ki kyrteng jong ki baha-ïing ha ka Profile Setup (Baha-ïing & Ki Jaka) shwa ban ïalehkai.'
                : language === 'ny'
                ? 'Caregiver Profile Setup (Family & Places) lw nam laga photo aro naam daliba pora si minyi gwrbo paribo.'
                : language === 'as'
                ? 'এই খেল খেলিবলৈ কেয়াৰগিভাৰে প্ৰফাইল ছেটআপৰ পৰা পৰিয়ালৰ সদস্য আৰু ফটো যোগ কৰিব লাগিব।'
                : language === 'bn'
                ? 'এই গেমটি খেলতে হলে কেয়ারগিভারকে প্রোফাইল সেটআপ থেকে পরিবারের সদস্য এবং ছবি যুক্ত করতে হবে।'
                : 'Family members and photos must be registered during Profile Setup (Family & Places) by the caregiver before this game can be played.'}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={onBack}
              className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition cursor-pointer"
            >
              {t('btn.back')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
