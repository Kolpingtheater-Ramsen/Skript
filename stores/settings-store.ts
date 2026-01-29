import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserSettings, CategoryFilter, FilterState } from '@/types';

const defaultFilters: Record<CategoryFilter, FilterState> = {
  actor: { filter: 'actor', enabled: true, contextLines: 0 },
  instruction: { filter: 'instruction', enabled: true, contextLines: 0 },
  technical: { filter: 'technical', enabled: false, contextLines: 0 },
  lighting: { filter: 'lighting', enabled: false, contextLines: 0 },
  audio: { filter: 'audio', enabled: false, contextLines: 0 },
  props: { filter: 'props', enabled: false, contextLines: 0 },
  microphone: { filter: 'microphone', enabled: false, contextLines: 0 },
};

interface SettingsStore extends UserSettings {
  setTheme: (theme: UserSettings['theme']) => void;
  setSelectedActor: (actor: string | null) => void;
  setAutoScroll: (enabled: boolean) => void;
  setLineBlur: (enabled: boolean) => void;
  setFontSize: (size: number) => void;
  setFilter: (filter: CategoryFilter, state: Partial<FilterState>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      selectedActor: null,
      autoScroll: true,
      lineBlur: false,
      fontSize: 16,
      filters: defaultFilters,
      setTheme: (theme) => set({ theme }),
      setSelectedActor: (actor) => set({ selectedActor: actor }),
      setAutoScroll: (enabled) => set({ autoScroll: enabled }),
      setLineBlur: (enabled) => set({ lineBlur: enabled }),
      setFontSize: (size) => set({ fontSize: size }),
      setFilter: (filter, state) => set((prev) => ({
        filters: {
          ...prev.filters,
          [filter]: { ...prev.filters[filter], ...state }
        }
      })),
      resetSettings: () => set({
        theme: 'dark',
        selectedActor: null,
        autoScroll: true,
        lineBlur: false,
        fontSize: 16,
        filters: defaultFilters,
      }),
    }),
    { name: 'skript-settings' }
  )
);
