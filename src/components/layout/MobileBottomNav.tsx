import React from 'react';
import { MessageCircle, Phone, Users, Settings } from 'lucide-react';

export type NavTab = 'chat' | 'calls' | 'family' | 'settings';

interface MobileBottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isGuardian: boolean;
}

interface NavItem {
  tab: NavTab;
  icon: React.ReactNode;
  label: string;
  guardianOnly?: boolean;
}

const navItems: NavItem[] = [
  { tab: 'chat', icon: <MessageCircle className="h-5 w-5" />, label: 'Chat' },
  { tab: 'calls', icon: <Phone className="h-5 w-5" />, label: 'Chamadas' },
  { tab: 'family', icon: <Users className="h-5 w-5" />, label: 'Família', guardianOnly: true },
  { tab: 'settings', icon: <Settings className="h-5 w-5" />, label: 'Config.' },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  isGuardian,
}) => {
  const visibleItems = navItems.filter(item => !item.guardianOnly || isGuardian);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 shadow-lg md:hidden">
      <div className="flex">
        {visibleItems.map(({ tab, icon, label }) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {icon}
              <span className={`text-[10px] font-medium ${isActive ? 'text-indigo-600' : ''}`}>
                {label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 h-0.5 w-8 bg-indigo-600 rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

