import React from 'react';
import { OfflineBanner } from './OfflineBanner';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import type { NavTab } from './MobileBottomNav';

interface AppShellProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isGuardian: boolean;
  userName?: string;
  onSignOut: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onTabChange,
  isGuardian,
  userName,
  onSignOut,
  children,
}) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <OfflineBanner />

      <div className="flex h-screen">
        <DesktopSidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          isGuardian={isGuardian}
          userName={userName}
          onSignOut={onSignOut}
        />

        {/* Main content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>

      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        isGuardian={isGuardian}
      />
    </div>
  );
};

