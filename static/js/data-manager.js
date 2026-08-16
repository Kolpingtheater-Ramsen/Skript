/**
 * Data manager for loading and managing script data
 */

import { CONFIG, CATEGORIES } from './config.js'
import { generateSceneMicCues } from './mic-cue-generator.js'
import { assetUrl, fetchFirst } from './runtime.js'

const CUE_METADATA_FIELDS = new Set(['cueId', 'cueOrdinal'])

/**
 * Return a compact deterministic hash for stable client-side identities.
 * Two independently seeded 32-bit hashes keep accidental collisions unlikely
 * without requiring the asynchronous Web Crypto interface.
 *
 * @param {string} value - Value to hash
 * @returns {string} 16-character hexadecimal hash
 */
export function stableScriptHash(value) {
  const input = String(value)
  let first = 0x811c9dc5
  let second = 0x9e3779b9

  for (let index = 0; index < input.length; index++) {
    const code = input.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85ebca6b)
  }

  const firstHex = (first >>> 0).toString(16).padStart(8, '0')
  const secondHex = (second >>> 0).toString(16).padStart(8, '0')
  return `${firstHex}${secondHex}`
}

/**
 * Serialize all sheet-controlled fields in a deterministic order. Cue metadata
 * is intentionally excluded so identities and revisions never depend on
 * themselves.
 *
 * @param {Object} row - Script row
 * @returns {string} Canonical row representation
 */
function canonicalRowValue(row) {
  return JSON.stringify(
    Object.keys(row)
      .filter((key) => !CUE_METADATA_FIELDS.has(key))
      .sort()
      .map((key) => [key, row[key] === null || row[key] === undefined ? '' : row[key]])
  )
}

/**
 * Attach deterministic IDs to source rows before derived cues are inserted.
 * Identical source rows are disambiguated by their occurrence number.
 *
 * @param {Array<Object>} rows - Normalized source rows
 */
function assignSourceCueIds(rows) {
  const occurrences = new Map()

  rows.forEach((row) => {
    const fingerprint = stableScriptHash(canonicalRowValue(row))
    const occurrence = occurrences.get(fingerprint) || 0
    occurrences.set(fingerprint, occurrence + 1)
    row.cueId = `cue-s-${fingerprint}-${occurrence}`
  })
}

/**
 * Attach deterministic IDs to automatically generated microphone rows. Their
 * identity includes the adjacent source cues, so equal mic cues in different
 * parts of a scene do not collapse onto the same ID.
 *
 * @param {Array<Object>} rows - Source and generated rows
 */
function assignDerivedCueIds(rows) {
  const nextSourceIds = new Array(rows.length)
  let nextSourceId = 'end'

  for (let index = rows.length - 1; index >= 0; index--) {
    nextSourceIds[index] = nextSourceId
    if (rows[index].cueId) nextSourceId = rows[index].cueId
  }

  const occurrences = new Map()
  let previousSourceId = 'start'

  rows.forEach((row, index) => {
    if (row.cueId) {
      previousSourceId = row.cueId
      return
    }

    const identityValue = JSON.stringify([
      previousSourceId,
      nextSourceIds[index],
      canonicalRowValue(row),
    ])
    const fingerprint = stableScriptHash(identityValue)
    const occurrence = occurrences.get(fingerprint) || 0
    occurrences.set(fingerprint, occurrence + 1)
    row.cueId = `cue-a-${fingerprint}-${occurrence}`
  })
}

/**
 * Calculate the revision of a complete canonical script model.
 *
 * @param {Array<Object>} data - Canonical rows in playback order
 * @returns {string} Deterministic script revision
 */
export function computeScriptRevision(data) {
  const revisionValue = (data || [])
    .map((row) => canonicalRowValue(row))
    .join('\n')
  return `script-v1-${stableScriptHash(revisionValue)}`
}

/**
 * Data Manager class
 */
export class DataManager {
  constructor() {
    this.playsConfig = null
    this.sheetUrl = null
  }

  /**
   * Load plays configuration from plays.json
   * @returns {Promise<Object>} Plays configuration object
   */
  async loadPlaysConfig() {
    try {
      const res = await fetchFirst([
        assetUrl('static/data/plays.json'),
        '/static/data/plays.json',
        'plays.json',
      ])
      this.playsConfig = await res.json()
    } catch (e) {
      console.warn('Failed to load plays.json:', e)
    }

    // Fallback to default config if not found
    if (!this.playsConfig) {
      this.playsConfig = {
        default: {
          name: 'Standardstück',
          sheet: CONFIG.DEFAULT_SHEET_URL,
        },
      }
    }

    return this.playsConfig
  }

  /**
   * Get sheet URL for a specific play
   * @param {string} playId - Play identifier
   * @returns {string} Sheet URL
   */
  getSheetUrl(playId) {
    if (!this.playsConfig) {
      return CONFIG.DEFAULT_SHEET_URL
    }

    return (
      (this.playsConfig[playId] && this.playsConfig[playId].sheet) ||
      (this.playsConfig.default && this.playsConfig.default.sheet) ||
      CONFIG.DEFAULT_SHEET_URL
    )
  }

  /**
   * Convert a Google Sheets edit/share URL into a CSV export URL.
   * Stored config may use human-friendly /edit?gid=... links.
   * @param {string} sheetUrl - Configured sheet URL
   * @returns {string} Fetchable CSV URL
   */
  toCsvExportUrl(sheetUrl) {
    try {
      const url = new URL(sheetUrl)
      const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/)
      if (!match) return sheetUrl
      if (url.pathname.includes('/export') && url.searchParams.get('format') === 'csv') return sheetUrl
      const gid = url.searchParams.get('gid') || url.hash.match(/gid=([^&]+)/)?.[1] || '0'
      return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`
    } catch (error) {
      return sheetUrl
    }
  }

  /**
   * Load script data from Google Sheets CSV
   * @param {string} playId - Play identifier
   * @returns {Promise<Array>} Script data array
   */
  async loadScript(playId) {
    try {
      // Check cache first (per play)
      const cacheKeyData = `scriptData:${playId}`
      const cacheKeyTime = `scriptLastFetch:${playId}`
      const cachedData = localStorage.getItem(cacheKeyData)
      const lastFetch = localStorage.getItem(cacheKeyTime)
      const cacheAge = lastFetch ? Date.now() - parseInt(lastFetch) : Infinity

      // Use cache if it exists and is less than 5 minutes old
      if (cachedData && cacheAge < CONFIG.CACHE_DURATION) {
        console.log('Using cached script data')
        return JSON.parse(cachedData)
      }

      const sheetUrl = this.toCsvExportUrl(this.getSheetUrl(playId))
      const response = await fetch(sheetUrl, { cache: 'no-cache' })

      if (!response.ok) {
        // If fetch fails and we have cached data, use it regardless of age
        if (cachedData) {
          console.log('Failed to fetch new data, using cached data')
          return JSON.parse(cachedData)
        }
        throw new Error('Network response was not ok')
      }

      const csvText = await response.text()
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })
      if (parsed.errors && parsed.errors.length > 0) {
        console.warn('CSV parse warnings:', parsed.errors)
      }
      const data = parsed.data

      // Only update cache if we got valid data
      if (data && data.length > 0) {
        localStorage.setItem(cacheKeyData, JSON.stringify(data))
        localStorage.setItem(cacheKeyTime, Date.now().toString())
      }

      return data
    } catch (error) {
      console.error('Error loading script:', error)
      // Try to return cached data if available
      const cachedData = localStorage.getItem(`scriptData:${playId}`)
      if (cachedData) {
        console.log('Error fetching new data, using cached data')
        return JSON.parse(cachedData)
      }
      return []
    }
  }

  /**
   * Extract actors from script data
   * @param {Array} data - Script data array
   * @returns {Array<Array<string>>} Array of [roleName, actorName] pairs
   */
  getActors(data) {
    const actors = data.filter(
      (row) =>
        row.Charakter &&
        row.Kategorie === CATEGORIES.ROLE &&
        row['Text/Anweisung']
    )
    return actors.map((actor) => [actor.Charakter, actor['Text/Anweisung']])
  }

  /**
   * Normalize script data (trim and uppercase)
   * @param {Array} data - Script data array
   * @returns {Array} Normalized data
   */
  normalizeData(data) {
    // Remove scene 0
    let normalized = (Array.isArray(data) ? data : [])
      .filter((row) => row.Szene !== '0')
      .map((row) => ({ ...row }))

    // Trim and uppercase fields
    normalized.forEach((row) => {
      row.Charakter = row.Charakter?.trim().toUpperCase()
      row.Szene = row.Szene?.trim()
      row['Text/Anweisung'] = row['Text/Anweisung']?.trim()
      row.Mikrofon = row.Mikrofon?.trim()
      row.Kategorie = row.Kategorie?.trim()
    })

    // Source IDs must exist before derived rows are inserted, because the
    // neighbouring source cues form the anchors for automatic microphone cues.
    assignSourceCueIds(normalized)

    // Inject automatic mic cues
    normalized = generateSceneMicCues(normalized)

    assignDerivedCueIds(normalized)
    normalized.forEach((row, cueOrdinal) => {
      row.cueOrdinal = cueOrdinal
    })

    return normalized
  }

  /**
   * Get plays configuration
   * @returns {Object} Plays configuration
   */
  getPlaysConfig() {
    return this.playsConfig
  }
}

/**
 * Create and export singleton instance
 */
export const dataManager = new DataManager()
