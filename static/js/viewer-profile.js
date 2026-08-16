import { CUE_FILTERS } from './cue-window.js'

export const VIEWER_PROFILE_VERSION = 1

const allFilters = Object.freeze([...CUE_FILTERS])

export const VIEWER_PRESETS = Object.freeze({
  schauspiel: Object.freeze({
    id: 'schauspiel',
    label: 'Schauspiel',
    description: 'Schauspielertext und allgemeine Bühnenanweisungen',
    layout: 'script',
    filters: Object.freeze(['schauspieler', 'anweisung']),
    showSceneSummary: true,
  }),
  buehne: Object.freeze({
    id: 'buehne',
    label: 'Bühne',
    description: 'Technik und Requisiten für die Bühnenschieber',
    layout: 'timeline',
    filters: Object.freeze(['technik', 'requisiten']),
    showSceneSummary: true,
  }),
  klassisch: Object.freeze({
    id: 'klassisch',
    label: 'Bühnenmonitor klassisch',
    description: 'Vollständiges Skript mit allen Inhalten wie bisher',
    layout: 'script',
    filters: allFilters,
    showSceneSummary: true,
  }),
  licht: Object.freeze({
    id: 'licht',
    label: 'Licht',
    description: 'Nur Licht-Cues mit Vorschau',
    layout: 'timeline',
    filters: Object.freeze(['licht']),
    showSceneSummary: true,
  }),
  ton: Object.freeze({
    id: 'ton',
    label: 'Ton',
    description: 'Einspieler und Mikrofon-Cues',
    layout: 'timeline',
    filters: Object.freeze([
      'einspieler',
      'mikrofon-manuell',
      'mikrofon-auto',
    ]),
    showSceneSummary: true,
  }),
  gesamttechnik: Object.freeze({
    id: 'gesamttechnik',
    label: 'Gesamttechnik',
    description: 'Technik, Licht, Ton und Requisiten',
    layout: 'timeline',
    filters: Object.freeze([
      'technik',
      'licht',
      'einspieler',
      'requisiten',
      'mikrofon-manuell',
      'mikrofon-auto',
    ]),
    showSceneSummary: true,
  }),
})

export const VIEWER_PRESET_ORDER = Object.freeze([
  'schauspiel',
  'buehne',
  'klassisch',
  'licht',
  'ton',
  'gesamttechnik',
  'custom',
])

export function profileFromPreset(presetId, currentProfile = null) {
  if (presetId === 'custom') {
    return normalizeViewerProfile({
      ...(currentProfile || VIEWER_PRESETS.gesamttechnik),
      presetId: 'custom',
    })
  }

  const preset = VIEWER_PRESETS[presetId]
  if (!preset) return null
  return {
    version: VIEWER_PROFILE_VERSION,
    presetId: preset.id,
    layout: preset.layout,
    filters: [...preset.filters],
    showSceneSummary: preset.showSceneSummary,
  }
}

export function normalizeViewerProfile(value) {
  if (!value || typeof value !== 'object') return null
  const knownFilters = new Set(CUE_FILTERS)
  const layout = value.layout === 'script' ? 'script' : 'timeline'
  const requestedFilters = [
    ...new Set((value.filters || []).filter((item) => knownFilters.has(item))),
  ]
  const filters = layout === 'timeline' && requestedFilters.length === 0
    ? ['technik']
    : requestedFilters
  const presetId = (VIEWER_PRESETS[value.presetId] || value.presetId === 'custom')
    ? value.presetId
    : 'custom'

  return {
    version: VIEWER_PROFILE_VERSION,
    presetId,
    layout,
    filters,
    showSceneSummary: value.showSceneSummary !== false,
  }
}

export class ViewerProfileStore {
  constructor(storage) {
    if (storage !== undefined) {
      this.storage = storage
      return
    }
    try {
      this.storage = globalThis.localStorage
    } catch (error) {
      console.warn('Lokale Viewer-Profile sind in diesem Browser nicht verfügbar:', error)
      this.storage = null
    }
  }

  key(playId, displayId) {
    return `viewerProfile:v${VIEWER_PROFILE_VERSION}:${playId}:${displayId}`
  }

  load(playId, displayId) {
    try {
      const stored = this.storage?.getItem(this.key(playId, displayId))
      return stored ? normalizeViewerProfile(JSON.parse(stored)) : null
    } catch (error) {
      console.warn('Viewer-Profil konnte nicht geladen werden:', error)
      return null
    }
  }

  save(playId, displayId, profile) {
    const normalized = normalizeViewerProfile(profile)
    if (!normalized || !this.storage) return false
    try {
      this.storage?.setItem(this.key(playId, displayId), JSON.stringify(normalized))
      return true
    } catch (error) {
      console.warn('Viewer-Profil konnte nicht gespeichert werden:', error)
      return false
    }
  }
}
