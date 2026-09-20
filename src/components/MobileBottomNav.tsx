import React from 'react';
import { Home, Gamepad2, MessageSquare, Bell, User, LayoutDashboard, Clock, QrCode, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface MobileBottomNavProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentTab, onNavigate }) => {
  const { role } = useAuth();

  if (role === 'elderly') {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FAF9F4]/95 backdrop-blur-xs border-t border-[#E4DED4] z-40 shadow-xl px-2 py-1">
        <div className="grid grid-cols-5 gap-1 text-center">
          <button
            onClick={() => onNavigate('home')}
            className={`flex flex-col items-center justify-center py-2 rounded-xl transition min-h-[56px] ${
              currentTab === 'home' ? 'bg-[#176B61] text-white font-extrabold shadow-sm' : 'text-[#66736D] hover:bg-[#F4EBD7]/50'
            }`}
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span className="text-xs font-bold">Home</span>
          </button>

          <button
            onClick={() => onNavigate('games')}
            className={`flex flex-col items-center justify-center py-2 rounded-xl transition min-h-[56px] ${
              currentTab === 'games' ? 'bg-[#176B61] text-white font-extrabold shadow-sm' : 'text-[#66736D] hover:bg-[#F4EBD7]/50'
            }`}
          >
            <Gamepad2 className="w-5 h-5 mb-0.5" />
            <span className="text-xs font-bold">Games</span>
          </button>

          <button
            onClick={() => onNavigate('assistant')}
            className={`flex flex-col items-center justify-center py-2 rounded-xl transition min-h-[56px] ${
              currentTab === 'assistant' ? 'bg-[#176B61] text-white font-extrabold shadow-sm' : 'text-[#66736D] hover:bg-[#F4EBD7]/50'
            }`}
          >
            <MessageSquare className="w-5 h-5 mb-0.5" />
            <span className="text-xs font-bold">Memory</span>
          </button>

          <button
            onClick={() => onNavigate('reminders')}
            className={`flex flex-col items-center justify-center py-2 rounded-xl transition min-h-[56px] ${
              currentTab === 'reminders' ? 'bg-[#176B61] text-white font-extrabold shadow-sm' : 'text-[#66736D] hover:bg-[#F4EBD7]/50'
            }`}
          >
            <Bell className="w-5 h-5 mb-0.5" />
            <span className="text-xs font-bold">Reminders</span>
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className={`flex flex-col items-center justify-center py-2 rounded-xl transition min-h-[56px] ${
              currentTab === 'settings' ? 'bg-[#176B61] text-white font-extrabold shadow-sm' : 'text-[#66736D] hover:bg-[#F4EBD7]/50'
            }`}
          >
            <User className="w-5 h-5 mb-0.5" />
            <span className="text-xs font-bold">Profile</span>
          </button>
        </div>
      </nav>
    );
  }

  // Caregiver navigation on mobile
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FAF9F4]/95 backdrop-blur-xs border-t border-[#E4DED4] text-[#26332F] z-40 px-2 py-1">
      <div className="grid grid-cols-5 gap-1 text-center">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl transition min-h-[52px] ${
            currentTab === 'dashboard' ? 'bg-[#DDE9D9] text-[#176B61] font-extrabold shadow-xs' : 'text-[#66736D] hover:text-[#26332F]'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Dashboard</span>
        </button>

        <button
          onClick={() => onNavigate('history')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl transition min-h-[52px] ${
            currentTab === 'history' ? 'bg-[#DDE9D9] text-[#176B61] font-extrabold shadow-xs' : 'text-[#66736D] hover:text-[#26332F]'
          }`}
        >
          <Clock className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">History</span>
        </button>

        <button
          onClick={() => onNavigate('alerts')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl transition min-h-[52px] ${
            currentTab === 'alerts' ? 'bg-[#DDE9D9] text-[#176B61] font-extrabold shadow-xs' : 'text-[#66736D] hover:text-[#26332F]'
          }`}
        >
          <Bell className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Alerts</span>
        </button>

        <button
          onClick={() => onNavigate('connect')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl transition min-h-[52px] ${
            currentTab === 'connect' ? 'bg-[#DDE9D9] text-[#176B61] font-extrabold shadow-xs' : 'text-[#66736D] hover:text-[#26332F]'
          }`}
        >
          <QrCode className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">QR Sync</span>
        </button>

        <button
          onClick={() => onNavigate('settings')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl transition min-h-[52px] ${
            currentTab === 'settings' ? 'bg-[#DDE9D9] text-[#176B61] font-extrabold shadow-xs' : 'text-[#66736D] hover:text-[#26332F]'
          }`}
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Settings</span>
        </button>
      </div>
    </nav>
  );
};
