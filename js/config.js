/**
 * Configuration and constants for the application
 */

const CONFIG = {
  SOCKET_URL: 'https://skript.logge.top',
  SOCKET_OPTIONS: {
    transports: ['websocket'],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 20000,
  },
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  DEFAULT_PLAY_ID: 'default',
  DEFAULT_SHEET_URL:
    'https://docs.google.com/spreadsheets/d/1LEhNzES1aLQ_UVA8esjXcGgkK3I5gv3q/export?format=csv&gid=967194980',
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
}

export { CONFIG, STORAGE_KEYS, CATEGORIES }
