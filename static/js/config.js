/**
 * Configuration and constants for the application
 */

const CONFIG = {
  SOCKET_URL: window.location.origin,
  SOCKET_OPTIONS: {
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 5000,
  },
  SYNC_AVAILABLE_TIMEOUT: 2500,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  DEFAULT_PLAY_ID: 'sommerstueck2026',
  DEFAULT_SHEET_URL:
    'https://docs.google.com/spreadsheets/d/1LEhNzES1aLQ_UVA8esjXcGgkK3I5gv3q/export?format=csv&gid=532983087',
}

const STORAGE_KEYS = {
  PLAY_ID: 'playId',
  SCRIPT_DATA: 'scriptData',
  SCRIPT_LAST_FETCH: 'scriptLastFetch',
  PRESENT_ACTORS: 'presentActors',
  ACTOR_SELECT: 'actor-select',
  DARK_MODE: 'dark-mode',
  PINK_MODE: 'pink-mode',
  SHOW_ACTOR_NAMES: 'show-actor-names',
  ENABLE_NOTES: 'enable-notes',
  SCRIPT_NOTES: 'script-notes', // Per-play notes storage
}

const CATEGORIES = {
  INSTRUCTION: 'Anweisung',
  TECHNICAL: 'Technik',
  LIGHTING: 'Licht',
  AUDIO: 'Einspieler',
  PROPS: 'Requisiten',
  ACTOR: 'Schauspieler',
  SCENE_START: 'Szenenbeginn',
  ROLE: 'Rolle',
  MICROPHONE: 'Mikrofon',
}

export { CONFIG, STORAGE_KEYS, CATEGORIES }
