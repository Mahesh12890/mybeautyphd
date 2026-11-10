import React from 'react';
import {
  Mic,
  CheckSquare,
  Swords,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { UserAccount } from '../types';
import { playSound } from '../utils/audioUtils';

export type StudioTabType = 'transcribe' | 'vault' | 'tasks' | 'chess';

interface NavbarProps {
  activeTab: StudioTabType;
  onTabChange: (tab: StudioTabType) => void;
  currentUser: UserAccount | null;
  onOpenLogin: () => void;
  onBackToShowcase: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  currentUser,
  onOpenLogin,
  onBackToShowcase,
}) => {
  const tabs = [
    {
      id: 'transcribe' as const,
      label: 'Fieldwork',
      icon: Mic,
    },
    {
      id: 'vault' as const,
      label: 'Documents',
      icon: Layers,
    },
    {
      id: 'tasks' as const,
      label: 'Notes',
      icon: CheckSquare,
    },
    {
      id: 'chess' as const,
      label: 'Chess',
      icon: Swords,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Back to Showcase and Scholar Identity */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <button
            onClick={() => {
              playSound('click');
              onBackToShowcase();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-300 hover:border-slate-800 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
            title="Return to main visual interface"
          >
            <ArrowLeft size={14} />
            <span>Showcase</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
              N
            </div>
            <div className="text-left">
              <span className="text-sm font-bold text-slate-900 block leading-tight tracking-tight">
                Nadasha
              </span>
            </div>
          </div>
        </div>

        {/* Center: Workstation Module Tabs (no tablet background, larger tabs and font) */}
        <nav className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  onTabChange(tab.id);
                  playSound('click');
                }}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm sm:text-[15px] font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/80'
                }`}
              >
                <Icon size={17} className={isActive ? 'text-white' : 'text-slate-500'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Account / Sign In Pill */}
        <div className="flex items-center gap-2.5">
          {currentUser ? (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-800 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-xs text-left"
              title="Account settings and sign out"
            >
              <div className="w-6 h-6 rounded-md bg-slate-900 text-white font-bold text-[11px] flex items-center justify-center">
                {currentUser.avatar}
              </div>
              <span className="text-xs font-semibold text-slate-900">
                {currentUser.name}
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenLogin}
              className="px-4 py-1.5 rounded-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer shadow-xs"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
