import React, { useState } from 'react';
import {
  Activity,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ActiveTab } from '../types';

interface LayoutProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'doctors', label: 'Doctors', icon: Stethoscope },
  { id: 'patients', label: 'Patients', icon: Users },
];

export function Layout({
  activeTab,
  onTabChange,
  primaryActionLabel,
  onPrimaryAction,
  children,
}: LayoutProps) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab)!;

  const handleSelectTab = (tab: ActiveTab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200 w-60">
      <div>
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white shrink-0">
            <Activity className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Doctor Tracker
          </span>
        </div>

        <nav className="p-3 space-y-1" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-teal-700' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-200 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap"
        >
          <LogOut className="h-3.5 w-3.5 text-slate-500" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:shrink-0">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex h-full">
            {sidebarContent}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="ml-2 mt-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 shadow-md"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">Portal</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-display text-base sm:text-lg font-semibold text-slate-900 truncate">
                {currentNav.label}
              </h1>
            </div>
          </div>

          {primaryActionLabel && onPrimaryAction && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-teal-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>{primaryActionLabel}</span>
            </button>
          )}
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
