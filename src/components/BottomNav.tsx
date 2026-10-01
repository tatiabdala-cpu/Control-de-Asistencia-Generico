import React from 'react';
import { ClipboardCheck, Users, FileSpreadsheet, Settings } from 'lucide-react';

export type NavTab = 'attendance' | 'history' | 'courses' | 'settings';

interface BottomNavProps {
  currentTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onChangeTab }) => {
  const navItems = [
    { id: 'attendance' as NavTab, label: 'Asistencia', icon: ClipboardCheck },
    { id: 'history' as NavTab, label: 'Planillas', icon: FileSpreadsheet },
    { id: 'courses' as NavTab, label: 'Cursos', icon: Users },
    { id: 'settings' as NavTab, label: 'Ajustes', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#12151b]/98 backdrop-blur-lg border-t border-slate-200 dark:border-[#252b37] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 px-3 shadow-lg dark:shadow-2xl transition-colors">
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all relative ${
                isActive
                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
              }`}
            >
              {isActive && (
                <span className="absolute top-1 w-7 h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" />
              )}
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-[1.8]'}`} />
              <span className="text-[11px] tracking-tight mt-1 leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
