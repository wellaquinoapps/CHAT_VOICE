import React from 'react';
import { MessageCircle, Phone, Users, Settings, LogOut, Shield } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import type { NavTab } from './MobileBottomNav';

interface DesktopSidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isGuardian: boolean;
  userName?: string;
  onSignOut: () => void;
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
  { tab: 'settings', icon: <Settings className="h-5 w-5" />, label: 'Configurações' },
];

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onTabChange,
  isGuardian,
  userName,
  onSignOut,
}) => {
  const visibleItems = navItems.filter(item => !item.guardianOnly || isGuardian);

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 shadow-sm h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-100">
        <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="font-bold text-gray-900 text-sm">PrivateLine</span>
          <p className="text-[10px] text-gray-400">Comunicação familiar</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-3">
        {visibleItems.map(({ tab, icon, label }) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {icon}
              {label}
            </button>
          );
        })}
      </nav>

      {/* Profile footer */}
      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar name={userName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userName ?? 'Usuário'}</p>
            {isGuardian && (
              <p className="text-xs text-indigo-600 font-medium">Responsável</p>
            )}
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
};

