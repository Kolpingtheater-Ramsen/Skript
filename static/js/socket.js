/**
 * Socket.io connection handling
 */

import { CONFIG } from './config.js'

/**
 * Socket manager class
 */
export class SocketManager {
  constructor() {
    this.socket = null
    this.playId = null
    this.isOnline = false
    this.syncAvailable = false
    this.syncUnavailableEmitted = false
    this.offlineTimer = null
    this.callbacks = {
      connect: [],
      disconnect: [],
      connectError: [],
      markerUpdate: [],
      markerClear: [],
      setDirector: [],
      unsetDirector: [],
      directorTakeover: [],
      syncUnavailable: [],
    }
  }

  /**
   * Initialize socket connection
   * @param {string} playId - Play identifier for room joining
   */
  init(playId) {
    if (this.socket) {
      this.disconnect()
    }

    this.playId = playId
    this.isOnline = false
    this.syncAvailable = false
    this.syncUnavailableEmitted = false

    if (typeof window.io !== 'function') {
      this._markSyncUnavailable('Socket.IO client unavailable')
      return
    }

    this.socket = io(CONFIG.SOCKET_URL, CONFIG.SOCKET_OPTIONS)

    this._setupEventHandlers()
    this.offlineTimer = window.setTimeout(() => {
      if (!this.syncAvailable) {
        this._markSyncUnavailable('Sync server unavailable')
      }
    }, CONFIG.SYNC_AVAILABLE_TIMEOUT)
  }

  /**
   * Setup socket event handlers
   * @private
   */
  _setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to server')
      this.isOnline = true
      this.syncAvailable = true
      if (this.offlineTimer) {
        clearTimeout(this.offlineTimer)
        this.offlineTimer = null
      }
      this._trigger('connect')
      
      // Join play room
      try {
        this.socket.emit('join_play', { playId: this.playId })
      } catch (error) {
        console.error('Failed to join play room:', error)
      }
    })

    this.socket.on('connect_error', (error) => {
      console.warn('Connection error:', error)
      this.isOnline = false
      this._trigger('connectError', error)
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason)
      this.isOnline = false
      this._trigger('disconnect', reason)
    })

    this.socket.on('marker_update', (data) => {
      this._trigger('markerUpdate', data)
    })

    this.socket.on('marker_clear', (data) => {
      this._trigger('markerClear', data)
    })

    this.socket.on('set_director', (data) => {
      this._trigger('setDirector', data)
    })

    this.socket.on('unset_director', (data) => {
      this._trigger('unsetDirector', data)
    })

    this.socket.on('director_takeover', (data) => {
      this._trigger('directorTakeover', data)
    })
  }

  /**
   * Register callback for socket events
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback)
      return () => {
        const index = this.callbacks[event].indexOf(callback)
        if (index >= 0) this.callbacks[event].splice(index, 1)
      }
    } else {
      console.warn(`Unknown event: ${event}`)
    }
    return () => {}
  }

  /**
   * Trigger callbacks for an event
   * @private
   */
  _trigger(event, ...args) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach((callback) => {
        try {
          callback(...args)
        } catch (error) {
          console.error(`Error in ${event} callback:`, error)
        }
      })
    }
  }

  /**
   * Emit an event to the server
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   */
  emit(event, data) {
    if (!this.socket || !this.isOnline) {
      console.error('Socket not initialized')
      return
    }

    try {
      this.socket.emit(event, data)
    } catch (error) {
      console.error(`Failed to emit ${event}:`, error)
    }
  }

  /**
   * Set marker position (director only)
   * Accepts the canonical v2 cursor while retaining numeric indices for old
   * callers during the protocol migration.
   * @param {Object|number} cursorOrIndex - Canonical cursor or legacy line index
   */
  setMarker(cursorOrIndex) {
    const payload = Number.isInteger(cursorOrIndex)
      ? { index: cursorOrIndex }
      : cursorOrIndex
    this.emit('set_marker', payload)
  }

  /**
   * Clear marker (director only)
   */
  clearMarker() {
    this.emit('clear_marker')
  }

  /**
   * Set director
   * @param {string} name - Director name
   * @param {string} password - Director password
   */
  setDirector(name, password) {
    this.emit('set_director', { name, password })
  }

  /**
   * Unset director
   * @param {string} name - Director name
   */
  unsetDirector(name) {
    this.emit('unset_director', { name })
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    if (this.offlineTimer) {
      clearTimeout(this.offlineTimer)
      this.offlineTimer = null
    }
    this.isOnline = false
  }

  _markSyncUnavailable(reason, error = null) {
    if (this.syncAvailable || this.syncUnavailableEmitted) return
    this.syncUnavailableEmitted = true
    this.syncAvailable = false
    this.isOnline = false
    // Keep Socket.IO alive. The display may have opened before the server was
    // ready or briefly lost Wi-Fi; its configured reconnect attempts should be
    // allowed to recover synchronization without a manual page reload.
    console.warn(reason, error || '')
    this._trigger('syncUnavailable', { reason, error })
  }
}

/**
 * Create and export a singleton instance
 */
export const socketManager = new SocketManager()
