// Global UI state (active view, etc.) using Zustand.
import { create } from 'zustand';

export type ViewKey =
  | 'dashboard'
  | 'new-audit'
  | 'results'
  | 'recommendations'
  | 'reports'
  | 'history'
  | 'api-settings'
  | 'app-settings';

interface AppState {
  activeView: ViewKey;
  activeScanId: string | null;  // For results/reports views
  activeWebsiteId: string | null;
  setActiveView: (view: ViewKey) => void;
  setActiveScanId: (id: string | null) => void;
  setActiveWebsiteId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'dashboard',
  activeScanId: null,
  activeWebsiteId: null,
  setActiveView: (view) => set({ activeView: view }),
  setActiveScanId: (id) => set({ activeScanId: id }),
  setActiveWebsiteId: (id) => set({ activeWebsiteId: id }),
}));
