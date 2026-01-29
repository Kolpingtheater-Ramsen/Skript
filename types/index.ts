// Script data types
export interface ScriptRow {
  Szene: string;
  Kategorie: 'Schauspieler' | 'Anweisung' | 'Regieanweisung' | 'Einblendung' | 'Technik' | 'Licht' | 'Ton' | 'Requisite' | 'Mikrofon' | string;
  Charakter: string;
  Mikrofon: string;
  'Text/Anweisung': string;
  _index?: number;
}

export interface Play {
  name: string;
  sheet: string;
}

export interface PlaysConfig {
  [playId: string]: Play;
}

export type CategoryFilter = 'actor' | 'instruction' | 'technical' | 'lighting' | 'audio' | 'props' | 'microphone';

export interface FilterState {
  filter: CategoryFilter;
  enabled: boolean;
  contextLines: number;
}

export interface DirectorState {
  isDirector: boolean;
  directorName: string | null;
  markedLineIndex: number | null;
}

export interface ServerToClientEvents {
  marker_update: (data: { index: number; play_id: string }) => void;
  director_status: (data: { isDirector: boolean; directorName: string | null; play_id: string }) => void;
  director_changed: (data: { directorName: string; play_id: string }) => void;
  connect: () => void;
  disconnect: () => void;
}

export interface ClientToServerEvents {
  join_play: (data: { play_id: string }) => void;
  set_director: (data: { name: string; password: string; play_id: string }) => void;
  unset_director: (data: { play_id: string }) => void;
  set_marker: (data: { index: number; play_id: string }) => void;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'pink';
  selectedActor: string | null;
  autoScroll: boolean;
  lineBlur: boolean;
  fontSize: number;
  filters: Record<CategoryFilter, FilterState>;
}

export interface Scene {
  id: string;
  name: string;
  startIndex: number;
  endIndex: number;
  lines: ScriptRow[];
}

export interface Note {
  lineIndex: number;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotesState {
  [playId: string]: {
    [lineIndex: number]: Note;
  };
}
