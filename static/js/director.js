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
    this._cursorSequence = Date.now() * 1000
    this._lastServerSequence = null
    this.localMode = false
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
    localStorage.removeItem('director_password')
    
    if (name) {
      const nameInput = document.getElementById('name')
      if (nameInput) nameInput.value = name
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
      if (this.localMode) {
        this.localMode = false
        document.body.classList.remove('local-director-mode')
        this._showToast('Live-Sync wieder verfügbar.')
      }

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
      if (this.localMode) {
        if (statusEl && !this.state.get('isDirector')) {
          statusEl.textContent = 'Lokaler Marker-Modus'
        }
        return
      }
      if (statusEl) {
        statusEl.textContent = `Director Mode: Offline (Verbindungsfehler - Versuch ${this.reconnectAttempts})`
      }
    })

    this.socket.on('disconnect', (reason) => {
      this.state.set('isConnected', false)
      this._lastServerSequence = null
      if (this.localMode) return
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

      // Keep the last cursor visible while reconnecting. The server retains
      // the same snapshot and will confirm it again after room rejoin.
    })

    this.socket.on('markerUpdate', (data) => {
      this._handleMarkerUpdate(data)
    })

    this.socket.on('markerClear', (data) => {
      this._handleMarkerClear(data)
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

    this.socket.on('syncUnavailable', () => {
      this.enableLocalMode()
    })
  }

  enableLocalMode() {
    if (this.localMode) return
    this.localMode = true
    document.body.classList.add('local-director-mode')
    const statusEl = document.getElementById('director-status')
    if (statusEl) {
      statusEl.textContent = 'Lokaler Marker-Modus'
    }
    this._showToast('Live-Sync nicht verfuegbar. Marker funktionieren lokal.')
  }

  /**
   * Handle marker update from server
   * @private
   */
  _handleMarkerUpdate(data) {
    const cursor = this._normalizeCursor(data)
    if (!cursor) return
    if (cursor.playId && cursor.playId !== this.state.get('playId')) return

    if (this._isStaleServerEvent(cursor)) return

    // Keep the cursor even if script loading/rendering has not finished yet.
    // App.render() calls restoreCurrentCursor once canonical line metadata exists.
    this.state.set('currentCursor', cursor)
    this.restoreCurrentCursor(true)
  }

  /**
   * Apply an explicitly ordered marker clear from the server.
   * @param {Object} data - Clear event
   * @private
   */
  _handleMarkerClear(data) {
    if (data?.playId && data.playId !== this.state.get('playId')) return
    if (this._isStaleServerEvent(data)) return
    this.clearMarkedLine()
  }

  /**
   * Ignore reordered server events while accepting legacy unsequenced events.
   * @param {Object} data - Marker or clear event
   * @returns {boolean} Whether the event is stale
   * @private
   */
  _isStaleServerEvent(data) {
    const sequence = data?.sequence
    if (!Number.isSafeInteger(sequence) || sequence < 0) return false
    if (
      Number.isSafeInteger(this._lastServerSequence) &&
      sequence <= this._lastServerSequence
    ) {
      return true
    }
    this._lastServerSequence = sequence
    return false
  }

  /**
   * Normalize canonical and legacy marker payloads into one cursor shape.
   * @param {Object} data - Socket payload
   * @returns {Object|null} Normalized cursor
   * @private
   */
  _normalizeCursor(data) {
    if (!data || typeof data !== 'object') return null

    const cursor = {
      protocolVersion: Number.isSafeInteger(data.protocolVersion)
        ? data.protocolVersion
        : 1,
      playId: typeof data.playId === 'string' ? data.playId : null,
      scriptRevision:
        typeof data.scriptRevision === 'string' ? data.scriptRevision : null,
      cueId: typeof data.cueId === 'string' ? data.cueId : null,
      ordinal: Number.isSafeInteger(data.ordinal) && data.ordinal >= 0
        ? data.ordinal
        : null,
      sequence: Number.isSafeInteger(data.sequence) && data.sequence >= 0
        ? data.sequence
        : null,
      index: Number.isSafeInteger(data.index) && data.index >= 0
        ? data.index
        : null,
    }

    return cursor.cueId || cursor.ordinal !== null || cursor.index !== null
      ? cursor
      : null
  }

  /**
   * Resolve a cursor against the currently rendered script. Cue identity is
   * authoritative. Canonical ordinals are safe only for the same revision;
   * numeric DOM indices remain a migration fallback for legacy clients.
   *
   * @param {Object} cursor - Normalized cursor
   * @param {Array<HTMLElement>} allLines - Rendered script lines
   * @returns {{element: HTMLElement, index: number}|null} Resolved line
   * @private
   */
  _resolveCursor(cursor, allLines) {
    if (cursor.cueId) {
      const index = allLines.findIndex(
        (line) => line.dataset.cueId === cursor.cueId
      )
      if (index >= 0) return { element: allLines[index], index }
    }

    const localRevision = this.state.get('scriptRevision')
    const sameRevision = Boolean(
      localRevision &&
      cursor.scriptRevision &&
      localRevision === cursor.scriptRevision
    )

    if (sameRevision && cursor.ordinal !== null) {
      const ordinal = String(cursor.ordinal)
      const index = allLines.findIndex(
        (line) => line.dataset.cueOrdinal === ordinal
      )
      if (index >= 0) return { element: allLines[index], index }
    }

    const isLegacyCursor = !cursor.cueId && !cursor.scriptRevision
    if (
      cursor.index !== null &&
      cursor.index < allLines.length &&
      (isLegacyCursor || sameRevision)
    ) {
      return { element: allLines[cursor.index], index: cursor.index }
    }

    return null
  }

  /**
   * Apply the latest cursor after initial loading, reconnects, or re-rendering.
   * @param {boolean} autoscroll - Whether to scroll to the resolved line
   * @returns {boolean} Whether a line was resolved
   */
  restoreCurrentCursor(autoscroll = false) {
    const cursor = this.state.get('currentCursor')
    if (!cursor) return false

    const allLines = Array.from(document.querySelectorAll('.script-line'))
    const resolved = this._resolveCursor(cursor, allLines)
    if (!resolved) return false

    this._setMarkedElement(resolved.element, resolved.index)
    const shouldAutoscroll =
      autoscroll && document.getElementById('autoscroll')?.checked
    if (shouldAutoscroll) {
      smoothScrollToElement(resolved.element, 25)
    }
    return true
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
          // Save director name and clear disconnect timestamp. Do not persist passwords.
          localStorage.setItem('director_name', document.getElementById('name')?.value || '')
          localStorage.removeItem('director_password')
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
        if (savedName) {
          this._showToast('Bitte Director erneut mit Passwort aktivieren.')
          this._pendingReconnect = false
          this._wasDirector = false
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
  markLine(element, index, broadcast = true, receivedCursor = null) {
    if (!element) return

    const cursor = receivedCursor || this._createCursor(element, index)
    this.state.set('currentCursor', cursor)
    this._setMarkedElement(element, index)

    // If we're the director, broadcast the marker
    if (broadcast && this.state.get('isDirector') && !this.localMode) {
      this.socket.setMarker(cursor)
    }

    const shouldAutoscroll = document.getElementById('autoscroll')?.checked
    if (shouldAutoscroll) {
      smoothScrollToElement(element, 25)
    }

    // Show/hide FAB based on scroll position
    this.updateFabVisibility()
  }

  /**
   * Build the versioned cursor published by a Director.
   * @param {HTMLElement} element - Canonical script line
   * @param {number} index - Legacy rendered line index
   * @returns {Object} Versioned cursor payload
   * @private
   */
  _createCursor(element, index) {
    this._cursorSequence = Math.max(
      this._cursorSequence + 1,
      Date.now() * 1000
    )

    const ordinal = Number.parseInt(element.dataset.cueOrdinal, 10)
    return {
      protocolVersion: 2,
      playId: this.state.get('playId'),
      scriptRevision: this.state.get('scriptRevision'),
      cueId: element.dataset.cueId || null,
      ordinal: Number.isSafeInteger(ordinal) ? ordinal : index,
      sequence: this._cursorSequence,
      // Kept until every display has migrated to canonical cue identity.
      index,
    }
  }

  /**
   * Replace only the rendered marker while preserving its canonical cursor.
   * @param {HTMLElement} element - Element to mark
   * @param {number} index - Rendered line index
   * @private
   */
  _setMarkedElement(element, index) {
    const previous = this.state.get('markedLine')
    if (previous && previous !== element) {
      previous.classList.remove('marked-line')
    }
    element.classList.add('marked-line')
    this.state.set('markedLine', element)
    this.state.set('markedLineIndex', index)
  }

  /**
   * Clear marked line
   */
  clearMarkedLine() {
    const markedLine = this.state.get('markedLine')
    if (markedLine) {
      markedLine.classList.remove('marked-line')
    }
    this.state.set('markedLine', null)
    this.state.set('markedLineIndex', null)
    this.state.set('currentCursor', null)
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
      if (!this.localMode && this.socket.isOnline) {
        alert('Bitte Name und Passwort eingeben')
        return
      }
    }

    if (this.state.get('isDirector')) {
      // If already director, this acts as a logout
      this.socket.unsetDirector(name)
      this.state.set('isDirector', false)
      this._wasDirector = false
      localStorage.removeItem('director_disconnected_at')
      if (this.localMode || !this.socket.isOnline) {
        this.handleDirectorChange(null, false)
        this.clearMarkedLine()
      }
    } else {
      if (this.localMode || !this.socket.isOnline) {
        this.localMode = true
        document.body.classList.add('local-director-mode')
        localStorage.setItem('director_name', name || 'Lokal')
        this.handleDirectorChange(name || 'Lokal', true)
        this._showToast('Lokaler Marker-Modus aktiv.')
        return
      }
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
      statusEl.textContent = this.localMode && newDirector
        ? `Lokaler Marker: ${newDirector}`
        : `Aktueller Director: ${newDirector || 'Niemand'}`
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
