/**
 * Application state management
 */

import { STORAGE_KEYS } from './config.js'
import { EventEmitter } from './utils.js'

/**
 * State manager class
 */
export class StateManager extends EventEmitter {
  constructor() {
    super()
    this.state = {
      playId: null,
      scriptData: null,
      actors: [],
      markedLine: null,
      markedLineIndex: null,
      isDirector: false,
      directorName: '',
      isConnected: false,
      currentScene: null,
      reconnectAttempts: 0,
    }
  }

  /**
   * Get state value
   * @param {string} key - State key
   * @returns {*} State value
   */
  get(key) {
    return this.state[key]
  }

  /**
   * Set state value
   * @param {string} key - State key
   * @param {*} value - State value
   * @param {boolean} silent - Don't emit change event
   */
  set(key, value, silent = false) {
    const oldValue = this.state[key]
    this.state[key] = value

    if (!silent && oldValue !== value) {
      this.emit('change', key, value, oldValue)
      this.emit(`change:${key}`, value, oldValue)
    }
  }

  /**
   * Update multiple state values
   * @param {Object} updates - Object with state updates
   */
  update(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key, value, true)
    })
    this.emit('change', updates)
  }

  /**
   * Load state from localStorage
   * @param {Array<string>} keys - Keys to load
   */
  loadFromStorage(keys) {
    keys.forEach((key) => {
      const value = localStorage.getItem(key)
      if (value !== null) {
        try {
          // Try to parse as JSON, fallback to string
          this.set(key, JSON.parse(value), true)
        } catch {
          this.set(key, value, true)
        }
      }
    })
  }

  /**
   * Save state to localStorage
   * @param {Array<string>} keys - Keys to save
   */
  saveToStorage(keys) {
    keys.forEach((key) => {
      const value = this.get(key)
      if (value !== null && value !== undefined) {
        localStorage.setItem(
          key,
          typeof value === 'string' ? value : JSON.stringify(value)
        )
      }
    })
  }

  /**
   * Clear marked line
   */
  clearMarkedLine() {
    if (this.state.markedLine) {
      this.state.markedLine.classList.remove('marked-line')
    }
    this.set('markedLine', null)
    this.set('markedLineIndex', null)
  }

  /**
   * Set marked line
   * @param {HTMLElement} element - Element to mark
   * @param {number} index - Line index
   */
  setMarkedLine(element, index) {
    this.clearMarkedLine()

    if (element) {
      element.classList.add('marked-line')
      this.set('markedLine', element)
      this.set('markedLineIndex', index)
    }
  }
}

/**
 * Create and export singleton instance
 */
export const stateManager = new StateManager()
