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
    this._wasDirector = false
    this._pendingReconnect = false
    this._toastTimeout = null
  }

  /**
   * Initialize director mode and socket handlers
   */
  init() {
    this._setupSocketHandlers()
    this._loadCredentials()
    
    // Expose clear credentials globally
    window.clearDirectorCredentials = () => this.clearCredentials()
  }

  /**
   * Load credentials from localStorage
   * @private
   */
  _loadCredentials() {
    const name = localStorage.getItem('director_name')
    const password = localStorage.getItem('director_password')
    
    if (name) {
      const nameInput = document.getElementById('name')
      if (nameInput) nameInput.value = name
    }
    
    if (password) {
      const passInput = document.getElementById('password')
      if (passInput) passInput.value = password
    }
  }

  /**
   * Setup socket event handlers
   * @private
   */
  _setupSocketHandlers() {
    this.socket.on('connect', () => {
      this.state.set('isConnected', true)
      this.reconnectAttempts = 0
      document.body.classList.remove('reconnecting')

      // Check if we should try to reclaim director status
      if (this._wasDirector) {
        const disconnectedAt = localStorage.getItem('director_disconnected_at')
        if (disconnectedAt) {
          const elapsed = Date.now() - parseInt(disconnectedAt, 10)
          
          if (elapsed < 5 * 60 * 1000) { // < 5 minutes
            this._pendingReconnect = true
            this._showToast('Verbindung wiederhergestellt. Prüfe Director-Status...')
          } else {
            // Session expired
            this._wasDirector = false
            localStorage.removeItem('director_disconnected_at')
            this._showToast('Sitzung abgelaufen – bitte erneut anmelden.')
          }
        }
      }

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
        statusEl.textContent = 'Verbindung unterbrochen – Director Mode Offline'
      }

      // If we were the director, record disconnect time and show visual feedback
      if (this.state.get('isDirector')) {
        this._wasDirector = true
        localStorage.setItem('director_disconnected_at', Date.now().toString())
        document.body.classList.add('reconnecting')
        this._showToast('Verbindung verloren. Reconnecting...')
      }

      this.state.set('isDirector', false)
      this.state.set('directorName', '')
      this.updateDirectorUI(false)

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
    const wasPending = this._pendingReconnect

    if (data.success) {
      if (directorStatus) {
        directorStatus.textContent = data.director
      }
      if (data.director !== 'Niemand') {
        document.body.classList.add('director-active')
        this.state.set('isDirector', data.isDirector)
        this.state.set('directorName', data.director)

        if (data.isDirector) {
          document.body.classList.add('is-director')
          // Save credentials and clear disconnect timestamp
          localStorage.setItem('director_name', document.getElementById('name')?.value || '')
          localStorage.setItem('director_password', document.getElementById('password')?.value || '')
          localStorage.removeItem('director_disconnected_at')
          
          if (wasPending) {
            this._pendingReconnect = false
            this._wasDirector = false
            this._showToast('Director-Status wiederhergestellt ✓')
          }
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
      if (data.message && !wasPending) {
        alert(data.message)
      }
    }

    // Check if we were trying to reconnect
    if (wasPending) {
      const currentDirector = data.director
      if (currentDirector !== 'Niemand' && !data.isDirector) {
        // Someone else is director
        this._pendingReconnect = false
        this._wasDirector = false
        localStorage.removeItem('director_disconnected_at')
        this._showToast(`Verbindung wiederhergestellt. ${currentDirector} ist jetzt Director.`)
      } else if (currentDirector === 'Niemand') {
        // No one is director, try to reclaim
        // We keep _pendingReconnect = true for the next response
        const savedName = localStorage.getItem('director_name')
        const savedPassword = localStorage.getItem('director_password')
        if (savedName && savedPassword) {
          this.socket.setDirector(savedName, savedPassword)
        } else {
          this._pendingReconnect = false
        }
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

    // If we were the previous director, notify
    if (wasDirector) {
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
      this._wasDirector = false
      localStorage.removeItem('director_disconnected_at')
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
   * Show a toast message
   * @private
   */
  _showToast(message, duration = 4000) {
    let toast = document.getElementById('director-toast')
    if (!toast) {
      toast = document.createElement('div')
      toast.id = 'director-toast'
      toast.className = 'toast'
      document.body.appendChild(toast)
    }
    
    toast.textContent = message
    toast.classList.add('show')
    
    if (this._toastTimeout) {
      clearTimeout(this._toastTimeout)
    }
    
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('show')
    }, duration)
  }

  /**
   * Clear director credentials from localStorage
   */
  clearCredentials() {
    localStorage.removeItem('director_name')
    localStorage.removeItem('director_password')
    localStorage.removeItem('director_disconnected_at')
    
    const nameInput = document.getElementById('name')
    const passInput = document.getElementById('password')
    if (nameInput) nameInput.value = ''
    if (passInput) passInput.value = ''
    
    this._showToast('Gespeicherte Daten gelöscht.')
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
