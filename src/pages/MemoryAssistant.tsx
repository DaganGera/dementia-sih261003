import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../services/storage';
import { AlertEngineService } from '../services/alertEngine';
import { useI18n } from '../i18n';
import { TextToSpeechService } from '../services/textToSpeech';
import { useAuth } from '../context/AuthContext';
import {
  recognizeNavigationIntent,
  getNavigationResponse,
  getRouteForIntent,
} from '../services/voiceNavigationEngine';
import {
  MemoryAssistantEngine,
  MemoryAssistantResources,
  DynamicQuestion,
} from '../services/memoryAssistantEngine';
import { MessageSquare, Send, Volume2, Sparkles, User, Calendar, Bell, HelpCircle, RefreshCw } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface MemoryAssistantProps {
  onNavigate?: (page: string) => void;
  onPlayGame?: (gameId?: string) => void;
}

export const MemoryAssistant: React.FC<MemoryAssistantProps> = ({ onNavigate, onPlayGame }) => {
  const { language, languageProfile, t } = useI18n();
  const { user, role } = useAuth();

  const activePatientId =
    StorageService.getActivePatientId(user?.id) ||
    (user?.id && user.role !== 'caregiver' ? user.id : undefined);

  const [inputQuery, setInputQuery] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [resources, setResources] = useState<MemoryAssistantResources>({
    patientId: activePatientId || 'pat-demo-1',
    patientName: 'Patient',
    people: [],
    places: [],
    routines: [],
    reminders: [],
    caregiverName: '',
    emergencyPhone: '',
    isLoading: true,
  });

  const [quickQuestions, setQuickQuestions] = useState<DynamicQuestion[]>([]);

  const loadResources = async () => {
    setResources(prev => ({ ...prev, isLoading: true }));
    const res = await MemoryAssistantEngine.fetchPatientResources(activePatientId, user?.id);
    setResources(res);
    const dynamicQs = MemoryAssistantEngine.generateDynamicQuestions(res, language);
    setQuickQuestions(dynamicQs);
  };

  useEffect(() => {
    loadResources();
  }, [activePatientId, user?.id, language]);

  useEffect(() => {
    // Initial welcome message in selected language
    const displayName =
      resources.patientName && resources.patientName !== 'Patient'
        ? resources.patientName
        : (user?.name || 'Friend');

    let welcomeText = `Hello ${displayName}! I am your SIROI Memory Assistant. Ask me anything about your family, daily routine, or upcoming reminders! You can also tell me to open any game or page!`;

    if (language === 'as') {
      welcomeText = `নমস্কাৰ ${displayName}! মই আপোনাৰ SIROI স্মৃতি সহায়ক। আপোনাৰ পৰিয়াল, ৰুটিন বা খেল খোলিবলৈ কথা কওক!`;
    } else if (language === 'bn') {
      welcomeText = `নমস্কার ${displayName}! আমি আপনার SIROI স্মৃতি সহায়ক। আপনার পরিবার, রুটিন বা গেম খোলার নির্দেশ দিন!`;
    } else if (language === 'ne') {
      welcomeText = `नमस्ते ${displayName}! म तपाईंको SIROI स्मृति सहायक हुँ। आफ्नो परिवार, दिनचर्या वा कुनै पनि खेल खोल्न भन्नुहोस्!`;
    } else if (language === 'mni') {
      welcomeText = `খুরুমজরি ${displayName}! আই অদোমগী SIROI নীংশিংবা তেংবাংবনি। ইমুং মনুং নত্রগা শান্নপোৎ হাংদোক্নবা হায়বীয়ু!`;
    } else if (language === 'kha') {
      welcomeText = `Khublei ${displayName}! Nga dei u Memory Assistant. Kylli shaphang ki baha-ïing lane plie ia ki jingialehkai!`;
    } else if (language === 'lus') {
      welcomeText = `Chibai ${displayName}! SIROI Memory Assistant ka ni e. I chhungte leh vawiin thiltum chungchang min zawt raw!`;
    } else if (language === 'nag') {
      welcomeText = `Bhal khobor ${displayName}! Aji apuni laga ghar manu, kaam aro khel khulibole kobi!`;
    } else if (language === 'ny') {
      welcomeText = `Aro bha ${displayName}! Nam, kaka nyishi aro gwnam memory game hapkan!`;
    }

    const welcomeMsg: Message = {
      id: 'msg-welcome',
      sender: 'assistant',
      text: welcomeText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([welcomeMsg]);
    TextToSpeechService.speak(welcomeText, language);
  }, [language, resources.patientName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const processQuery = (queryText: string): string => {
    return MemoryAssistantEngine.processDynamicMemoryQuery(queryText, resources, language);
  };

  const handleSendMessage = (textToSend = inputQuery) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Check Voice Navigation Intent First
    const intent = recognizeNavigationIntent(textToSend, language);
    if (intent !== 'UNKNOWN' && intent !== 'AMBIGUOUS_GAME_PROMPT') {
      const responseText = getNavigationResponse(intent, language);

      if (intent === 'TRIGGER_SOS') {
        const pid = resources.patientId || activePatientId || 'pat-demo-1';
        const pname = resources.patientName || user?.name || 'Patient';
        AlertEngineService.triggerManualSOS(pid, pname);
      }

      const target = getRouteForIntent(intent);

      const botMsg: Message = {
        id: `msg-bot-${Date.now()}`,
        sender: 'assistant',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, userMsg, botMsg]);
      setInputQuery('');

      let navigated = false;
      const executeNavigation = () => {
        if (navigated) return;
        navigated = true;
        if (target && intent !== 'TRIGGER_SOS') {
          if (target.gameId && onPlayGame) {
            onPlayGame(target.gameId);
          } else if (target.tab && onNavigate) {
            onNavigate(target.tab);
          }
        }
      };

      const speakSuccess = TextToSpeechService.speak(responseText, language, 0.88, true, () => {
        setTimeout(executeNavigation, 350);
      });

      setTimeout(executeNavigation, speakSuccess ? 6000 : 1500);
      return;
    }

    const botResponseText = processQuery(textToSend);

    const botMsg: Message = {
      id: `msg-bot-${Date.now()}`,
      sender: 'assistant',
      text: botResponseText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg, botMsg]);
    setInputQuery('');
    TextToSpeechService.speak(botResponseText, language);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 text-[#26332F] space-y-4">
      <div className="bg-white rounded-3xl p-6 border border-[#E4DED4] shadow-sm space-y-4">
        {/* Header */}
        <div className="flex items-center space-x-3 border-b border-[#E4DED4] pb-4">
          <div className="w-12 h-12 bg-[#176B61] text-white rounded-2xl flex items-center justify-center shadow-xs">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold text-[#26332F]">{t('assistant.title')}</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-[#DDE9D9] text-[#176B61] rounded-full border border-[#B7D4CC]">
                {languageProfile.flag} {languageProfile.nativeName}
              </span>
            </div>
            <p className="text-xs text-[#66736D] font-semibold">{t('assistant.subtitle')}</p>
          </div>
        </div>

        {/* Quick Question Chips */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#66736D] uppercase tracking-wider flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-[#176B61]" /> {t('assistant.tapToAsk')}
            </span>
            <button
              onClick={() => loadResources()}
              disabled={resources.isLoading}
              className="text-[11px] font-bold text-[#176B61] hover:text-[#12564E] flex items-center gap-1 cursor-pointer"
              title="Refresh memories from Supabase"
            >
              <RefreshCw className={`w-3 h-3 ${resources.isLoading ? 'animate-spin' : ''}`} />
              {resources.isLoading ? 'Syncing...' : 'Sync Cloud'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((q) => (
              <button
                key={q.id}
                onClick={() => handleSendMessage(q.query || q.label)}
                className="px-3.5 py-2 bg-[#F4EBD7] hover:bg-[#ecdcb9] text-[#26332F] border border-[#E4DED4] rounded-xl text-xs font-bold transition transform active:scale-95 cursor-pointer"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat History Box */}
        <div className="bg-[#FAF9F4] rounded-2xl p-4 h-[340px] overflow-y-auto space-y-3 border border-[#E4DED4]">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-start space-x-2 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-8 h-8 bg-[#DCEEEF] text-[#176B61] rounded-full flex items-center justify-center text-xs shrink-0 mt-1 border border-[#B7D4CC]">
                  🤖
                </div>
              )}
              <div
                className={`max-w-[80%] p-4 rounded-2xl text-sm font-semibold leading-relaxed shadow-xs ${
                  msg.sender === 'user'
                    ? 'bg-[#176B61] text-white rounded-br-none'
                    : 'bg-white text-[#26332F] border border-[#E4DED4] rounded-bl-none'
                }`}
              >
                <p>{msg.text}</p>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#E4DED4]/60 text-[10px] opacity-75">
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'assistant' && (
                    <button
                      onClick={() => TextToSpeechService.speak(msg.text, language)}
                      className="hover:text-[#176B61] p-1 cursor-pointer"
                      title="Listen in regional voice"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={e => setInputQuery(e.target.value)}
            placeholder={t('assistant.placeholder')}
            className="flex-1 px-4 py-3.5 bg-white border border-[#DDD9D0] rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-[#B7D4CC] focus:border-[#176B61] outline-none text-[#26332F]"
          />
          <button
            type="submit"
            className="px-6 py-3.5 bg-[#176B61] hover:bg-[#12564E] text-white font-extrabold rounded-2xl shadow-xs transition flex items-center gap-1 cursor-pointer"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
