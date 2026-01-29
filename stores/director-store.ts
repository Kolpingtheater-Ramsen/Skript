import { create } from 'zustand';
import type { DirectorState } from '@/types';

interface DirectorStore extends DirectorState {
  setIsDirector: (isDirector: boolean) => void;
  setDirectorName: (name: string | null) => void;
  setMarkedLineIndex: (index: number | null) => void;
  reset: () => void;
}

export const useDirectorStore = create<DirectorStore>((set) => ({
  isDirector: false,
  directorName: null,
  markedLineIndex: null,
  setIsDirector: (isDirector) => set({ isDirector }),
  setDirectorName: (name) => set({ directorName: name }),
  setMarkedLineIndex: (index) => set({ markedLineIndex: index }),
  reset: () => set({ isDirector: false, directorName: null, markedLineIndex: null }),
}));
