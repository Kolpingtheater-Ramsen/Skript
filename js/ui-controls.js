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

    const darkMode = localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'true'
    const pinkMode = localStorage.getItem(STORAGE_KEYS.PINK_MODE) === 'true'
    document.body.classList.toggle('dark-mode', darkMode)
    document.body.classList.toggle('pink-mode', pinkMode)

    const darkModeCheckbox = document.getElementById('dark-mode')
    const pinkModeCheckbox = document.getElementById('pink-mode')
    if (darkModeCheckbox) darkModeCheckbox.checked = darkMode
    if (pinkModeCheckbox) pinkModeCheckbox.checked = pinkMode

    // Load actor names toggle
    const showActorNames = document.getElementById('show-actor-names')
    if (showActorNames) {
      const stored = localStorage.getItem(STORAGE_KEYS.SHOW_ACTOR_NAMES)
      if (stored !== null) {
        showActorNames.checked = stored === 'true'
      }
    }
  }

  /**
   * Update context slider visibility based on show-actor-text checkbox
   */
  updateContextSliderVisibility() {
    const showActorText = document.getElementById('show-actor-text')
    const contextSliders = document.querySelectorAll('.context-slider-group')

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
    const navToggle = document.querySelector('.nav-toggle')

    if (sidebar && overlay && navToggle) {
      sidebar.classList.toggle('active')
      overlay.classList.toggle('active')

      // Update button text
      navToggle.textContent = sidebar.classList.contains('active') ? '×' : '☰'
    }
  }

  /**
   * Close sidebar
   */
  closeSidebar() {
    const sidebar = document.querySelector('.sidebar')
    const overlay = document.querySelector('.sidebar-overlay')
    const navToggle = document.querySelector('.nav-toggle')

    if (sidebar && overlay && navToggle) {
      sidebar.classList.remove('active')
      overlay.classList.remove('active')
      navToggle.textContent = '☰'
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
    }
  }

  /**
   * Setup theme switching (dark/pink mode)
   */
  setupThemeSwitching() {
    const pinkMode = document.getElementById('pink-mode')
    const darkMode = document.getElementById('dark-mode')

    if (pinkMode) {
      pinkMode.addEventListener('change', (e) => {
        if (e.target.checked) {
          document.body.classList.remove('dark-mode')
          if (darkMode) darkMode.checked = false
          document.body.classList.add('pink-mode')
        } else {
          document.body.classList.remove('pink-mode')
        }
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

    select.innerHTML = '<option value="">Alle Charaktere</option>'
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
}
