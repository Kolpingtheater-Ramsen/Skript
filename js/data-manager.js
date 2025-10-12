/**
 * Data manager for loading and managing script data
 */

import { CONFIG, CATEGORIES } from './config.js'

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
      const res = await fetch('plays.json')
      if (res.ok) {
        this.playsConfig = await res.json()
      }
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

      const sheetUrl = this.getSheetUrl(playId)
      const response = await fetch(sheetUrl)

      if (!response.ok) {
        // If fetch fails and we have cached data, use it regardless of age
        if (cachedData) {
          console.log('Failed to fetch new data, using cached data')
          return JSON.parse(cachedData)
        }
        throw new Error('Network response was not ok')
      }

      const csvText = await response.text()
      const data = Papa.parse(csvText, { header: true }).data

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
    let normalized = data.filter((row) => row.Szene !== '0')

    // Trim and uppercase fields
    normalized.forEach((row) => {
      row.Charakter = row.Charakter?.trim().toUpperCase()
      row.Szene = row.Szene?.trim()
      row['Text/Anweisung'] = row['Text/Anweisung']?.trim()
      row.Mikrofon = row.Mikrofon?.trim()
      row.Kategorie = row.Kategorie?.trim()
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
