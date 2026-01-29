import { create } from 'zustand';
import type { ScriptRow, PlaysConfig, Scene } from '@/types';

interface ScriptStore {
  playId: string;
  playsConfig: PlaysConfig | null;
  scriptData: ScriptRow[] | null;
  actors: string[];
  scenes: Scene[];
  isLoading: boolean;
  error: string | null;
  setPlayId: (id: string) => void;
  setPlaysConfig: (config: PlaysConfig) => void;
  setScriptData: (data: ScriptRow[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

function extractActors(data: ScriptRow[]): string[] {
  const actors = new Set<string>();
  data.forEach(row => {
    if (row.Kategorie === 'Schauspieler' && row.Charakter) {
      actors.add(row.Charakter.trim());
    }
  });
  return Array.from(actors).sort();
}

function extractScenes(data: ScriptRow[]): Scene[] {
  const scenes: Scene[] = [];
  let currentScene: Scene | null = null;

  data.forEach((row, index) => {
    if (row.Szene && row.Szene !== currentScene?.id) {
      if (currentScene !== null) {
        currentScene.endIndex = index - 1;
        scenes.push(currentScene);
      }
      currentScene = {
        id: row.Szene,
        name: `Szene ${row.Szene}`,
        startIndex: index,
        endIndex: index,
        lines: []
      };
    }
    if (currentScene !== null) {
      currentScene.lines.push({ ...row, _index: index });
    }
  });

  if (currentScene !== null) {
    (currentScene as Scene).endIndex = data.length - 1;
    scenes.push(currentScene);
  }

  return scenes;
}

export const useScriptStore = create<ScriptStore>((set) => ({
  playId: 'default',
  playsConfig: null,
  scriptData: null,
  actors: [],
  scenes: [],
  isLoading: false,
  error: null,
  setPlayId: (id) => set({ playId: id }),
  setPlaysConfig: (config) => set({ playsConfig: config }),
  setScriptData: (data) => set({
    scriptData: data,
    actors: extractActors(data),
    scenes: extractScenes(data)
  }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
