/**
 * Shared loading, canonical cursor, status, and scene helpers for viewer pages.
 */

import { AutoScrollManager, formatTime, getEl, getUrlParams } from './utils.js'
import { loadScriptModel } from './script-loader.js'
import { socketManager } from './socket.js'
import { CONFIG, STORAGE_KEYS } from './config.js'
import {
  advanceCursorSequence,
  deriveLocalScriptRevision,
  getCueOrdinal,
  resolveCueCursor,
} from './cue-window.js'

export class BaseViewer {
  constructor() {
    this.scriptData = []
    this.rawScriptData = []
    this.actors = []
    this.sceneToIndices = new Map()
    this.scenesOrder = []
    this.currentMarkerIndex = null
    this.currentMarkerCursor = null
    this.lastMarkerSequence = null
    this.scriptRevision = null
    this.autoScrollManager = new AutoScrollManager()
    this.playId = null
    this.displayId = 'default'
    this.loadError = null
    this.connectionState = 'connecting'
  }

  async init() {
    const urlParams = getUrlParams()
    let storedPlayId = CONFIG.DEFAULT_PLAY_ID || 'default'
    try {
      storedPlayId = localStorage.getItem(STORAGE_KEYS.PLAY_ID) || storedPlayId
    } catch (error) {
      console.warn('Lokale Stückauswahl ist nicht verfügbar:', error)
    }
    this.playId = urlParams.get('play') || storedPlayId
    this.displayId = urlParams.get('display')?.trim() || 'default'

    if (urlParams.get('play')) {
      try {
        localStorage.setItem(STORAGE_KEYS.PLAY_ID, this.playId)
      } catch (error) {
        console.warn('Stückauswahl konnte nicht lokal gespeichert werden:', error)
      }
    }

    try {
      const model = await loadScriptModel(this.playId)
      this.scriptData = Array.isArray(model?.data) ? model.data : []
      this.rawScriptData = Array.isArray(model?.rawData) ? model.rawData : []
      this.actors = Array.isArray(model?.actors) ? model.actors : []
      this.scriptRevision =
        model?.scriptRevision || deriveLocalScriptRevision(this.scriptData)
      this.scenesOrder = this.collectScenes(this.scriptData)
      this.sceneToIndices = this.buildSceneIndexMap(this.scriptData)
    } catch (error) {
      console.error('Viewer-Skript konnte nicht geladen werden:', error)
      this.loadError = error
      this.scriptRevision = deriveLocalScriptRevision([])
    }

    this.setupSocketHandlers()
    socketManager.init(this.playId)
    this.startClock()
    this.render()

    if (this.loadError) this.onLoadError(this.loadError)
  }

  collectScenes(data) {
    const scenes = []
    const seen = new Set()
    for (const row of data || []) {
      const scene = String(row?.Szene ?? '').trim()
      if (!scene || scene === '0' || seen.has(scene)) continue
      seen.add(scene)
      scenes.push(scene)
    }
    return scenes
  }

  buildSceneIndexMap(data) {
    const map = new Map()
    ;(data || []).forEach((row, index) => {
      const scene = String(row?.Szene ?? '').trim()
      if (!scene || scene === '0') return
      if (!map.has(scene)) map.set(scene, [])
      map.get(scene).push(index)
    })
    return map
  }

  setupSocketHandlers() {
    socketManager.on('connect', () => {
      this.connectionState = 'online'
      this.updateConnectionStatus('✅ Verbunden')
      this.onConnectionStateChange('online')
    })

    socketManager.on('connectError', () => {
      this.connectionState = 'offline'
      this.updateConnectionStatus('⚠️ Offline')
      this.onConnectionStateChange('offline')
    })

    socketManager.on('disconnect', () => {
      this.connectionState = 'offline'
      this.updateConnectionStatus('⚠️ Getrennt')
      this.onConnectionStateChange('offline')
    })

    socketManager.on('syncUnavailable', () => {
      this.connectionState = 'offline'
      this.updateConnectionStatus('⚠️ Lokaler Betrieb')
      this.onConnectionStateChange('offline')
    })

    socketManager.on('setDirector', (data) => {
      this.updateDirectorStatus(data.director)
    })

    socketManager.on('unsetDirector', () => {
      this.updateDirectorStatus('Niemand')
    })

    socketManager.on('markerUpdate', (data) => {
      this.handleMarkerPayload(data)
    })

    socketManager.on('markerClear', (data = {}) => {
      const ordering = advanceCursorSequence(this.lastMarkerSequence, data)
      if (!ordering.accept) return
      this.lastMarkerSequence = ordering.lastSequence
      this.currentMarkerIndex = null
      this.currentMarkerCursor = null
      this.onMarkerClear()
      this.updateProgress()
    })
  }

  handleMarkerPayload(data) {
    const ordering = advanceCursorSequence(this.lastMarkerSequence, data)
    if (!ordering.accept) return
    this.lastMarkerSequence = ordering.lastSequence

    const resolution = resolveCueCursor(
      this.scriptData,
      data,
      this.scriptRevision
    )

    if (resolution.status === 'mismatch') {
      this.onCursorMismatch(resolution, data)
      return
    }
    if (resolution.status !== 'ok') {
      this.onCursorInvalid(resolution, data)
      return
    }

    this.currentMarkerCursor = resolution.cursor
    this.currentMarkerIndex = resolution.cursor.rowIndex
    const normalizedPayload = {
      ...data,
      cueId: resolution.cursor.cueId,
      ordinal: resolution.cursor.ordinal,
      index: resolution.cursor.rowIndex,
    }
    this.onMarkerUpdate(normalizedPayload, resolution)
    this.updateProgress()
  }

  startClock() {
    const clockEl = getEl('clock')
    if (!clockEl) return
    const updateClock = () => {
      clockEl.textContent = formatTime()
    }
    updateClock()
    this.clockTimer = setInterval(updateClock, 1000)
  }

  updateConnectionStatus(status) {
    const element = getEl('connection-status')
    if (element) element.textContent = status
  }

  updateDirectorStatus(director) {
    const element = getEl('director-status')
    if (!element) return
    if (director && director !== 'Niemand') {
      element.textContent = `🎬 Director: ${director}`
      element.classList.add('active')
    } else {
      element.textContent = '👤 Director: Niemand'
      element.classList.remove('active')
    }
  }

  computeSceneProgressCounts() {
    if (!Number.isInteger(this.currentMarkerIndex) || this.currentMarkerIndex < 0) {
      return { percent: 0, current: 0, total: 0 }
    }

    const row = this.scriptData[this.currentMarkerIndex]
    const scene = String(row?.Szene ?? '').trim()
    const indices = this.sceneToIndices.get(scene) || []
    if (indices.length === 0) return { percent: 0, current: 0, total: 0 }

    const exactPosition = indices.indexOf(this.currentMarkerIndex)
    const current = exactPosition >= 0
      ? exactPosition + 1
      : indices.filter((index) => index <= this.currentMarkerIndex).length
    return {
      percent: Math.min(100, Math.floor((current / indices.length) * 100)),
      current,
      total: indices.length,
    }
  }

  updateProgress() {
    const { percent, current, total } = this.computeSceneProgressCounts()
    const bar = getEl('global-progress-bar')
    const text = getEl('global-progress-text')
    if (bar) bar.style.width = `${percent}%`
    if (text) text.textContent = `${percent}% (${current}/${total})`
  }

  getSceneFromMarker() {
    if (!Number.isInteger(this.currentMarkerIndex) || this.currentMarkerIndex < 0) {
      return null
    }
    return String(this.scriptData[this.currentMarkerIndex]?.Szene ?? '').trim() || null
  }

  getNextScene(currentScene) {
    const index = this.scenesOrder.indexOf(currentScene)
    if (index < 0 || index >= this.scenesOrder.length - 1) return null
    return this.scenesOrder[index + 1]
  }

  getSceneActors(scene) {
    const actors = new Map()
    this.scriptData.forEach((row) => {
      if (String(row.Szene) === String(scene) && row.Charakter) {
        actors.set(row.Charakter, row.Mikrofon || '')
      }
    })
    return actors
  }

  getSceneSummary(scene) {
    const row = this.scriptData.find(
      (candidate) =>
        String(candidate.Szene) === String(scene) &&
        candidate.Kategorie === 'Szenenbeginn'
    )
    return row ? row['Text/Anweisung'] || row.Text || '' : ''
  }

  getMarkerOrdinal() {
    if (this.currentMarkerCursor) return this.currentMarkerCursor.ordinal
    if (!Number.isInteger(this.currentMarkerIndex) || this.currentMarkerIndex < 0) {
      return null
    }
    return getCueOrdinal(
      this.scriptData[this.currentMarkerIndex],
      this.currentMarkerIndex
    )
  }

  render() {
    throw new Error('render() must be implemented by subclass')
  }

  onMarkerUpdate() {}
  onMarkerClear() {}
  onConnectionStateChange() {}
  onCursorMismatch() {}
  onCursorInvalid() {}
  onLoadError() {}
}
