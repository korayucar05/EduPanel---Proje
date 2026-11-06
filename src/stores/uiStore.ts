import { create } from "zustand";

interface UIState {
  activeModule: string;
  sidebarOpen: boolean;
  globalLoading: boolean;
  globalError: string | null;
  setActiveModule: (value: string) => void;
  setSidebarOpen: (value: boolean) => void;
  toggleSidebar: () => void;
  setGlobalLoading: (value: boolean) => void;
  setGlobalError: (value: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeModule: "dashboard", sidebarOpen: true, globalLoading: false, globalError: null,
  setActiveModule: (activeModule) => set({ activeModule }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setGlobalLoading: (globalLoading) => set({ globalLoading }),
  setGlobalError: (globalError) => set({ globalError }),
}));
