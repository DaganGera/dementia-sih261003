import React from 'react';
import { Brain, HeartHandshake, Users, ShieldCheck, ArrowRight, Sparkles, QrCode, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SiroiLilyLogo } from '../components/SiroiBotanical';

interface LandingProps {
  onNavigate: (page: string) => void;
}

export const Landing: React.FC<LandingProps> = ({ onNavigate }) => {
  const { loginAsDemoCaregiver, loginAsDemoElderly } = useAuth();

  const handleDemoCaregiver = () => {
    loginAsDemoCaregiver();
    onNavigate('dashboard');
  };

  const handleDemoElderly = () => {
    loginAsDemoElderly();
    onNavigate('home');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-teal-50/30 to-slate-100 text-slate-900 font-sans">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-100/80 text-teal-800 border border-teal-200 text-xs font-bold mb-6">
          <Sparkles className="w-4 h-4 text-teal-600 animate-spin" style={{ animationDuration: '6s' }} />
          <span>SIH26003 • North Eastern Region (NER) Cognitive Platform Prototype</span>
        </div>

        <SiroiLilyLogo className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 drop-shadow-sm" />
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-tight">
          SIROI
        </h1>
        <p className="text-xl sm:text-2xl font-bold text-teal-700 mt-2">
          "Personalized Cognitive Support for Everyday Life"
        </p>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mt-4 leading-relaxed">
          Adaptive cognitive games, memory assistance, and caregiver insights — in one simple platform.
        </p>

        {/* Primary CTA Authentication Options */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto">
          <button
            onClick={() => onNavigate('/caregiver/login')}
            className="w-full sm:w-auto flex-1 px-7 py-4 bg-teal-700 hover:bg-teal-800 text-white rounded-2xl font-extrabold text-lg shadow-lg shadow-teal-700/30 transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
          >
            👨‍⚕️ Caregiver Login
          </button>

          <button
            onClick={() => onNavigate('/patient/login')}
            className="w-full sm:w-auto flex-1 px-7 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-extrabold text-lg shadow-lg shadow-emerald-600/30 transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
          >
            👵 Patient Login
          </button>
        </div>

        {/* New Caregiver Registration Option */}
        <div className="mt-4 text-center">
          <p className="text-sm font-semibold text-slate-700">
            New caregiver?{' '}
            <button
              onClick={() => onNavigate('/caregiver/signup')}
              className="font-extrabold text-teal-700 hover:text-teal-900 underline ml-1 cursor-pointer"
            >
              Create Caregiver Account
            </button>
          </p>
        </div>

        <div className="mt-4 flex justify-center">
          <button
            onClick={() => onNavigate('connect')}
            className="px-5 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-sky-600" /> Connect Device (QR Pairing)
          </button>
        </div>

        {/* Quick Instant Demo Account Shortcuts for Hackathon Judges */}
        <div className="mt-10 p-4 bg-white/80 backdrop-blur-sm border-2 border-teal-200 rounded-3xl max-w-xl mx-auto shadow-md">
          <p className="text-xs font-extrabold uppercase tracking-wider text-teal-800 mb-3 flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-teal-600" /> Instant Demo Mode for Judges & Evaluators:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleDemoCaregiver}
              className="py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-sm shadow transition flex items-center justify-center gap-2"
            >
              👨‍⚕️ Continue as Demo Caregiver
            </button>
            <button
              onClick={handleDemoElderly}
              className="py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-sm shadow transition flex items-center justify-center gap-2"
            >
              👵 Continue as Demo Elderly
            </button>
          </div>
        </div>

        <p className="text-xs font-semibold text-slate-500 mt-6 italic">
          Designed for elderly-friendly digital experiences with high contrast, large touch targets, and voice guidance.
        </p>
      </section>

      {/* Feature Cards Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl hover:shadow-2xl transition group">
            <div className="w-14 h-14 bg-teal-100 text-teal-700 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition">
              <Brain className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 mb-3">🧠 Cognitive Games</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              5 adaptive cognitive games including Memory Match, Sequence Recall, Object Recall, Name & Face Memory, and Story Recall designed for gentle daily stimulation.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl hover:shadow-2xl transition group">
            <div className="w-14 h-14 bg-sky-100 text-sky-700 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition">
              <HeartHandshake className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 mb-3">🤝 Memory Assistance</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Conversational assistant helping elderly users quickly recall family members, daily routine schedules, upcoming visits, and morning reminders.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl hover:shadow-2xl transition group">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 mb-3">👨‍👩‍👧 Caregiver Support</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Comprehensive caregiver dashboard featuring Recharts activity analytics, familiar profile setup, QR pairing, and non-medical AI activity insights.
            </p>
          </div>
        </div>
      </section>

      {/* Medical Safety Disclaimer Banner */}
      <footer className="max-w-4xl mx-auto px-4 py-8 text-center border-t border-slate-200 mt-12">
        <div className="inline-flex items-center gap-2 text-xs text-slate-500 bg-slate-200/60 px-4 py-2 rounded-full">
          <Lock className="w-4 h-4 text-slate-600" />
          <span>SIROI is a cognitive support & engagement platform. Information is private and non-clinical.</span>
        </div>
      </footer>
    </div>
  );
};
