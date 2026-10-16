'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { DashboardSection } from '@/components/sections/dashboard';
import { NewAuditSection } from '@/components/sections/new-audit';
import { ResultsSection } from '@/components/sections/results';
import { RecommendationsSection } from '@/components/sections/recommendations';
import { ReportsSection } from '@/components/sections/reports';
import { HistorySection } from '@/components/sections/history';
import { ApiSettingsSection } from '@/components/sections/api-settings';
import { AppSettingsSection } from '@/components/sections/app-settings';
import { useAppStore } from '@/lib/store/ui';

export default function Home() {
  const { activeView } = useAppStore();

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="container mx-auto p-6 max-w-7xl">
          {activeView === 'dashboard' && <DashboardSection />}
          {activeView === 'new-audit' && <NewAuditSection />}
          {activeView === 'results' && <ResultsSection />}
          {activeView === 'recommendations' && <RecommendationsSection />}
          {activeView === 'reports' && <ReportsSection />}
          {activeView === 'history' && <HistorySection />}
          {activeView === 'api-settings' && <ApiSettingsSection />}
          {activeView === 'app-settings' && <AppSettingsSection />}
        </div>
      </main>
    </div>
  );
}
