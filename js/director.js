/**
 * Director mode functionality
 */

import { smoothScrollToElement } from './utils.js'

/**
 * Director Manager class
 */
export class DirectorManager {
  constructor(stateManager, socketManager) {
    this.state = stateManager
    this.socket = socketManager
    this.reconnectAttempts = 0
  }

  /**
   * Initialize director mode and socket handlers
   */
  init() {
    this._setupSocketHandlers()
  }

  /**
   * Setup socket event handlers
   * @private
   */
  _setupSocketHandlers() {
    this.socket.on('connect', () => {
      this.state.set('isConnected', true)
      this.reconnectAttempts = 0
      this._updateDirectorStatus()
    })

    this.socket.on('connectError', (error) => {
      this.state.set('isConnected', false)
      this.reconnectAttempts++
      const statusEl = document.getElementById('director-status')
      if (statusEl) {
        statusEl.textContent = `Director Mode: Offline (Verbindungsfehler - Versuch ${this.reconnectAttempts})`
      }
    })

    this.socket.on('disconnect', (reason) => {
      this.state.set('isConnected', false)
      const statusEl = document.getElementById('director-status')
      if (statusEl) {
        statusEl.textContent = 'Director Mode: Offline'
      }

      // If we were the director, clear the state
      if (this.state.get('isDirector')) {
        this.state.set('isDirector', false)
        this.state.set('directorName', '')
        const nameInput = document.getElementById('name')
        const passInput = document.getElementById('password')
        if (nameInput) nameInput.value = ''
        if (passInput) passInput.value = ''
        this.updateDirectorUI(false)
      }

      // Clear any markers
      this.clearMarkedLine()
    })

    this.socket.on('markerUpdate', (data) => {
      this._handleMarkerUpdate(data)
    })

    this.socket.on('markerClear', () => {
      this.clearMarkedLine()
    })

    this.socket.on('setDirector', (data) => {
      this._handleSetDirector(data)
    })

    this.socket.on('unsetDirector', (data) => {
      this._handleUnsetDirector(data)
    })

    this.socket.on('directorTakeover', (data) => {
      this._handleDirectorTakeover(data)
    })
  }

  /**
   * Handle marker update from server
   * @private
   */
  _handleMarkerUpdate(data) {
    // Clear any existing marker
    this.clearMarkedLine()

    // Find and mark the line
    const allLines = document.querySelectorAll('.script-line')
    if (allLines[data.index]) {
      this.markLine(allLines[data.index], data.index, false)
      // Autoscroll if enabled (for non-directors) or if director has autoscroll enabled
      const shouldAutoscroll = document.getElementById('autoscroll')?.checked
      if (shouldAutoscroll) {
        smoothScrollToElement(allLines[data.index], 25)
      }
    }
  }

  /**
   * Handle set director response from server
   * @private
   */
  _handleSetDirector(data) {
    const directorStatus = document.getElementById('director-status')
    if (data.success) {
      if (directorStatus) {
        directorStatus.textContent = data.director
      }
      if (data.director !== 'Niemand') {
        document.body.classList.add('director-active')
        this.state.set('isDirector', data.isDirector)
        if (data.isDirector) {
          document.body.classList.add('is-director')
        } else {
          document.body.classList.remove('is-director')
        }
      } else {
        document.body.classList.remove('director-active', 'is-director')
        this.state.set('isDirector', false)
      }
    } else {
      if (directorStatus) {
        directorStatus.textContent = 'Niemand'
      }
      document.body.classList.remove('director-active', 'is-director')
      this.state.set('isDirector', false)
      if (data.message) {
        alert(data.message)
      }
    }
  }

  /**
   * Handle unset director from server
   * @private
   */
  _handleUnsetDirector(data) {
    this.handleDirectorChange(null, false)
    this.clearMarkedLine()

    // Clear inputs if we were the director
    const directorName = this.state.get('directorName')
    if (data.previousDirector === directorName) {
      const nameInput = document.getElementById('name')
      const passInput = document.getElementById('password')
      if (nameInput) nameInput.value = ''
      if (passInput) passInput.value = ''
    }
  }

  /**
   * Handle director takeover from server
   * @private
   */
  _handleDirectorTakeover(data) {
    const directorName = this.state.get('directorName')
    const wasDirector =
      data.isDirector === false && directorName === data.previousDirector

    // Update state for the new director
    this.handleDirectorChange(data.newDirector, data.isDirector)

    // If we were the previous director, clear our inputs
    if (wasDirector) {
      const nameInput = document.getElementById('name')
      const passInput = document.getElementById('password')
      if (nameInput) nameInput.value = ''
      if (passInput) passInput.value = ''
      alert('Ein neuer Director hat übernommen.')
    }
  }

  /**
   * Update director status display
   * @private
   */
  _updateDirectorStatus() {
    const statusEl = document.getElementById('director-status')
    const directorName = this.state.get('directorName')
    if (statusEl) {
      statusEl.textContent = directorName
        ? `Aktueller Director: ${directorName}`
        : 'Aktueller Director: Niemand'
    }
  }

  /**
   * Mark a line
   * @param {HTMLElement} element - Element to mark
   * @param {number} index - Line index
   * @param {boolean} broadcast - Whether to broadcast to other clients
   */
  markLine(element, index, broadcast = true) {
    // Clear previous mark
    this.clearMarkedLine()

    // Set new mark
    element.classList.add('marked-line')
    this.state.set('markedLine', element)
    this.state.set('markedLineIndex', index)

    // If we're the director, broadcast the marker
    if (broadcast && this.state.get('isDirector')) {
      this.socket.setMarker(index)
    }

    const shouldAutoscroll = document.getElementById('autoscroll')?.checked
    if (shouldAutoscroll) {
      smoothScrollToElement(element, 25)
    }

    // Show/hide FAB based on scroll position
    this.updateFabVisibility()
  }

  /**
   * Clear marked line
   */
  clearMarkedLine() {
    const markedLine = this.state.get('markedLine')
    if (markedLine) {
      markedLine.classList.remove('marked-line')
      this.state.set('markedLine', null)
      this.state.set('markedLineIndex', null)
    }
    const fab = document.querySelector('.fab')
    if (fab) {
      fab.style.display = 'none'
    }
  }

  /**
   * Toggle director mode
   */
  toggleDirector() {
    const name = document.getElementById('name')?.value
    const password = document.getElementById('password')?.value

    if (!name || !password) {
      alert('Bitte Name und Passwort eingeben')
      return
    }

    if (this.state.get('isDirector')) {
      // If already director, this acts as a logout
      this.socket.unsetDirector(name)
      this.state.set('isDirector', false)
    } else {
      // Attempt to become director
      this.socket.setDirector(name, password)
    }
  }

  /**
   * Update director UI state
   * @param {boolean} isDirector - Whether current user is director
   */
  updateDirectorUI(isDirector) {
    // Toggle the border only if this user is the director
    document.body.classList.toggle('is-director', isDirector)

    const directorName = this.state.get('directorName')
    // Keep director-active class if there's any director
    if (directorName && directorName !== 'Niemand') {
      document.body.classList.add('director-active')
    } else {
      document.body.classList.remove('director-active')
    }

    // Update button text
    const button = document.querySelector('button[onclick="toggleDirector()"]')
    if (button) {
      button.textContent = isDirector ? 'Director verlassen' : 'Director werden'
    }
  }

  /**
   * Handle director change
   * @param {string} newDirector - New director name
   * @param {boolean} newIsDirector - Whether current user is director
   */
  handleDirectorChange(newDirector, newIsDirector) {
    this.state.set('directorName', newDirector)
    this.state.set('isDirector', newIsDirector)

    // Update UI
    this.updateDirectorUI(newIsDirector)
    const statusEl = document.getElementById('director-status')
    if (statusEl) {
      statusEl.textContent = `Aktueller Director: ${newDirector || 'Niemand'}`
    }
  }

  /**
   * Jump to marked line
   */
  jumpToMarkedLine() {
    const markedLine = this.state.get('markedLine')
    if (markedLine) {
      smoothScrollToElement(markedLine, 25)
    }
  }

  /**
   * Update FAB (Floating Action Button) visibility
   */
  updateFabVisibility() {
    const fab = document.querySelector('.fab')
    const markedLine = this.state.get('markedLine')

    if (!fab || !markedLine) {
      if (fab) fab.style.display = 'none'
      return
    }

    const markedRect = markedLine.getBoundingClientRect()
    const isMarkedLineVisible =
      markedRect.top >= 0 && markedRect.bottom <= window.innerHeight

    // set content to be arrow up or down
    fab.textContent = markedRect.top >= 0 ? '↓' : '↑'

    fab.style.display = isMarkedLineVisible ? 'none' : 'flex'
  }

  /**
   * Toggle director panel
   */
  toggleDirectorPanel() {
    const content = document.querySelector('.director-content')
    if (content) {
      content.classList.toggle('collapsed')
    }
  }
}
