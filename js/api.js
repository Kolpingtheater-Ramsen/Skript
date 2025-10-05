/**
 * API and data loading utilities
 */

import { CONFIG, STORAGE_KEYS } from './config.js'

/**
 * Load plays configuration from plays.json
 * @returns {Promise<Object>} Plays configuration object
 */
export async function loadPlaysConfig() {
  try {
    const response = await fetch('plays.json')
    if (response.ok) {
      return await response.json()
    }
  } catch (error) {
    console.warn('Failed to load plays.json:', error)
  }

  // Return default configuration if load fails
  return {
    default: {
      name: 'Standardstück',
      sheet: CONFIG.DEFAULT_SHEET_URL,
    },
  }
}

/**
 * Load and parse CSV script data
 * @param {string} sheetUrl - URL of the Google Sheets CSV export
 * @param {string} playId - Play identifier for caching
 * @returns {Promise<Array>} Parsed script data
 */
export async function loadScript(sheetUrl, playId) {
  if (!window.Papa) {
    throw new Error('PapaParse library not loaded')
  }

  try {
    // Check cache first
    const cacheKeyData = `${STORAGE_KEYS.SCRIPT_DATA}:${playId}`
    const cacheKeyTime = `${STORAGE_KEYS.SCRIPT_LAST_FETCH}:${playId}`
    const cachedData = localStorage.getItem(cacheKeyData)
    const lastFetch = localStorage.getItem(cacheKeyTime)
    const cacheAge = lastFetch ? Date.now() - parseInt(lastFetch) : Infinity

    // Use cache if valid and recent
    if (cachedData && cacheAge < CONFIG.CACHE_DURATION) {
      console.log('Using cached script data')
      return JSON.parse(cachedData)
    }

    // Fetch fresh data
    const response = await fetch(sheetUrl)

    if (!response.ok) {
      // Fall back to cache if fetch fails
      if (cachedData) {
        console.log('Fetch failed, using cached data')
        return JSON.parse(cachedData)
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const csvText = await response.text()
    const parsed = Papa.parse(csvText, { header: true })
    const data = parsed.data

    // Update cache
    if (data && data.length > 0) {
      localStorage.setItem(cacheKeyData, JSON.stringify(data))
      localStorage.setItem(cacheKeyTime, Date.now().toString())
    }

    return data
  } catch (error) {
    console.error('Error loading script:', error)

    // Try to return cached data as last resort
    const cachedData = localStorage.getItem(`${STORAGE_KEYS.SCRIPT_DATA}:${playId}`)
    if (cachedData) {
      console.log('Error occurred, using cached data')
      return JSON.parse(cachedData)
    }

    return []
  }
}

/**
 * Extract actors from script data (scene 0 entries)
 * @param {Array} data - Script data array
 * @returns {Array<[string, string]>} Array of [roleName, actorName] tuples
 */
export function getActors(data) {
  const actors = data.filter(
    (row) => row.Charakter && row.Szene && row.Szene == 0
  )

  // Return unique actor entries
  return [
    ...new Map(
      actors.map((actor) => [actor.Charakter, actor['Text/Anweisung']])
    ).entries(),
  ]
}

/**
 * Normalize script data for consistent processing
 * @param {Array} data - Raw script data
 * @returns {Array} Normalized data
 */
export function normalizeScriptData(data) {
  return data.map((row) => ({
    Szene: (row.Szene || '').toString().trim(),
    Kategorie: (row.Kategorie || '').toString().trim(),
    Charakter: (row.Charakter || '').toString().trim().toUpperCase(),
    Mikrofon: (row.Mikrofon || '').toString().trim(),
    Text: (row['Text/Anweisung'] || '').toString().trim(),
    raw: row,
  }))
}

/**
 * Build a map of scene numbers to line indices
 * @param {Array} data - Script data
 * @returns {Map<string, Array<number>>} Map of scene to indices
 */
export function buildSceneIndexMap(data) {
  const map = new Map()
  data.forEach((row, index) => {
    if (!row.Szene || row.Szene == '0') return
    const scene = row.Szene
    if (!map.has(scene)) {
      map.set(scene, [])
    }
    map.get(scene).push(index)
  })
  return map
}

/**
 * Get all unique scenes from script data
 * @param {Array} data - Script data
 * @returns {Array<string>} Sorted array of scene numbers
 */
export function collectScenes(data) {
  const scenes = [
    ...new Set(data.filter((r) => r.Szene && r.Szene !== '0').map((r) => r.Szene)),
  ]
  return scenes.sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0))
}
