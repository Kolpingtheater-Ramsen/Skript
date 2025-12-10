/**
 * UI controls and settings management
 */

import { STORAGE_KEYS } from './config.js'

/**
 * UI Controls Manager class
 */
export class UIControlsManager {
  constructor(stateManager) {
    this.state = stateManager
  }

  /**
   * Save all checkbox and slider states to localStorage
   */
  saveState() {
    const checkboxes = document.querySelectorAll(
      '#checkboxes input[type="checkbox"]'
    )
    checkboxes.forEach((checkbox) => {
      localStorage.setItem(checkbox.id, checkbox.checked)
    })

    // Save context slider values
    const sliders = document.querySelectorAll('input[type="range"]')
    sliders.forEach((slider) => {
      localStorage.setItem(slider.id, slider.value)
    })

    const actorSelect = document.getElementById('actor-select')
    if (actorSelect) {
      localStorage.setItem(STORAGE_KEYS.ACTOR_SELECT, actorSelect.value)
    }

    localStorage.setItem(
      STORAGE_KEYS.DARK_MODE,
      document.body.classList.contains('dark-mode')
    )
    localStorage.setItem(
      STORAGE_KEYS.PINK_MODE,
      document.body.classList.contains('pink-mode')
    )

    // Save notes enabled state
    const enableNotes = document.getElementById('enable-notes')
    if (enableNotes) {
      localStorage.setItem(STORAGE_KEYS.ENABLE_NOTES, enableNotes.checked)
    }

    // Save scene overview state
    const sceneOverview = document.getElementById('show-scene-overview')
    if (sceneOverview) {
      localStorage.setItem('show-scene-overview', sceneOverview.checked)
    }

    // Save blur lines state
    const blurLines = document.getElementById('blur-lines')
    if (blurLines) {
      localStorage.setItem('blur-lines', blurLines.checked)
    }

    // Save autoscroll state
    const autoscroll = document.getElementById('autoscroll')
    if (autoscroll) {
      localStorage.setItem('autoscroll', autoscroll.checked)
    }
  }

  /**
   * Load all checkbox and slider states from localStorage
   */
  loadState() {
    const checkboxes = document.querySelectorAll(
      '#checkboxes input[type="checkbox"]'
    )
    checkboxes.forEach((checkbox) => {
      const storedValue = localStorage.getItem(checkbox.id)
      if (storedValue !== null) {
        checkbox.checked = storedValue === 'true'
      }
    })

    // Load context slider values
    const sliders = document.querySelectorAll('input[type="range"]')
    sliders.forEach((slider) => {
      const storedValue = localStorage.getItem(slider.id)
      if (storedValue !== null) {
        slider.value = storedValue
        const valueDisplay = document.getElementById(`${slider.id}-value`)
        if (valueDisplay) {
          valueDisplay.textContent = storedValue
        }
      }
    })

    const actorSelect = document.getElementById('actor-select')
    if (actorSelect) {
      actorSelect.value = localStorage.getItem(STORAGE_KEYS.ACTOR_SELECT) || ''
    }

    // Update context slider visibility
    this.updateContextSliderVisibility()

    // Load theme
    const darkMode = localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'true'
    const pinkMode = localStorage.getItem(STORAGE_KEYS.PINK_MODE) === 'true'
    document.body.classList.toggle('dark-mode', darkMode)
    document.body.classList.toggle('pink-mode', pinkMode)

    const darkModeCheckbox = document.getElementById('dark-mode')
    const pinkModeCheckbox = document.getElementById('pink-mode')
    if (darkModeCheckbox) darkModeCheckbox.checked = darkMode
    if (pinkModeCheckbox) pinkModeCheckbox.checked = pinkMode

    // Update theme option visual state
    this.updateThemeOptionVisuals()

    // Load actor names toggle
    const showActorNames = document.getElementById('show-actor-names')
    if (showActorNames) {
      const stored = localStorage.getItem(STORAGE_KEYS.SHOW_ACTOR_NAMES)
      if (stored !== null) {
        showActorNames.checked = stored === 'true'
      }
    }

    // Load notes enabled state
    const enableNotes = document.getElementById('enable-notes')
    if (enableNotes) {
      const stored = localStorage.getItem(STORAGE_KEYS.ENABLE_NOTES)
      enableNotes.checked = stored === 'true'
    }

    // Load scene overview state
    const sceneOverview = document.getElementById('show-scene-overview')
    if (sceneOverview) {
      const stored = localStorage.getItem('show-scene-overview')
      if (stored !== null) {
        sceneOverview.checked = stored === 'true'
      }
    }

    // Load blur lines state
    const blurLines = document.getElementById('blur-lines')
    if (blurLines) {
      const stored = localStorage.getItem('blur-lines')
      if (stored !== null) {
        blurLines.checked = stored === 'true'
      }
    }

    // Load autoscroll state
    const autoscroll = document.getElementById('autoscroll')
    if (autoscroll) {
      const stored = localStorage.getItem('autoscroll')
      if (stored !== null) {
        autoscroll.checked = stored === 'true'
      }
    }
  }

  /**
   * Update theme option visual state
   */
  updateThemeOptionVisuals() {
    const isDark = document.body.classList.contains('dark-mode')
    const isPink = document.body.classList.contains('pink-mode')

    const lightOption = document.getElementById('theme-light')
    const darkOption = document.getElementById('theme-dark')
    const pinkOption = document.getElementById('theme-pink')

    if (lightOption) {
      lightOption.classList.toggle('active', !isDark && !isPink)
    }
    if (darkOption) {
      darkOption.classList.toggle('active', isDark)
    }
    if (pinkOption) {
      pinkOption.classList.toggle('active', isPink)
    }
  }

  /**
   * Update context slider visibility based on show-actor-text checkbox
   */
  updateContextSliderVisibility() {
    const showActorText = document.getElementById('show-actor-text')
    const contextSliders = document.querySelectorAll('.range-group')

    if (showActorText) {
      contextSliders.forEach((slider) => {
        slider.style.display = showActorText.checked ? 'none' : 'flex'
      })
    }
  }

  /**
   * Add event listeners for context sliders
   * @param {Function} onChangeCallback - Callback when slider changes
   */
  addContextSliderListeners(onChangeCallback) {
    const sliders = document.querySelectorAll('input[type="range"]')
    sliders.forEach((slider) => {
      slider.addEventListener('input', (e) => {
        const valueDisplay = document.getElementById(`${e.target.id}-value`)
        if (valueDisplay) {
          valueDisplay.textContent = e.target.value
        }
        this.saveState()
        if (onChangeCallback) {
          onChangeCallback()
        }
      })
    })
  }

  /**
   * Toggle sidebar
   */
  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar')
    const overlay = document.querySelector('.sidebar-overlay')
    const navToggle = document.querySelector('.nav-btn[onclick*="toggleSidebar"]')

    if (sidebar && overlay) {
      sidebar.classList.toggle('active')
      overlay.classList.toggle('active')

      // Update button text if exists
      if (navToggle) {
        navToggle.textContent = sidebar.classList.contains('active') ? '×' : '☰'
      }
    }
  }

  /**
   * Close sidebar
   */
  closeSidebar() {
    const sidebar = document.querySelector('.sidebar')
    const overlay = document.querySelector('.sidebar-overlay')
    const navToggle = document.querySelector('.nav-btn[onclick*="toggleSidebar"]')

    if (sidebar && overlay) {
      sidebar.classList.remove('active')
      overlay.classList.remove('active')
      if (navToggle) {
        navToggle.textContent = '☰'
      }
    }
  }

  /**
   * Open settings modal
   */
  openSettingsModal() {
    const overlay = document.getElementById('settings-modal-overlay')
    const modal = document.getElementById('settings-modal')
    if (overlay && modal) {
      overlay.classList.add('active')
      modal.classList.add('active')
      document.body.style.overflow = 'hidden'
    }
  }

  /**
   * Close settings modal
   */
  closeSettingsModal() {
    const overlay = document.getElementById('settings-modal-overlay')
    const modal = document.getElementById('settings-modal')
    if (overlay && modal) {
      overlay.classList.remove('active')
      modal.classList.remove('active')
      document.body.style.overflow = ''
    }
  }

  /**
   * Setup theme switching (dark/pink mode)
   */
  setupThemeSwitching() {
    const pinkMode = document.getElementById('pink-mode')
    const darkMode = document.getElementById('dark-mode')
    const lightOption = document.getElementById('theme-light')
    const darkOption = document.getElementById('theme-dark')
    const pinkOption = document.getElementById('theme-pink')

    // Theme option click handlers
    if (lightOption) {
      lightOption.addEventListener('click', () => {
        document.body.classList.remove('dark-mode', 'pink-mode')
        if (darkMode) darkMode.checked = false
        if (pinkMode) pinkMode.checked = false
        this.updateThemeOptionVisuals()
        this.saveState()
      })
    }

    if (darkOption) {
      darkOption.addEventListener('click', () => {
        document.body.classList.remove('pink-mode')
        document.body.classList.add('dark-mode')
        if (darkMode) darkMode.checked = true
        if (pinkMode) pinkMode.checked = false
        this.updateThemeOptionVisuals()
        this.saveState()
      })
    }

    if (pinkOption) {
      pinkOption.addEventListener('click', () => {
        document.body.classList.remove('dark-mode')
        document.body.classList.add('pink-mode')
        if (pinkMode) pinkMode.checked = true
        if (darkMode) darkMode.checked = false
        this.updateThemeOptionVisuals()
        this.saveState()
      })
    }

    // Legacy checkbox handlers (for backward compatibility)
    if (pinkMode) {
      pinkMode.addEventListener('change', (e) => {
        if (e.target.checked) {
          document.body.classList.remove('dark-mode')
          if (darkMode) darkMode.checked = false
          document.body.classList.add('pink-mode')
        } else {
          document.body.classList.remove('pink-mode')
        }
        this.updateThemeOptionVisuals()
        this.saveState()
      })
    }

    if (darkMode) {
      darkMode.addEventListener('change', (e) => {
        if (e.target.checked) {
          document.body.classList.remove('pink-mode')
          if (pinkMode) pinkMode.checked = false
          document.body.classList.add('dark-mode')
        } else {
          document.body.classList.remove('dark-mode')
        }
        this.updateThemeOptionVisuals()
        this.saveState()
      })
    }
  }

  /**
   * Populate actors dropdown
   * @param {Array} actors - Array of [roleName, actorName] pairs
   */
  populateActors(actors) {
    const select = document.getElementById('actor-select')
    if (!select) return

    select.innerHTML = '<option value="">Alle Charaktere anzeigen</option>'
    actors.forEach(([roleName, actorName]) => {
      const option = document.createElement('option')
      option.value = roleName
      option.textContent = `${roleName} (${actorName})`
      select.appendChild(option)
    })
  }

  /**
   * Setup play selector
   * @param {Object} playsConfig - Plays configuration
   * @param {string} currentPlayId - Current play ID
   */
  setupPlaySelector(playsConfig, currentPlayId) {
    const playSelect = document.getElementById('play-select')
    if (playSelect && playsConfig) {
      playSelect.innerHTML = ''
      Object.entries(playsConfig).forEach(([id, info]) => {
        const opt = document.createElement('option')
        opt.value = id
        opt.textContent = info?.name || id
        playSelect.appendChild(opt)
      })
      playSelect.value = currentPlayId
      playSelect.addEventListener('change', (e) => {
        const newPlay = e.target.value
        localStorage.setItem(STORAGE_KEYS.PLAY_ID, newPlay)
        const url = new URL(window.location.href)
        url.searchParams.set('play', newPlay)
        window.location.href = url.toString()
      })
    }
  }

  /**
   * Update links with play parameter
   * @param {string} playId - Current play ID
   */
  updateLinksWithPlayParam(playId) {
    // Update suggestor link
    const sugg = document.getElementById('suggestor-link')
    if (sugg) {
      const u = new URL(sugg.getAttribute('href'), window.location.href)
      u.searchParams.set('play', playId)
      sugg.setAttribute('href', u.pathname + u.search)
    }

    // Update viewer links
    const viewer = document.getElementById('viewer-link')
    if (viewer) {
      const u = new URL(viewer.getAttribute('href'), window.location.href)
      u.searchParams.set('play', playId)
      viewer.setAttribute('href', u.pathname + u.search)
    }

    const viewer2 = document.getElementById('viewer2-link')
    if (viewer2) {
      const u2 = new URL(viewer2.getAttribute('href'), window.location.href)
      u2.searchParams.set('play', playId)
      viewer2.setAttribute('href', u2.pathname + u2.search)
    }
  }

  /**
   * Get current render settings from UI
   * @returns {Object} Render settings object
   */
  getRenderSettings() {
    return {
      selectedActor:
        document.getElementById('actor-select')?.value.toUpperCase() || '',
      useActorNames:
        document.getElementById('show-actor-names')?.checked || false,
      showDirections:
        document.getElementById('show-directions')?.checked || false,
      showTechnical:
        document.getElementById('show-technical')?.checked || false,
      showLighting: document.getElementById('show-lighting')?.checked || false,
      showActorText:
        document.getElementById('show-actor-text')?.checked || false,
      showMicro: document.getElementById('show-micro')?.checked || false,
      showEinspieler:
        document.getElementById('show-einspieler')?.checked || false,
      showRequisiten:
        document.getElementById('show-requisiten')?.checked || false,
      showSceneOverview:
        document.getElementById('show-scene-overview')?.checked || false,
      blurLines: document.getElementById('blur-lines')?.checked || false,
      enableNotes: document.getElementById('enable-notes')?.checked || false,
      directionsContext: parseInt(
        document.getElementById('directions-context')?.value || '0'
      ),
      technicalContext: parseInt(
        document.getElementById('technical-context')?.value || '0'
      ),
      lightingContext: parseInt(
        document.getElementById('lighting-context')?.value || '0'
      ),
      einspielContext: parseInt(
        document.getElementById('einspieler-context')?.value || '0'
      ),
      requisitenContext: parseInt(
        document.getElementById('requisiten-context')?.value || '0'
      ),
    }
  }

  /**
   * Setup notes feature listeners
   * @param {Function} onNotesToggle - Callback when notes are toggled
   */
  setupNotesListeners(onNotesToggle) {
    const enableNotes = document.getElementById('enable-notes')
    if (enableNotes) {
      enableNotes.addEventListener('change', () => {
        this.saveState()
        if (onNotesToggle) {
          onNotesToggle(enableNotes.checked)
        }
      })
    }
  }
}
