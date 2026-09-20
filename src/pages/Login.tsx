import React from 'react';
import { Heart, Brain, QrCode, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  SiroiLilyLogo,
  SiroiTopRightLily,
  SiroiBottomLeftLily,
  SiroiBottomRightLily,
} from '../components/SiroiBotanical';

interface LoginProps {
  onNavigate: (page: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigate }) => {
  const { loginAsDemoCaregiver, loginAsDemoElderly } = useAuth();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#FAF7F2] relative flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 overflow-x-hidden overflow-y-auto select-none">
      
      {/* ── BOTANICAL CORNER LILIES (GENEROUS SIZING ANCHORED TO CORNERS) ── */}
      {/* Top Right: Twin drooping bell lilies reaching inward towards the Why Siroi card */}
      <SiroiTopRightLily className="absolute top-0 right-0 w-60 sm:w-72 md:w-84 lg:w-[360px] xl:w-[420px] 2xl:w-[460px] pointer-events-none z-0 drop-shadow-2xs" />
      
      {/* Bottom Left: Slender arching stem & nodding lily reaching towards center card */}
      <SiroiBottomLeftLily className="absolute bottom-0 left-0 w-48 sm:w-60 md:w-72 lg:w-80 xl:w-[340px] 2xl:w-[380px] pointer-events-none z-0 drop-shadow-2xs" />
      
      {/* Bottom Right: Upright stalk with nodding lily balancing bottom right */}
      <SiroiBottomRightLily className="absolute bottom-0 right-0 w-48 sm:w-60 md:w-72 lg:w-80 xl:w-[340px] 2xl:w-[380px] pointer-events-none z-0 drop-shadow-2xs" />

      {/* ── MAIN CENTER COMPOSITION ──────────────────────────────── */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center my-auto py-4 sm:py-6">
        
        {/* Siroi Brand Header (Centered directly on the vertical center axis) */}
        <div className="text-center mb-5 sm:mb-7 animate-fade-in flex flex-col items-center">
          <SiroiLilyLogo className="w-13 h-13 sm:w-15 sm:h-15 mb-1.5" />
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#4A3528] tracking-tight">
            Siroi
          </h1>
        </div>

        {/* ── CENTERED LOGIN CARD & DESKTOP SIDE STORY CARD ─────────── */}
        <div className="relative w-full max-w-[390px] sm:max-w-[400px] flex flex-col items-center">
          
          {/* ── CARD 1: HOW WOULD YOU LIKE TO CONTINUE? (CENTERED) ──── */}
          <div className="w-full bg-white rounded-3xl sm:rounded-[32px] p-6 sm:p-8 border border-[#EDE3D4] shadow-[0_12px_35px_rgba(74,53,40,0.06)] space-y-5 text-center animate-fade-in z-10">
            
            {/* Card Heading */}
            <div>
              <h2 className="text-xl sm:text-[22px] font-bold text-[#2B211A] tracking-tight">
                How would you like to continue?
              </h2>
              <p className="text-xs text-[#8C7D72] mt-1 font-normal">
                How would you like to continue?
              </p>
            </div>

            {/* Main Action Buttons */}
            <div className="space-y-3">
              {/* Caregiver Login */}
              <button
                onClick={() => onNavigate('/caregiver/login')}
                className="w-full py-3.5 px-6 bg-[#9E5536] hover:bg-[#8A4628] text-white font-bold text-sm sm:text-base rounded-2xl shadow-xs hover:shadow-md transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Heart className="w-4 h-4 text-white/90" />
                <span>Caregiver Login</span>
              </button>

              {/* Patient Login */}
              <button
                onClick={() => onNavigate('/patient/login')}
                className="w-full py-3.5 px-6 bg-[#C57E84] hover:bg-[#B36C73] text-white font-bold text-sm sm:text-base rounded-2xl shadow-xs hover:shadow-md transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Brain className="w-4 h-4 text-white/90" />
                <span>Patient Login</span>
              </button>

              {/* QR Pair Device */}
              <button
                onClick={() => onNavigate('/connect')}
                className="w-full py-3.5 px-6 bg-[#C88656] hover:bg-[#B57444] text-white font-bold text-sm sm:text-base rounded-2xl shadow-xs hover:shadow-md transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-white/90" />
                <span>QR Pair Device</span>
              </button>
            </div>

            {/* New Caregiver Section */}
            <div className="pt-2 border-t border-[#EFE5D8] space-y-2">
              <p className="text-xs font-semibold text-[#8C7D72]">New caregiver?</p>
              <button
                onClick={() => onNavigate('/caregiver/signup')}
                className="w-full py-2.5 px-4 bg-[#F7E2E4] hover:bg-[#EED0D4] border border-[#ECCDD1] text-[#783F46] font-bold text-xs rounded-xl shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-[#783F46]" />
                <span>Create Caregiver Account</span>
              </button>
            </div>

            {/* Demo Shortcuts */}
            <div className="pt-3 border-t border-[#EFE5D8]">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#9C8F84] mb-2.5">
                DEMO SHORTCUTS
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    loginAsDemoCaregiver();
                    onNavigate('/caregiver/dashboard');
                  }}
                  className="py-2.5 px-3 bg-[#F6EFE3] hover:bg-[#EAE0CF] text-[#4A3A2F] font-bold text-xs rounded-xl border border-[#E7DAC7] transition text-center cursor-pointer shadow-2xs"
                >
                  Demo Caregiver
                </button>
                <button
                  onClick={() => {
                    loginAsDemoElderly();
                    onNavigate('/patient/dashboard');
                  }}
                  className="py-2.5 px-3 bg-[#F6EFE3] hover:bg-[#EAE0CF] text-[#4A3A2F] font-bold text-xs rounded-xl border border-[#E7DAC7] transition text-center cursor-pointer shadow-2xs"
                >
                  Demo Patient
                </button>
              </div>
            </div>

          </div>

          {/* ── CARD 2: WHY 'SIROI'? STORY CARD ──────────────────────── */}
          {/* Centered below on mobile; positioned 32px to the right of the center card on desktop */}
          <div className="mt-6 lg:mt-0 lg:absolute lg:left-[calc(100%+32px)] lg:top-1/2 lg:-translate-y-1/2 w-full max-w-[320px] sm:max-w-[340px] bg-[#F7F1E7] border border-[#EFE5D6] rounded-3xl p-6 sm:p-7 shadow-xs space-y-2.5 text-left animate-fade-in z-10">
            <h3 className="font-bold text-xl text-[#36271D]">Why ‘Siroi’?</h3>
            <p className="text-xs sm:text-sm text-[#5C4D42] leading-relaxed font-normal">
              Named after the rare and unique Siroi Lily (<em>Lilium mackliniae</em>), found only in the
              Siroy hills of Manipur, India. Like the Siroi Lily, we aim to provide exceptional,
              dedicated care for individuals with unique needs, representing hope, resilience, and
              natural beauty.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
