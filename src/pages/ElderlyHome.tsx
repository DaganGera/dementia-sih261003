import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { RecommendationEngineService } from '../services/recommendationEngine';
import { GamificationService } from '../services/gamification';
import { AlertEngineService } from '../services/alertEngine';
import { SpeechRecognitionService } from '../services/speechRecognition';
import { TextToSpeechService } from '../services/textToSpeech';
import { subscribeToSync } from '../services/realtime';
import {
  recognizeNavigationIntent,
  getNavigationResponse,
  getRouteForIntent,
} from '../services/voiceNavigationEngine';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import {
  Gamepad2,
  Brain,
  MessageSquare,
  Sparkles,
  Award,
  Flame,
  ChevronRight,
  Sun,
  Coffee,
  Heart,
  HelpCircle,
  Siren,
  CheckCircle2,
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GameType } from '../types';

interface ElderlyHomeProps {
  onNavigate: (page: string) => void;
  onPlayGame: (gameId?: string) => void;
}

export const ElderlyHome: React.FC<ElderlyHomeProps> = ({ onNavigate, onPlayGame }) => {
  const { t, language, languageProfile, bilingualMode } = useI18n();
  const { user, role } = useAuth();
  const activePatientId =
    StorageService.getActivePatientId(user?.id) ||
    (user?.id && user.role !== 'caregiver' ? user.id : undefined);

  const [elderly, setElderly] = useState(() => StorageService.getElderlyProfile(activePatientId));
  const sessions = StorageService.getGameSessions(activePatientId);
  const gamification = GamificationService.getProfile();
  const recommendation = RecommendationEngineService.getRecommendations(sessions);

  const [showManualSOSModal, setShowManualSOSModal] = useState(false);
  const [sosSentSuccess, setSosSentSuccess] = useState(false);

  // Welcome Speech State
  const [isSpeakingWelcome, setIsSpeakingWelcome] = useState(false);

  // Pre-fetch active patient memories and routines in background
  useEffect(() => {
    if (activePatientId && activePatientId !== 'pat-demo-1') {
      StorageService.fetchFamiliarPeopleFromCloud(activePatientId).catch(() => {});
      StorageService.fetchFamiliarPlacesFromCloud(activePatientId).catch(() => {});
      StorageService.fetchRemindersFromCloud(activePatientId).catch(() => {});
    }
  }, [activePatientId]);

  // Subscribe to realtime profile updates
  useEffect(() => {
    const unsub = subscribeToSync((payload) => {
      if (
        payload.key === 'mindcare_patient_profile' ||
        payload.key === 'mindcare_elderly_profile' ||
        payload.key === 'mindcare_patients_dict'
      ) {
        const updated = StorageService.getElderlyProfile(activePatientId);
        setElderly(updated);
      }
    });
    return () => {
      unsub();
    };
  }, [activePatientId]);

  // Voice Mic & Navigation Assistant State
  const [voiceNavState, setVoiceNavState] = useState<'IDLE' | 'LISTENING' | 'PROCESSING' | 'NAVIGATING' | 'AMBIGUOUS' | 'ERROR'>('IDLE');
  const [pendingAmbiguousState, setPendingAmbiguousState] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [activeSpeechController, setActiveSpeechController] = useState<{ stop: () => void } | null>(null);

  // Check rolling accuracy strictly to determine whether to gently show a calm break suggestion
  const rollingAcc = AlertEngineService.calculateRollingAccuracy(sessions);
  const showGentleBreak = rollingAcc !== null && rollingAcc < 50;

  // Helper for localized welcome greeting text
  const getWelcomeTextByLanguage = (langCode: string, name: string) => {
    switch (langCode) {
      case 'as':
        return `নমস্কাৰ ${name}! SIROI লৈ আপোনাক স্বাগতম। আজি আপোনাৰ মনটো সক্ৰিয় আৰু আনন্দময় কৰি ৰাখোঁ আহক।`;
      case 'bn':
        return `নমস্কার ${name}! SIROI-তে আপনাকে স্বাগতম। আসুন আপনার মনকে সক্রিয় ও আনন্দময় রাখি।`;
      case 'hi':
        return `नमस्ते ${name}! SIROI में आपका स्वागत है। आइए आज अपने मन को सक्रिय और खुशहाल रखें।`;
      case 'ne':
        return `नमस्ते ${name}! SIROI मा स्वागत छ। आज तपाईंको मन सक्रिय राखौं।`;
      case 'mni':
        return `খুরুমজরি ${name}! SIROI দা তরাম্না ওকচরি। ঙসি অদোমগী ৱাখলবু নুংঙাইনা থমসি।`;
      case 'kha':
        return `Khublei ${name}! Pdiang burom sha SIROI. Ngin pynkhlain ia ka jingmut jingpyrkhat jong phi mynta ka sngi.`;
      case 'lus':
        return `Chibai ${name}! SIROI-ah kan lo lawm a che.`;
      case 'nag':
        return `Namascar ${name}! SIROI te apuni ke swagat ase.`;
      case 'ny':
        return `Aro bha ${name}! SIROI ho welcome. Lwnyi no ania hika dope minyi gwrka.`;
      default:
        return `Namaste ${name}! Welcome back to your daily SIROI cognitive wellness journey.`;
    }
  };

  // Speak Localized Welcome Greeting
  const handleSpeakWelcomeGreeting = () => {
    if (isSpeakingWelcome) {
      TextToSpeechService.stop();
      setIsSpeakingWelcome(false);
      return;
    }

    setIsSpeakingWelcome(true);
    const welcomeText = getWelcomeTextByLanguage(language, elderly.name || 'Meena Sharma');

    TextToSpeechService.speak(welcomeText, language, 0.88, true, () => {
      setIsSpeakingWelcome(false);
    });
  };

  const handleConfirmManualSOS = () => {
    const pid = elderly.id || activePatientId || 'pat-demo-1';
    const pname = elderly.name || (elderly as any).basicInfo?.name || user?.name || 'Patient';
    AlertEngineService.triggerManualSOS(pid, pname);
    setSosSentSuccess(true);
    setTimeout(() => {
      setShowManualSOSModal(false);
      setSosSentSuccess(false);
    }, 5500);
  };

  // Toggle Voice Listening with Offline Multilingual Navigation Intent Engine
  const handleToggleVoiceMic = () => {
    if (isListening || voiceNavState === 'LISTENING') {
      if (activeSpeechController) {
        activeSpeechController.stop();
      }
      setIsListening(false);
      setVoiceNavState('IDLE');
      return;
    }

    setVoiceTranscript('');
    setVoiceFeedback(t('voice.listening') || 'Listening...');
    setIsListening(true);
    setVoiceNavState('LISTENING');

    const controller = SpeechRecognitionService.startListening({
      languageCode: language,
      onResult: (transcript) => {
        setVoiceTranscript(transcript);
        setIsListening(false);
        setVoiceNavState('PROCESSING');
        setVoiceFeedback('Understanding your command...');

        // Process Multilingual Navigation Intent
        const intent = recognizeNavigationIntent(transcript, language, pendingAmbiguousState);

        if (intent === 'AMBIGUOUS_GAME_PROMPT') {
          setPendingAmbiguousState(true);
          setVoiceNavState('AMBIGUOUS');
          const promptText = getNavigationResponse('AMBIGUOUS_GAME_PROMPT', language);
          setVoiceFeedback(promptText);
          TextToSpeechService.speak(promptText, language);
          return;
        }

        if (intent !== 'UNKNOWN') {
          setPendingAmbiguousState(false);
          const confirmText = getNavigationResponse(intent, language);
          setVoiceFeedback(confirmText);

          if (intent === 'TRIGGER_SOS') {
            setVoiceNavState('NAVIGATING');
            const pid = elderly.id || activePatientId || 'pat-demo-1';
            const pname = elderly.name || (elderly as any).basicInfo?.name || user?.name || 'Patient';
            AlertEngineService.triggerManualSOS(pid, pname);
            setSosSentSuccess(true);
            setShowManualSOSModal(true);
            setTimeout(() => {
              setShowManualSOSModal(false);
              setSosSentSuccess(false);
            }, 4500);

            TextToSpeechService.speak(confirmText, language, 0.88, true, () => {
              setVoiceNavState('IDLE');
            });
            return;
          }

          setVoiceNavState('NAVIGATING');
          const target = getRouteForIntent(intent);

          let navigated = false;
          const executeNavigation = () => {
            if (navigated) return;
            navigated = true;
            if (target) {
              if (target.gameId) {
                onPlayGame(target.gameId);
              } else if (target.tab) {
                onNavigate(target.tab);
              }
            }
            setVoiceNavState('IDLE');
          };

          // Speak full localized confirmation message and navigate ONLY after voice speech completes fully!
          const speakSuccess = TextToSpeechService.speak(confirmText, language, 0.88, true, () => {
            setTimeout(executeNavigation, 350);
          });

          // Long fallback timer (6s) only if browser speech synthesis onend fails to trigger
          setTimeout(executeNavigation, speakSuccess ? 6000 : 1500);
          return;
        }

        // Handle UNKNOWN intent safely
        setPendingAmbiguousState(false);
        setVoiceNavState('ERROR');
        const errText = getNavigationResponse('UNKNOWN', language);
        setVoiceFeedback(errText);
        TextToSpeechService.speak(errText, language);
      },
      onError: (err) => {
        setIsListening(false);
        setVoiceNavState('ERROR');
        setVoiceFeedback(err || t('voice.unavailable') || 'Voice recognition unavailable.');
      },
      onEnd: () => {
        setIsListening(false);
        setVoiceNavState((prev) => (prev === 'LISTENING' ? 'IDLE' : prev));
      },
    });

    setActiveSpeechController(controller);
  };

  useEffect(() => {
    // Speak welcome greeting automatically in selected language as soon as home page opens or language changes!
    const timer = setTimeout(() => {
      const welcomeText = getWelcomeTextByLanguage(language, elderly.name || 'Meena Sharma');

      setIsSpeakingWelcome(true);
      TextToSpeechService.speak(welcomeText, language, 0.88, true, () => {
        setIsSpeakingWelcome(false);
      });
    }, 500);

    return () => {
      clearTimeout(timer);
      if (activeSpeechController) {
        activeSpeechController.stop();
      }
    };
  }, [language]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 text-[#26332F]">

      {/* Warm Patient Welcome Header */}
      <div className="bg-white border border-[#E4DED4] p-6 sm:p-8 rounded-3xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-left">
          <div className="w-16 h-16 rounded-full bg-[#DDE9D9] border-2 border-[#176B61] text-[#176B61] flex items-center justify-center font-extrabold text-2xl shrink-0 overflow-hidden shadow-sm">
            {elderly.photoUrl ? (
              <img src={elderly.photoUrl} alt={elderly.name} className="w-full h-full object-cover" />
            ) : (
              elderly.name.charAt(0)
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#F4EBD7] text-[#26332F] text-xs font-black px-2.5 py-0.5 rounded-full uppercase border border-[#E4DED4]">
                {languageProfile.flag} {languageProfile.nativeName}
              </span>
              <span className="text-xs text-[#66736D] font-bold">{t('home.greeting')} 🌿</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#26332F] mt-1 flex items-center gap-2">
              Namaste, {elderly.name}!
              <button
                type="button"
                onClick={handleSpeakWelcomeGreeting}
                className={`p-2 rounded-full border transition cursor-pointer shadow-xs ${
                  isSpeakingWelcome
                    ? 'bg-[#D9A7A8] text-[#26332F] border-[#D9A7A8] animate-pulse'
                    : 'bg-[#DDE9D9] hover:bg-[#c9ddc4] text-[#176B61] border-[#E4DED4]'
                }`}
                title="🔊 Play / Stop Welcome Voice Greeting"
              >
                {isSpeakingWelcome ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </h1>
            <p className="text-xs text-[#66736D] font-semibold">
              {t('home.subtitle')}
            </p>
          </div>
        </div>

        {/* Gamification & Welcome Speech Button */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleSpeakWelcomeGreeting}
            className={`px-4 py-2.5 rounded-2xl font-extrabold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer border ${
              isSpeakingWelcome
                ? 'bg-[#D9A7A8] text-[#26332F] border-[#D9A7A8] animate-pulse'
                : 'bg-[#176B61] hover:bg-[#12564E] text-white border-[#176B61]'
            }`}
          >
            {isSpeakingWelcome ? (
              <>
                <VolumeX className="w-4 h-4" /> Stop Voice
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-[#DDE9D9]" /> 🔊 Read Greeting ({languageProfile.nativeName})
              </>
            )}
          </button>

          <div className="flex items-center gap-2 bg-white p-2.5 rounded-2xl border border-[#E4DED4] shadow-xs">
            <div className="flex items-center gap-1 px-2.5 py-1 bg-[#F8E9D9] rounded-xl">
              <Flame className="w-4 h-4 text-[#176B61]" />
              <span className="text-xs font-black text-[#26332F]">{gamification.currentStreak} {t('game.streak')}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 bg-[#DDE9D9] rounded-xl">
              <Award className="w-4 h-4 text-[#176B61]" />
              <span className="text-xs font-black text-[#26332F]">{gamification.mindPoints} {t('game.mindPoints')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── PROMINENT VOICE MICROPHONE NAVIGATION ASSISTANT CARD ────────────────── */}
      <div className="bg-white text-[#26332F] p-6 rounded-3xl shadow-sm border-2 border-[#EFD4D3] space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 border-[#EFD4D3] transition shrink-0 ${
              voiceNavState === 'LISTENING'
                ? 'bg-[#DCEEEF] animate-pulse text-[#176B61]'
                : voiceNavState === 'PROCESSING'
                ? 'bg-[#E4E5F4] text-[#176B61] animate-spin'
                : voiceNavState === 'NAVIGATING'
                ? 'bg-[#DDE9D9] text-[#176B61] animate-bounce'
                : voiceNavState === 'AMBIGUOUS'
                ? 'bg-[#F8E9D9] text-[#26332F]'
                : voiceNavState === 'ERROR'
                ? 'bg-[#D9A7A8] text-[#26332F]'
                : 'bg-[#EFD4D3]/30 text-[#176B61]'
            }`}>
              <Mic className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#EFD4D3]/50 text-[#26332F] text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full border border-[#EFD4D3]">
                  🗣️ {t('voice.title')} ({languageProfile.nativeName})
                </span>
                {/* Visual Status Indicator Badge */}
                <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${
                  voiceNavState === 'LISTENING'
                    ? 'bg-[#DCEEEF] text-[#176B61] border-[#B7D4CC] animate-pulse'
                    : voiceNavState === 'PROCESSING'
                    ? 'bg-[#E4E5F4] text-[#176B61] border-[#BFCFC5]'
                    : voiceNavState === 'NAVIGATING'
                    ? 'bg-[#DDE9D9] text-[#176B61] border-[#BFCFC5]'
                    : voiceNavState === 'AMBIGUOUS'
                    ? 'bg-[#F8E9D9] text-[#26332F] border-[#E4DED4]'
                    : voiceNavState === 'ERROR'
                    ? 'bg-[#D9A7A8] text-[#26332F] border-[#D9A7A8]'
                    : 'bg-white text-[#66736D] border-[#E4DED4]'
                }`}>
                  {voiceNavState === 'IDLE' && '🎙️ IDLE'}
                  {voiceNavState === 'LISTENING' && '🔴 LISTENING...'}
                  {voiceNavState === 'PROCESSING' && '⚙️ UNDERSTANDING...'}
                  {voiceNavState === 'NAVIGATING' && '🚀 NAVIGATING...'}
                  {voiceNavState === 'AMBIGUOUS' && '❓ WHICH GAME?'}
                  {voiceNavState === 'ERROR' && '⚠️ TRY AGAIN'}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-[#26332F] mt-1">
                {voiceNavState === 'LISTENING'
                  ? 'Listening...'
                  : voiceNavState === 'PROCESSING'
                  ? 'Understanding...'
                  : voiceNavState === 'NAVIGATING'
                  ? 'Opening Requested Page...'
                  : voiceNavState === 'AMBIGUOUS'
                  ? 'Which Game Would You Like?'
                  : t('voice.title')}
              </h2>
              <p className="text-xs text-[#66736D] font-medium">
                {t('voice.subtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleVoiceMic}
            aria-label={isListening ? 'Stop Listening' : 'Tap to speak voice command'}
            className={`px-6 py-4 rounded-2xl font-extrabold text-sm shadow-md transition flex items-center gap-2 shrink-0 cursor-pointer ${
              isListening
                ? 'bg-[#D9A7A8] hover:bg-[#cf999a] text-[#26332F] animate-bounce ring-4 ring-[#EFD4D3]'
                : 'bg-[#176B61] hover:bg-[#12564E] text-white'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-5 h-5" /> Listening...
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 text-white" /> {t('home.voiceButton')}
              </>
            )}
          </button>
        </div>

        {/* Spoken Feedback Bar */}
        {voiceFeedback && (
          <div className="bg-[#FAF9F4] p-3.5 rounded-2xl border border-[#E4DED4] text-xs font-semibold text-[#26332F] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#176B61] shrink-0" />
              <span>{voiceFeedback}</span>
            </div>
            {voiceTranscript && (
              <span className="text-[11px] font-extrabold text-[#26332F] bg-[#F8E9D9] px-2 py-0.5 rounded-md border border-[#E4DED4]">
                "{voiceTranscript}"
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── GENTLE, CALM BREAK SUGGESTION (NO ALARMING WARNINGS SHOWN TO PATIENT) ── */}
      {showGentleBreak && (
        <div className="bg-[#DDE9D9] border border-[#BFCFC5] p-4 sm:p-5 rounded-3xl flex items-center justify-between gap-4 text-xs font-semibold text-[#26332F]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-[#176B61] flex items-center justify-center shrink-0 shadow-xs">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm block text-[#26332F]">🌿 Take a Short Break</span>
              <p className="text-xs text-[#66736D]">You've been working hard. Take a moment to relax or sip some water.</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('assistant')}
            className="px-4 py-2 bg-white border border-[#BFCFC5] hover:bg-[#FAF9F4] text-[#176B61] font-extrabold text-xs rounded-xl shadow-xs transition shrink-0"
          >
            {t('nav.memory')}
          </button>
        </div>
      )}

      {/* AI Daily Recommendation Card */}
      <div className="bg-white border border-[#E4DED4] rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#E4DED4] pb-3">
          <span className="text-xs uppercase font-extrabold text-[#26332F] bg-[#F8E9D9] px-3 py-1 rounded-full flex items-center gap-1.5 border border-[#E4DED4]">
            <Sparkles className="w-3.5 h-3.5 text-[#176B61]" /> {t('home.recommendedTitle')}
          </span>
          <span className="text-xs text-[#66736D] font-bold">{t('home.recommendedBadge')}</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-[#26332F]">
              {(() => {
                switch (recommendation.recommendedGameId) {
                  case 'memory-match': return t('games.memoryMatch');
                  case 'sequence-recall': return t('games.sequence');
                  case 'name-face': return t('games.whoIsThis');
                  case 'familiar-places': return t('games.familiarPlaces');
                  case 'number-memory': return t('games.numberMemory');
                  case 'voice-recall': return t('games.voiceRecall');
                  case 'object-recall': return t('games.objectRecall');
                  case 'story-recall': return t('games.storyRecall');
                  case 'familiar-sounds': return t('games.familiarSounds');
                  default: return recommendation.recommendedGameTitle;
                }
              })()}
            </h2>
            <p className="text-xs text-[#66736D] font-semibold mt-1">
              {t('home.recommendedReason')}
            </p>
          </div>

          <button
            onClick={() => onPlayGame(recommendation.recommendedGameId)}
            className="px-6 py-3.5 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-sm rounded-2xl shadow-md transition flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <Gamepad2 className="w-5 h-5" /> {t('btn.startGame')}
          </button>
        </div>
      </div>

      {/* Main Quick Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Play Cognitive Games */}
        <button
          onClick={() => onNavigate('games')}
          className="p-6 bg-white border border-[#E4DED4] hover:border-[#B7D4CC] rounded-3xl shadow-sm hover:shadow-md text-left transition space-y-3 group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#DCEEEF] text-[#176B61] flex items-center justify-center group-hover:scale-105 transition">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-[#26332F]">{t('games.center')}</h3>
            <p className="text-xs text-[#66736D] font-semibold mt-0.5">
              {t('games.centerSubtitle')}
            </p>
          </div>
          <div className="text-xs font-extrabold text-[#176B61] flex items-center gap-1 group-hover:translate-x-1 transition">
            {t('home.allGames')} <ChevronRight className="w-4 h-4" />
          </div>
        </button>

        {/* Memory Assistant */}
        <button
          onClick={() => onNavigate('assistant')}
          className="p-6 bg-white border border-[#E4DED4] hover:border-[#BFCFC5] rounded-3xl shadow-sm hover:shadow-md text-left transition space-y-3 group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#E4E5F4] text-[#176B61] flex items-center justify-center group-hover:scale-105 transition">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-[#26332F]">{t('assistant.title')}</h3>
            <p className="text-xs text-[#66736D] font-semibold mt-0.5">
              {t('assistant.subtitle')}
            </p>
          </div>
          <div className="text-xs font-extrabold text-[#176B61] flex items-center gap-1 group-hover:translate-x-1 transition">
            {t('assistant.title')} <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* ── MANUAL SOS HELP BUTTON CARD FOR ELDERLY ─────────────────── */}
      <div className="bg-white border-2 border-[#D9A7A8] p-6 rounded-3xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-[#26332F] uppercase tracking-wider flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-[#A56F72]" /> {t('home.sosNeedHelp')}
          </span>
          <span className="text-xs text-[#66736D] font-semibold">{t('home.connectedCaregiver')}</span>
        </div>

        <p className="text-xs text-[#66736D] font-semibold">
          {t('home.sosDesc')}
        </p>

        <button
          type="button"
          onClick={() => setShowManualSOSModal(true)}
          className="w-full py-4 bg-[#D9A7A8] hover:bg-[#cf9899] text-[#26332F] font-black text-base rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer border border-[#A56F72]"
        >
          <Siren className="w-6 h-6 text-[#26332F]" /> {t('home.sosButton')}
        </button>
      </div>

      {/* ── MANUAL SOS CONFIRMATION MODAL ────────────────────────────── */}
      {showManualSOSModal && (
        <div className="fixed inset-0 bg-[#26332F]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border-2 border-[#D9A7A8] animate-in fade-in">
            {sosSentSuccess ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-16 h-16 bg-[#DDE9D9] text-[#176B61] rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-extrabold text-[#26332F]">{t('home.sosSuccessTitle')}</h3>
                <p className="text-xs text-[#66736D] font-semibold">
                  {t('home.sosSuccessDesc')}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-[#E4DED4] pb-3">
                  <span className="text-xs font-extrabold text-[#26332F] uppercase flex items-center gap-1.5">
                    <Siren className="w-4 h-4 text-[#A56F72]" /> {t('home.sosEmergencyAssistance')}
                  </span>
                  <button
                    onClick={() => setShowManualSOSModal(false)}
                    className="text-[#66736D] hover:text-[#26332F] p-1 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2 text-center py-2">
                  <h3 className="text-2xl font-black text-[#26332F]">{t('home.sosModalQuestion')}</h3>
                  <p className="text-xs text-[#66736D] font-semibold leading-relaxed">
                    {t('home.sosModalDesc')}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleConfirmManualSOS}
                    className="flex-1 py-3.5 bg-[#D9A7A8] hover:bg-[#cf9899] text-[#26332F] font-black text-sm rounded-xl shadow-md transition cursor-pointer border border-[#A56F72]"
                  >
                    {t('home.sosConfirm')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualSOSModal(false)}
                    className="py-3.5 px-5 bg-[#F4EBD7] hover:bg-[#ebdcc0] text-[#26332F] font-bold text-sm rounded-xl transition cursor-pointer border border-[#E4DED4]"
                  >
                    {t('home.sosCancel')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
