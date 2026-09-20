import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import { SpeechRecognitionService } from '../services/speechRecognition';
import { TextToSpeechService } from '../services/textToSpeech';
import { StorageService } from '../services/storage';
import { AlertEngineService } from '../services/alertEngine';
import { useAuth } from '../context/AuthContext';
import {
  Mic,
  MicOff,
  Volume2,
  X,
  Sparkles,
  HelpCircle,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

type AssistantState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'RESPONSE' | 'SPEAKING' | 'ERROR';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchGame?: (gameId?: string) => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  onLaunchGame,
}) => {
  const { language, languageProfile, t } = useI18n();
  const { user, role } = useAuth();
  const activePatientId =
    StorageService.getActivePatientId(user?.id) ||
    (user?.id && user.role !== 'caregiver' ? user.id : undefined);

  const [state, setState] = useState<AssistantState>('IDLE');
  const [userSpeechText, setUserSpeechText] = useState<string>('');
  const [botResponseText, setBotResponseText] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeListenerRef = useRef<{ stop: () => void } | null>(null);

  const profile = StorageService.getElderlyProfile(activePatientId);
  const people = StorageService.getFamiliarPeople(activePatientId);
  const routines = StorageService.getRoutine();
  const reminders = StorageService.getReminders(activePatientId);

  useEffect(() => {
    if (!isOpen) {
      TextToSpeechService.stop();
      if (activeListenerRef.current) {
        activeListenerRef.current.stop();
      }
      setState('IDLE');
      setUserSpeechText('');
      setBotResponseText('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Multilingual quick queries
  const QUICK_PROMPTS = [
    {
      label: language === 'as' ? '🚨 এছঅ\'এছ সংকেত পঠিয়াওক' : language === 'bn' ? '🚨 জরুরি এসওএস পাঠান' : language === 'hi' ? '🚨 एसओएस संकेत भेजो' : '🚨 Send SOS Signal',
      query: 'send sos',
    },
    {
      label: language === 'as' ? 'আজি মোৰ কি কি কাম আছে?' : language === 'bn' ? 'আজ আমার কি কি কাজ আছে?' : 'What do I have today?',
      query: 'what do I have today',
    },
    {
      label: people[0]
        ? (language === 'as' ? `${people[0].name} কোন হয়?` : language === 'bn' ? `${people[0].name} কে?` : `Who is ${people[0].name}?`)
        : (language === 'as' ? 'মোৰ সহায়ক কোন?' : language === 'bn' ? 'আমার কেয়ারগিভার কে?' : 'Who is my caregiver?'),
      query: people[0] ? `who is ${people[0].name}` : 'who is my caregiver',
    },
    {
      label: language === 'as' ? 'আজি মোক কোনে লগ কৰিব?' : language === 'bn' ? 'আজ কে দেখা করতে আসবে?' : 'Who is visiting me?',
      query: 'who is visiting me',
    },
    {
      label: language === 'as' ? 'মোৰ পৰৱৰ্তী খেলটো কি?' : language === 'bn' ? 'আমার পরবর্তী খেলা কি?' : 'What is my next activity?',
      query: 'what is my next activity',
    },
    {
      label: language === 'as' ? 'ৰাতিপুৱাৰ জলপান কেতিয়া?' : language === 'bn' ? 'সকালের নাস্তা কখন?' : 'When is breakfast?',
      query: 'when is breakfast',
    },
  ];

  // Multilingual query response processor
  const processQueryInLanguage = (query: string): string => {
    const q = query.toLowerCase().trim();
    const lang = language;

    // 0. Emergency SOS Signal Trigger
    if (
      q.includes('sos') ||
      q.includes('emergency') ||
      q.includes('সংকেত') ||
      q.includes('বিপদ') ||
      q.includes('আপাতকালীন') ||
      q.includes('आपतकालीन') ||
      q.includes('तेংবাং') ||
      q.includes('send help') ||
      q.includes('call emergency')
    ) {
      const pid = profile.id || activePatientId || 'pat-demo-1';
      const pname = profile.name || user?.name || 'Patient';
      AlertEngineService.triggerManualSOS(pid, pname);

      if (lang === 'as') {
        return `আপোনাৰ কেয়াৰগিভাৰ আৰু জৰুৰী যোগাযোগলৈ জৰুৰী এছঅ'এছ সংকেত প্ৰেৰণ কৰা হৈছে। সহায় আহি আছে, অনুগ্ৰহ কৰি শান্ত হৈ থাকক।`;
      } else if (lang === 'bn') {
        return `আপনার কেয়ারগিভার এবং জরুরি পরিচিতিদের কাছে জরুরি এসওএস সংকেত পাঠানো হয়েছে। সাহায্য আসছে, দয়া করে শান্ত থাকুন।`;
      } else if (lang === 'hi') {
        return `आपके देखभालकर्ता और आपातकालीन संपर्कों को आपातकालीन एसओएस संकेत भेज दिया गया है। मदद आ रही है, कृपया शांत रहें।`;
      } else if (lang === 'ne') {
        return `तपाईंको हेरचाहकर्ता र आपतकालीन सम्पर्कहरूलाई आपतकालीन एसओएस संकेत पठाइएको छ। मद्दत आउँदैछ, कृपया शान्त रहनुहोस्।`;
      } else if (lang === 'mni') {
        return `অদোমগী কেয়ারগিভারদা জরুরি এস ও এস পাউজেল থাখ্রে। তেংবাং লাক্কনি, নুংঙাইনা লৈবীয়ু।`;
      } else if (lang === 'kha') {
        return `La phah ia ka SOS sha ka nongsumar bad ki ba ha-iing. Kan wan iarap kloi. Shongsuk.`;
      } else if (lang === 'lus') {
        return `I enkawltu leh chhungte hnenah SOS thawn a ni tawh e. Puihna a rawn thleng tep e.`;
      } else if (lang === 'nag') {
        return `Apuni laga caregiver ke SOS emergency signal pathai dise. Madat ahibo, bhal pora thakibi.`;
      } else if (lang === 'ny') {
        return `No laga caregiver lw SOS emergency signal thapika dwnam. Madat ahe, bhal dwnam.`;
      } else {
        return `Emergency SOS signal sent immediately to your caregiver and emergency contacts. Help is on the way. Please stay calm and safe.`;
      }
    }

    // 1. Person lookup
    for (const person of people) {
      if (
        person.name &&
        (q.includes(person.name.toLowerCase()) ||
          (q.includes('who is') && q.includes(person.name.toLowerCase())))
      ) {
        if (lang === 'as') return `${person.name} আপোনাৰ ${person.relationship}। ${person.notes || ''}`;
        if (lang === 'bn') return `${person.name} আপনার ${person.relationship}। ${person.notes || ''}`;
        if (lang === 'ne') return `${person.name} तपाईंको ${person.relationship} हुनुहुन्छ। ${person.notes || ''}`;
        return `${person.name} is your ${person.relationship}.${person.notes ? ` ${person.notes}` : ''}`;
      }
    }

    if (q.includes('breakfast') || q.includes('জলপান') || q.includes('নাস্তা') || q.includes('when is breakfast')) {
      const bfast = routines.find(r => r.activity.toLowerCase().includes('breakfast')) || routines[1];
      const time = bfast ? bfast.time : '08:00 AM';
      if (lang === 'as') {
        return `আপোনাৰ ৰাতিপুৱাৰ পুষ্টিকৰ জলপানৰ সময় হৈছে ৰাতিপুৱা ${time} বজাত।`;
      } else if (lang === 'bn') {
        return `আপনার সকালের নাস্তার সময় সকাল ${time} টায়।`;
      } else if (lang === 'ne') {
        return `तपाईंको बिहानको खाजा खाने समय बिहान ${time} बजे हो।`;
      } else {
        return `Your healthy breakfast and warm tea is scheduled at ${time}.`;
      }
    }

    if (q.includes('visit') || q.includes('coming') || q.includes('কোনে') || q.includes('কে আসবে') || q.includes('visiting')) {
      if (people.length > 0) {
        const pList = people.map(p => `${p.name} (${p.relationship})`).join(', ');
        if (lang === 'as') return `আপোনাৰ পৰিয়ালৰ সদস্যসকল হৈছে: ${pList}।`;
        if (lang === 'bn') return `আপনার পরিবারের প্রিয়জনেরা হলেন: ${pList}।`;
        return `Your familiar family members and visitors are: ${pList}.`;
      } else {
        const caregiver = profile.caregiverName || 'Your caregiver';
        if (lang === 'as') return `আপোনাৰ মুখ্য সহায়ক হৈছে ${caregiver}।`;
        if (lang === 'bn') return `আপনার প্রধান কেয়ারগিভার হলেন ${caregiver}।`;
        return `Your primary caregiver is ${caregiver}.`;
      }
    }

    if (q.includes('game') || q.includes('activity') || q.includes('খেল') || q.includes('খেলা') || q.includes('next activity')) {
      if (lang === 'as') {
        return `আপোনাৰ আজিৰ বাবে পৰামৰ্শ দিয়া খেল হৈছে: মেমৰি ম্যাচ (Memory Match)। মগজু সতেজ ৰাখিবলৈ আহক খেলোঁ!`;
      } else if (lang === 'bn') {
        return `আপনার আজকের প্রস্তাবিত খেলা হলো: মেমরি ম্যাচ (Memory Match)। চলুন খেলা যাক!`;
      } else {
        return `Your recommended activity for today is Memory Match card game. It takes only 4 minutes!`;
      }
    }

    if (q.includes('today') || q.includes('routine') || q.includes('schedule') || q.includes('আজি') || q.includes('আজ')) {
      if (reminders.length > 0) {
        const remList = reminders.map(r => `${r.time} - ${r.title}`).join(', ');
        if (lang === 'as') return `আজিৰ সূচী: ${remList}।`;
        if (lang === 'bn') return `আজকের অনুস্মারক সূচী: ${remList}।`;
        return `Today's schedule: ${remList}.`;
      } else {
        if (lang === 'as') return `আজি আপোনাৰ দিনলিপিত কোনো অতিৰিক্ত কাম তালিকাভুক্ত নাই।`;
        if (lang === 'bn') return `আজ আপনার দিনলিপিতে কোনো অতিরিক্ত কাজ নির্ধারিত নেই।`;
        return `You have a calm and peaceful schedule today.`;
      }
    }

    // Default friendly response
    const pName = profile.name && profile.name !== 'Meena Sharma' ? profile.name : 'friend';
    const cgName = profile.caregiverName && profile.caregiverName !== 'Anitha' ? profile.caregiverName : 'caregiver';

    if (lang === 'as') {
      return `আপুনি অতি সুন্দৰভাৱে দিনটো কটাইছে, ${pName}! আপোনাৰ সহায়ক সদায় আপোনাৰ লগত আছে।`;
    } else if (lang === 'bn') {
      return `আপনি খুব ভালো করছেন, ${pName}! আপনার কেয়ারগিভার সবসময় আপনার পাশে আছেন।`;
    } else {
      return `You are doing wonderfully today, ${pName}! Your caregiver is connected and ready to support you.`;
    }
  };

  const handleStartListening = () => {
    setState('LISTENING');
    setErrorMessage(null);
    setUserSpeechText('');

    const listener = SpeechRecognitionService.startListening({
      languageCode: language,
      onResult: (transcript) => {
        setUserSpeechText(transcript);
        handleProcessSpeech(transcript);
      },
      onError: (err) => {
        setErrorMessage(err);
        setState('ERROR');
      },
      onEnd: () => {
        // Recognition ended
      },
    });

    activeListenerRef.current = listener;
  };

  const handleProcessSpeech = (spokenQuery: string) => {
    setState('PROCESSING');
    setTimeout(() => {
      const reply = processQueryInLanguage(spokenQuery);
      setBotResponseText(reply);
      setState('SPEAKING');

      TextToSpeechService.speak(reply, language, 0.9, true, () => {
        setState('RESPONSE');
      });
    }, 600);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setUserSpeechText(manualInput.trim());
    handleProcessSpeech(manualInput.trim());
    setManualInput('');
  };

  const handlePlayVoiceAgain = () => {
    if (botResponseText) {
      setState('SPEAKING');
      TextToSpeechService.speak(botResponseText, language, 0.9, true, () => {
        setState('RESPONSE');
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-[#26332F]/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-[#E4DED4] space-y-6 text-[#26332F] animate-fade-in relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-[#66736D] hover:text-[#26332F] hover:bg-[#EFD4D3]/50 rounded-full transition cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <span className="text-xs uppercase font-extrabold px-3 py-1 rounded-full bg-[#DDE9D9] text-[#176B61] border border-[#B7D4CC] inline-flex items-center gap-1.5">
            {languageProfile.flag} {languageProfile.nativeName} ({languageProfile.state})
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#26332F] mt-2">
            {t('voice.title')}
          </h2>
          <p className="text-xs text-[#66736D] font-semibold">{t('voice.subtitle')}</p>
        </div>

        {/* Status Animation Area */}
        <div className="bg-[#FAF9F4] border border-[#E4DED4] rounded-3xl p-6 text-center space-y-4 shadow-inner min-h-[220px] flex flex-col justify-center items-center">
          {state === 'IDLE' && (
            <>
              <button
                onClick={handleStartListening}
                className="w-24 h-24 bg-[#176B61] hover:bg-[#12564E] text-white rounded-full flex items-center justify-center shadow-xl shadow-[#176B61]/30 transition transform hover:scale-105 active:scale-95 border-4 border-white cursor-pointer"
              >
                <Mic className="w-12 h-12" />
              </button>
              <p className="text-sm font-extrabold text-[#26332F]">Press microphone to speak</p>
            </>
          )}

          {state === 'LISTENING' && (
            <div className="space-y-4">
              <div className="w-24 h-24 bg-[#DCEEEF] text-[#176B61] rounded-full flex items-center justify-center shadow-xl ring-8 ring-[#DCEEEF]/50 animate-pulse mx-auto">
                <Mic className="w-12 h-12" />
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#DCEEEF] text-[#176B61] font-extrabold text-sm border border-[#B7D4CC]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#176B61] animate-ping"></span>
                {t('voice.listening')}
              </div>
            </div>
          )}

          {state === 'PROCESSING' && (
            <div className="space-y-3">
              <div className="w-16 h-16 bg-[#DDE9D9] text-[#176B61] rounded-2xl flex items-center justify-center mx-auto shadow-xs animate-bounce border border-[#B7D4CC]">
                <Sparkles className="w-8 h-8" />
              </div>
              <p className="text-sm font-extrabold text-[#176B61]">{t('voice.thinking')}</p>
            </div>
          )}

          {(state === 'RESPONSE' || state === 'SPEAKING') && (
            <div className="space-y-3 text-left w-full animate-fade-in">
              {userSpeechText && (
                <div className="bg-white p-3 rounded-2xl border border-[#E4DED4] text-xs">
                  <span className="text-[#66736D] font-bold block uppercase text-[10px]">You said:</span>
                  <p className="text-[#26332F] font-extrabold text-sm mt-0.5">"{userSpeechText}"</p>
                </div>
              )}

              <div className="bg-white border border-[#E4DED4] p-4 rounded-2xl space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-[#176B61] font-extrabold text-xs">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-[#176B61]" /> SIROI Response
                  </span>
                  {state === 'SPEAKING' && (
                    <span className="text-[10px] bg-[#DDE9D9] text-[#176B61] px-2 py-0.5 rounded-full animate-pulse border border-[#B7D4CC]">
                      🔊 {t('voice.speaking')}
                    </span>
                  )}
                </div>
                <p className="text-[#26332F] font-bold text-sm sm:text-base leading-relaxed">
                  {botResponseText}
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handlePlayVoiceAgain}
                  className="flex-1 py-2.5 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" /> {t('voice.playAgain')}
                </button>
                <button
                  onClick={handleStartListening}
                  className="px-4 py-2.5 bg-[#F4EBD7] hover:bg-[#ecdcb9] text-[#26332F] font-bold text-xs rounded-xl transition flex items-center gap-1 border border-[#E4DED4] cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Ask another
                </button>
              </div>
            </div>
          )}

          {state === 'ERROR' && (
            <div className="space-y-3 text-center">
              <div className="w-12 h-12 bg-[#EFD4D3] text-[#26332F] rounded-full flex items-center justify-center mx-auto border border-[#DEAFB5]">
                <AlertCircle className="w-6 h-6 text-[#CD8366]" />
              </div>
              <p className="text-xs text-[#26332F] font-semibold">{errorMessage}</p>
              <button
                onClick={handleStartListening}
                className="px-4 py-2 bg-[#176B61] hover:bg-[#12564E] text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Try Mic Again
              </button>
            </div>
          )}
        </div>

        {/* Quick Prompts */}
        <div className="space-y-2">
          <span className="text-xs font-extrabold text-[#66736D] uppercase tracking-wider flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-[#176B61]" /> Tap a supported question:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setUserSpeechText(qp.label);
                  handleProcessSpeech(qp.query);
                }}
                className="px-3 py-1.5 bg-[#F4EBD7] hover:bg-[#ecdcb9] text-[#26332F] border border-[#E4DED4] rounded-xl text-xs font-bold transition text-left cursor-pointer"
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Manual Type Input Fallback */}
        <form onSubmit={handleManualSubmit} className="flex gap-2 pt-2 border-t border-[#E4DED4]">
          <input
            type="text"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            placeholder={`Ask in ${languageProfile.nativeName} or English...`}
            className="flex-1 px-4 py-3 bg-white border border-[#DDD9D0] rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none text-[#26332F]"
          />
          <button
            type="submit"
            className="px-5 py-3 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
