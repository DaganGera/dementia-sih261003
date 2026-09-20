import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { ArrowLeft, RefreshCw, Trophy, Sparkles, MapPin, Star, Zap } from 'lucide-react';
import { StorageService } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { AdaptiveEngineService } from '../services/adaptiveEngine';
import { GamificationService } from '../services/gamification';
import { useI18n } from '../i18n';
import { TextToSpeechService } from '../services/textToSpeech';
import { FamiliarPlace } from '../types';

interface FamiliarPlacesGameProps {
  onBack: () => void;
}

export const FamiliarPlacesGame: React.FC<FamiliarPlacesGameProps> = ({ onBack }) => {
  const { language, t } = useI18n();
  const { user, role } = useAuth();

  const activePatientId =
    StorageService.getActivePatientId(user?.id) ||
    (user?.id && user.role !== 'caregiver' ? user.id : undefined);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [level, setLevel] = useState<number>(2); // Level 1-4
  const [places, setPlaces] = useState<FamiliarPlace[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [scoreCount, setScoreCount] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [completionData, setCompletionData] = useState<any>(null);

  const speakInLang = (text: string) => {
    TextToSpeechService.speak(text, language);
  };

  useEffect(() => {
    let isMounted = true;

    const loadPlaces = async () => {
      setIsLoading(true);
      try {
        const targetId = activePatientId || StorageService.getActivePatientId(user?.id) || user?.id;
        let list: FamiliarPlace[] = await StorageService.fetchFamiliarPlacesFromCloud(targetId);
        if (!list || list.length === 0) {
          list = StorageService.getFamiliarPlaces(targetId);
        }

        // Keep only valid entries created for this patient, filtering out legacy demo IDs
        const filtered = (list || [])
          .filter(p => p && p.name && p.name.trim() !== '' && p.id !== 'fplace-1' && p.id !== 'fplace-2' && p.id !== 'fplace-3');

        // Deduplicate by name
        const seen = new Set<string>();
        const uniquePlaces: FamiliarPlace[] = [];
        for (const p of filtered) {
          const norm = p.name.trim().toLowerCase();
          if (!seen.has(norm)) {
            seen.add(norm);
            uniquePlaces.push({
              ...p,
              name: p.name.trim(),
              description: (p.description || '').trim(),
              photoUrl: (p.photoUrl || '').trim(),
            });
          }
        }

        if (isMounted) {
          setPlaces(uniquePlaces);
          setCurrentIndex(0);
          setGameOver(false);
          setCompletionData(null);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Error loading familiar places from profile:', err);
        if (isMounted) {
          setPlaces([]);
          setIsLoading(false);
        }
      }
    };

    loadPlaces();
    return () => { isMounted = false; };
  }, [activePatientId]);

  const currentPlace = places[currentIndex];

  // Generate multiple-choice options strictly from registered profile places
  const currentOptions = useMemo(() => {
    if (!currentPlace) return [];

    const optionsSet = new Set<string>();
    optionsSet.add(currentPlace.name);

    // Add other places from places list
    for (const p of places) {
      if (optionsSet.size >= 4) break;
      if (p.name && !optionsSet.has(p.name)) {
        optionsSet.add(p.name);
      }
    }

    // If only 1 place registered, provide neutral landmark distractors
    if (optionsSet.size < 2) {
      const neutralLandmarks = ['Central Hospital', 'City Market', 'Town Park'];
      for (const lm of neutralLandmarks) {
        if (optionsSet.size >= 3) break;
        if (!optionsSet.has(lm)) {
          optionsSet.add(lm);
        }
      }
    }

    const arr = Array.from(optionsSet);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [currentPlace, places]);

  // Audio question prompt whenever a new question is displayed
  useEffect(() => {
    if (!isLoading && currentPlace && !gameOver) {
      let askPlaceMsg = `Where is this place?`;
      if (language === 'kha') {
        askPlaceMsg = `Kaei kane ka jaka?`;
      } else if (language === 'as') {
        askPlaceMsg = `এই ঠাইডোখৰ ক’ত হয়?`;
      } else if (language === 'bn') {
        askPlaceMsg = `এই স্থানটি কোথায়?`;
      } else if (language === 'ny') {
        askPlaceMsg = `Si nam kot dwnam?`;
      } else if (language === 'mni') {
        askPlaceMsg = `মফম অসি কদায়দনো?`;
      } else if (language === 'lus') {
        askPlaceMsg = `Heng hmun hi khawi nge?`;
      } else if (language === 'nag') {
        askPlaceMsg = `Etu jagah kot ase?`;
      }
      speakInLang(askPlaceMsg);
    }
  }, [currentIndex, isLoading, gameOver, language, currentPlace?.name]);

  const handleOptionSelect = (placeName: string) => {
    if (selectedAnswer !== null || !currentPlace) return;

    setSelectedAnswer(placeName);
    const correct = placeName === currentPlace.name;

    if (correct) {
      setScoreCount(s => s + 1);
      let rightMsg = `Correct! That is ${currentPlace.name}.`;
      if (language === 'kha') {
        rightMsg = `Dei paka! Kane ka dei ${currentPlace.name}.`;
      } else if (language === 'as') {
        rightMsg = `সঠিক! এই ঠাইডোখৰ হৈছে ${currentPlace.name}।`;
      } else if (language === 'bn') {
        rightMsg = `সঠিক! এই স্থানটি হলো ${currentPlace.name}।`;
      } else if (language === 'ny') {
        rightMsg = `Sahi! Siyo nam hi ${currentPlace.name} e.`;
      } else if (language === 'mni') {
        rightMsg = `চুম্লে! মসিনা ${currentPlace.name} নি।`;
      } else if (language === 'lus') {
        rightMsg = `A dik e! Kha chu ${currentPlace.name} a ni.`;
      } else if (language === 'nag') {
        rightMsg = `Sahi answer! Etu jagah ${currentPlace.name} ase.`;
      }
      speakInLang(rightMsg);
    } else {
      let wrongMsg = `That is actually ${currentPlace.name}.`;
      if (language === 'kha') {
        wrongMsg = `Kane ka jaka ka dei ${currentPlace.name}.`;
      } else if (language === 'as') {
        wrongMsg = `এই ঠাইডোখৰ প্ৰকৃততে ${currentPlace.name} হয়।`;
      } else if (language === 'bn') {
        wrongMsg = `এই স্থানটি আসলে ${currentPlace.name}।`;
      } else if (language === 'ny') {
        wrongMsg = `Siyo nam hi ${currentPlace.name} dwnam.`;
      } else if (language === 'mni') {
        wrongMsg = `মফম অসি অচুম্বা ওইনা ${currentPlace.name} নি।`;
      } else if (language === 'lus') {
        wrongMsg = `Kha chu ${currentPlace.name} a ni zawk.`;
      } else if (language === 'nag') {
        wrongMsg = `Etu jagah actually ${currentPlace.name} ase.`;
      }
      speakInLang(wrongMsg);
    }

    setTimeout(() => {
      if (currentIndex + 1 < places.length) {
        setCurrentIndex(i => i + 1);
        setSelectedAnswer(null);
      } else {
        finishGame(scoreCount + (correct ? 1 : 0));
      }
    }, 1800);
  };

  const finishGame = (finalScore: number) => {
    setGameOver(true);
    const accuracy = Math.round((finalScore / Math.max(1, places.length)) * 100);
    confetti({ particleCount: 80, spread: 60 });

    const adaptive = AdaptiveEngineService.getNextDifficulty(
      accuracy,
      level,
      StorageService.getGameSessions()
    );

    const session = StorageService.saveGameSession({
      gameId: 'familiar-places',
      gameTitle: '🏠 Familiar Places',
      category: 'recognition',
      score: accuracy,
      accuracy,
      timeSeconds: 30,
      difficultyLevel: level,
    });

    const rewards = GamificationService.rewardSession(session);

    setCompletionData({
      accuracy,
      score: accuracy,
      adaptive,
      rewards,
      finalScore,
    });
  };

  const restartGame = () => {
    setCurrentIndex(0);
    setScoreCount(0);
    setSelectedAnswer(null);
    setGameOver(false);
    setCompletionData(null);
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
          <h2 className="text-2xl font-extrabold text-slate-900">{t('games.familiarPlaces')}</h2>
          <span className="text-xs bg-indigo-100 text-indigo-800 font-extrabold px-3 py-0.5 rounded-full">
            {t('cat.familiarity')}
          </span>
        </div>

        <div className="w-8"></div>
      </div>

      {/* Screen 1: Loading State */}
      {isLoading ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-3xl flex items-center justify-center mx-auto animate-pulse shadow-inner border border-sky-200 text-3xl">
            🏠
          </div>
          <h3 className="text-xl font-black text-slate-900">Loading Familiar Places...</h3>
          <p className="text-xs text-slate-500 font-semibold">
            Preparing your familiar locations memory challenge
          </p>
        </div>
      ) : gameOver && completionData ? (
        /* Screen 2: Legitimate Result Screen (Only after completing all questions!) */
        <div className="bg-sky-50 border-2 border-sky-300 rounded-3xl p-6 text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 bg-sky-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-xl">
            <Trophy className="w-9 h-9" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">🎉 {t('feedback.activityComplete')}</h3>
            <p className="text-sm text-slate-600 mt-1 font-medium">
              {t('feedback.greatWork')} You correctly recognized {completionData.finalScore} of {places.length} places!
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-center gap-4 bg-white p-4 rounded-2xl border border-sky-200 shadow-sm">
              <div className="flex items-center gap-1.5 text-amber-600 font-extrabold text-base">
                <Star className="w-5 h-5 fill-current" /> +{completionData.rewards?.mindPointsEarned || 15} {t('game.mindPoints')}
              </div>
              <div className="h-6 w-px bg-slate-200"></div>
              <div className="flex items-center gap-1.5 text-sky-700 font-extrabold text-base">
                <Zap className="w-5 h-5 fill-current" /> +{completionData.rewards?.xpEarned || 25} {t('game.xp')}
              </div>
            </div>
            <div className="flex justify-between items-center text-sm font-bold text-slate-800 bg-white p-4 rounded-2xl border border-sky-200">
              <span>{t('game.accuracy')}:</span>
              <span className="text-sky-700 text-xl font-black">{completionData.accuracy}%</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={restartGame}
              className="flex-1 py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
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
      ) : currentPlace ? (
        /* Screen 3: Active Game Question */
        <div className="space-y-6 max-w-md mx-auto">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs bg-sky-100 text-sky-800 font-extrabold px-3 py-1 rounded-full">
              {t('game.place')} {currentIndex + 1} {t('game.of')} {places.length}
            </span>
            <span className="text-xs font-bold text-slate-500">
              ⭐ Score: {scoreCount}
            </span>
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-200 shadow-md text-center">
            {currentPlace.photoUrl ? (
              <img
                src={currentPlace.photoUrl}
                alt={currentPlace.name}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                className="w-full h-48 object-cover rounded-2xl mb-3 border-2 border-white shadow"
              />
            ) : (
              <div className="w-24 h-24 bg-sky-50 text-sky-700 rounded-3xl flex items-center justify-center mx-auto mb-3 text-5xl shadow-inner border border-sky-200">
                🏡
              </div>
            )}
            <h3 className="text-xl font-extrabold text-slate-900">{t('game.whereIsPlace')}</h3>
            {currentPlace.description && (
              <p className="text-xs text-slate-500 mt-1 italic">"{currentPlace.description}"</p>
            )}
          </div>

          <div className="space-y-3">
            {currentOptions.map((optName, idx) => {
              const isSelected = selectedAnswer === optName;
              let btnClass = 'bg-white border-2 border-slate-200 text-slate-900 hover:border-sky-300 hover:bg-sky-50/50';
              if (isSelected) {
                btnClass =
                  optName === currentPlace.name
                    ? 'bg-emerald-100 border-2 border-emerald-600 text-emerald-900 font-extrabold scale-[1.02]'
                    : 'bg-rose-100 border-2 border-rose-600 text-rose-900 font-extrabold';
              } else if (selectedAnswer !== null && optName === currentPlace.name) {
                // Show the correct one in green if user made a wrong guess
                btnClass = 'bg-emerald-50 border-2 border-emerald-500 text-emerald-900 font-bold';
              }
              return (
                <button
                  key={`${optName}-${idx}`}
                  onClick={() => handleOptionSelect(optName)}
                  disabled={selectedAnswer !== null}
                  className={`w-full py-4 px-6 rounded-2xl text-lg font-extrabold shadow-sm transition transform active:scale-98 text-left flex items-center justify-between cursor-pointer ${btnClass}`}
                >
                  <span>{optName}</span>
                  <MapPin className="w-5 h-5 text-slate-400 opacity-60" />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Screen 4: No Familiar Places Registered in Profile */
        <div className="text-center py-12 px-4 space-y-4 max-w-md mx-auto">
          <div className="w-20 h-20 bg-sky-50 text-sky-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-sky-200">
            <MapPin className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">{t('games.familiarPlaces')}</h3>
            <p className="text-sm font-semibold text-sky-700 mt-1">No familiar places registered in profile</p>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Familiar places must be added during <strong>Profile Setup (Family & Places)</strong> by the caregiver before this game can be played.
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
