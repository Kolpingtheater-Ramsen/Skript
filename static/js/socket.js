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
    this.callbacks = {
      connect: [],
      disconnect: [],
      connectError: [],
      markerUpdate: [],
      markerClear: [],
      setDirector: [],
      unsetDirector: [],
      directorTakeover: [],
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
    this.socket = io(CONFIG.SOCKET_URL, CONFIG.SOCKET_OPTIONS)

    this._setupEventHandlers()
  }

  /**
   * Setup socket event handlers
   * @private
   */
  _setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to server')
      this._trigger('connect')
      
      // Join play room
      try {
        this.socket.emit('join_play', { playId: this.playId })
      } catch (error) {
        console.error('Failed to join play room:', error)
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      this._trigger('connectError', error)
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason)
      this._trigger('disconnect', reason)
    })

    this.socket.on('marker_update', (data) => {
      this._trigger('markerUpdate', data)
    })

    this.socket.on('marker_clear', () => {
      this._trigger('markerClear')
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
    } else {
      console.warn(`Unknown event: ${event}`)
    }
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
    if (!this.socket) {
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
   * @param {number} index - Line index
   */
  setMarker(index) {
    this.emit('set_marker', { index })
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
  }
}

/**
 * Create and export a singleton instance
 */
export const socketManager = new SocketManager()
