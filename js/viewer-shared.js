/**
 * Shared functionality for viewer pages
 */

import { AutoScrollManager, formatTime, getEl } from './utils.js'
import { loadPlaysConfig, loadScript, getActors, buildSceneIndexMap, collectScenes } from './api.js'
import { socketManager } from './socket.js'
import { STORAGE_KEYS } from './config.js'
import { getUrlParams } from './utils.js'

/**
 * Base viewer class with common functionality
 */
export class BaseViewer {
  constructor() {
    this.scriptData = null
    this.actors = []
    this.sceneToIndices = new Map()
    this.scenesOrder = []
    this.currentMarkerIndex = null
    this.autoScrollManager = new AutoScrollManager()
    this.playId = null
    this.sheetUrl = null
  }

  /**
   * Initialize viewer
   */
  async init() {
    // Get play ID from URL or storage
    const urlParams = getUrlParams()
    const storedPlayId = localStorage.getItem(STORAGE_KEYS.PLAY_ID) || 'default'
    this.playId = urlParams.get('play') || storedPlayId

    if (urlParams.get('play')) {
      localStorage.setItem(STORAGE_KEYS.PLAY_ID, this.playId)
    }

    // Load configuration
    const playsConfig = await loadPlaysConfig()
    this.sheetUrl =
      playsConfig?.[this.playId]?.sheet ||
      playsConfig?.default?.sheet

    // Load script data
    this.scriptData = await loadScript(this.sheetUrl, this.playId)
    this.actors = getActors(this.scriptData)
    this.scenesOrder = collectScenes(this.scriptData)
    this.sceneToIndices = buildSceneIndexMap(this.scriptData)

    // Initialize socket
    socketManager.init(this.playId)
    this.setupSocketHandlers()

    // Start clock
    this.startClock()

    // Initial render
    this.render()
  }

  /**
   * Setup socket event handlers
   */
  setupSocketHandlers() {
    socketManager.on('connect', () => {
      this.updateConnectionStatus('Verbunden')
    })

    socketManager.on('connectError', () => {
      this.updateConnectionStatus('Verbindungsfehler')
    })

    socketManager.on('disconnect', () => {
      this.updateConnectionStatus('Getrennt')
    })

    socketManager.on('setDirector', (data) => {
      this.updateDirectorStatus(data.director)
    })

    socketManager.on('markerUpdate', (data) => {
      this.currentMarkerIndex = data.index
      this.onMarkerUpdate(data)
      this.updateProgress()
    })

    socketManager.on('markerClear', () => {
      this.currentMarkerIndex = null
      this.onMarkerClear()
      this.updateProgress()
    })
  }

  /**
   * Start clock updater
   */
  startClock() {
    const clockEl = getEl('clock')
    if (!clockEl) return

    const updateClock = () => {
      clockEl.textContent = formatTime()
    }

    updateClock()
    setInterval(updateClock, 1000)
  }

  /**
   * Update connection status display
   * @param {string} status - Status text
   */
  updateConnectionStatus(status) {
    const el = getEl('connection-status')
    if (el) {
      el.textContent = `Status: ${status}`
    }
  }

  /**
   * Update director status display
   * @param {string} director - Director name
   */
  updateDirectorStatus(director) {
    const el = getEl('director-status')
    if (el) {
      el.textContent = `Director: ${director || 'Niemand'}`
    }
  }

  /**
   * Compute scene progress
   * @returns {Object} Progress data {percent, current, total}
   */
  computeSceneProgressCounts() {
    if (this.currentMarkerIndex === null) {
      return { percent: 0, current: 0, total: 0 }
    }

    let remainingIndex = this.currentMarkerIndex

    for (const [, indices] of this.sceneToIndices) {
      const count = indices.length
      if (count > remainingIndex) {
        const current = Math.max(0, Math.min(remainingIndex, count))
        const percent = count > 0 ? Math.floor((current / count) * 100) : 0
        return { percent, current, total: count }
      }
      remainingIndex -= count
    }

    return { percent: 100, current: 0, total: 0 }
  }

  /**
   * Update progress bar
   */
  updateProgress() {
    const { percent, current, total } = this.computeSceneProgressCounts()
    const bar = getEl('global-progress-bar')
    const text = getEl('global-progress-text')

    if (bar) bar.style.width = `${percent}%`
    if (text) text.textContent = `${percent}% (${current}/${total})`
  }

  /**
   * Get current scene from marker index
   * @returns {string|null} Current scene number
   */
  getSceneFromMarker() {
    if (this.currentMarkerIndex === null) return null

    let remainingIndex = this.currentMarkerIndex

    for (const [scene, indices] of this.sceneToIndices) {
      const count = indices.length
      if (count > remainingIndex) {
        return scene
      }
      remainingIndex -= count
    }

    return null
  }

  /**
   * Get next scene
   * @param {string} currentScene - Current scene number
   * @returns {string|null} Next scene number
   */
  getNextScene(currentScene) {
    const index = this.scenesOrder.indexOf(currentScene)
    if (index === -1 || index === this.scenesOrder.length - 1) {
      return null
    }
    return this.scenesOrder[index + 1]
  }

  /**
   * Get actors in a specific scene
   * @param {string} scene - Scene number
   * @returns {Map<string, string>} Map of actor to microphone number
   */
  getSceneActors(scene) {
    const actors = new Map()

    this.scriptData.forEach((row) => {
      if (row.Szene === scene && row.Charakter) {
        actors.set(row.Charakter, row.Mikrofon || '')
      }
    })

    return actors
  }

  /**
   * Get scene summary text
   * @param {string} scene - Scene number
   * @returns {string} Scene summary
   */
  getSceneSummary(scene) {
    const row = this.scriptData.find(
      (r) => r.Szene === scene && r.Kategorie === 'Szenenbeginn'
    )
    return row ? row['Text/Anweisung'] : ''
  }

  // Override these in subclasses
  render() {
    throw new Error('render() must be implemented by subclass')
  }

  onMarkerUpdate(data) {
    // Optional override
  }

  onMarkerClear() {
    // Optional override
  }
}
