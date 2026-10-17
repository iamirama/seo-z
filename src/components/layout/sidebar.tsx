'use client';

import { useState } from 'react';
import { LayoutDashboard, FileSearch, ListChecks, FileText, History, Settings, SlidersHorizontal, Menu, X } from 'lucide-react';
import { useAppStore, ViewKey } from '@/lib/store/ui';
import { cn } from '@/lib/utils';

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & scores' },
  { key: 'new-audit', label: 'New Audit', icon: FileSearch, description: 'Start SEO scan' },
  { key: 'results', label: 'Audit Results', icon: ListChecks, description: 'Findings detail' },
  { key: 'recommendations', label: 'Recommendations', icon: FileText, description: 'Action plan' },
  { key: 'reports', label: 'Reports', icon: FileText, description: 'Download HTML report' },
  { key: 'history', label: 'Scan History', icon: History, description: 'Compare scans' },
  { key: 'api-settings', label: 'API & Services', icon: Settings, description: 'Provider config' },
  { key: 'app-settings', label: 'App Settings', icon: SlidersHorizontal, description: 'App preferences' },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { activeView, setActiveView, activeScanId } = useAppStore();

  const handleNav = (key: ViewKey) => {
    if ((key === 'results' || key === 'reports' || key === 'recommendations') && !activeScanId) {
      setActiveView('new-audit');
    } else {
      setActiveView(key);
    }
    // بعد از کلیک روی هر لینک در موبایل، سایدبار بسته شود
    setIsOpen(false);
  };

  return (
    <>
      {/* دکمه منو (Hamburger) که فقط در موبایل دیده می‌شود */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 bg-background border rounded-md shadow-sm hover:bg-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* پس‌زمینه تاریک وقتی سایدبار باز است (فقط در موبایل) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* سایدبار */}
      <aside
        className={cn(
          "w-64 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground flex flex-col h-screen",
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:relative md:translate-x-0 md:z-auto md:sticky md:top-0"
        )}
      >
        <div className="p-6 border-b border-sidebar-border flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold tracking-tight">SEO Auditor</h1>
            <p className="text-xs text-sidebar-foreground/60 mt-1">Professional audit &amp; analysis</p>
          </div>
          {/* دکمه بستن (X) که فقط در موبایل دیده می‌شود */}
          <button
            className="md:hidden p-1 text-sidebar-foreground/60 hover:text-sidebar-foreground mt-1"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.key;
              const disabledHint = !activeScanId && (item.key === 'results' || item.key === 'reports' || item.key === 'recommendations');
              return (
                <li key={item.key}>
                  <button
                    onClick={() => handleNav(item.key)}
                    className={cn(
                      'w-full flex items-start gap-3 rounded-md px-3 py-2 text-sm transition-colors text-left',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                        : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80',
                    )}
                    title={disabledHint ? 'Run a scan first' : item.description}
                  >
                    <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span>{item.label}</span>
                      {disabledHint && (
                        <span className="text-[10px] text-sidebar-foreground/40 leading-tight">Run a scan first</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-3 border-t border-sidebar-border text-xs text-sidebar-foreground/50">
          <p>v1.0 · by: amirhoseini</p>
          <p className="mt-1">This application is exclusively developed for <a href="https://jaheshclinic.ir">Jahesh Orthopedic Clinic</a>.</p>
        </div>
      </aside>
    </>
  );
}
