/**
 * UI controls and settings management
 */

import { CONFIG, STORAGE_KEYS } from './config.js?v=20260720-onboarding-v2'
import { groupActorsByName } from './actor-groups.js'
import {
  applyFilterPreset,
  getMatchingFilterPreset,
} from './filter-presets.js'

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
    const storedDarkMode = localStorage.getItem(STORAGE_KEYS.DARK_MODE)
    const darkMode = storedDarkMode === null ? true : storedDarkMode === 'true'
    const pinkMode = localStorage.getItem(STORAGE_KEYS.PINK_MODE) === 'true'
    this.applyTheme(pinkMode ? 'pink' : darkMode ? 'dark' : 'light')

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

    this.syncPresetSelection()
  }

  /**
   * Apply a theme and keep the dropdown in sync.
   * @param {'light'|'dark'|'pink'} theme - Theme identifier
   */
  applyTheme(theme) {
    const selectedTheme = ['light', 'dark', 'pink'].includes(theme)
      ? theme
      : 'dark'
    const themeLabels = {
      light: 'Hell',
      dark: 'Dunkel',
      pink: 'Pink',
    }
    document.body.classList.toggle('dark-mode', selectedTheme === 'dark')
    document.body.classList.toggle('pink-mode', selectedTheme === 'pink')

    const themeTrigger = document.getElementById('theme-select')
    const themeValue = document.getElementById('theme-select-value')
    const themeSwatch = themeTrigger?.querySelector('[data-theme-swatch]')
    if (themeTrigger) {
      themeTrigger.dataset.value = selectedTheme
    }
    if (themeValue) {
      themeValue.textContent = themeLabels[selectedTheme]
    }
    if (themeSwatch) {
      themeSwatch.className = `theme-swatch theme-swatch-${selectedTheme}`
    }

    document.querySelectorAll('[data-theme-value]').forEach((option) => {
      option.setAttribute(
        'aria-selected',
        String(option.dataset.themeValue === selectedTheme)
      )
    })
  }

  /**
   * Setup preset buttons.
   * @param {Function} onPreset - Callback after preset apply
   */
  setupPresetButtons(onPreset) {
    document.querySelectorAll('[data-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!applyFilterPreset(button.dataset.preset)) return

        if (button.hasAttribute('data-complete-onboarding')) {
          this.completeOnboarding()
        }

        this.updateContextSliderVisibility()
        this.saveState()
        this.syncPresetSelection(button.dataset.preset)
        if (onPreset) onPreset(button.dataset.preset)
      })
    })

    const skipButton = document.getElementById('onboarding-skip')
    if (skipButton) {
      skipButton.addEventListener('click', () => {
        this.completeOnboarding()
        this.saveState()
        if (onPreset) onPreset(null)
      })
    }
  }

  /**
   * Show which preset represents the current detailed settings.
   * @param {string|null} preset - Known preset, or derive it from the controls
   */
  syncPresetSelection(preset = getMatchingFilterPreset()) {
    document
      .querySelectorAll('#settings-modal [data-preset]')
      .forEach((button) => {
        const isActive = button.dataset.preset === preset
        button.classList.toggle('active', isActive)
        button.setAttribute('aria-pressed', String(isActive))
      })
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
        this.syncPresetSelection()
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
      document.body.classList.toggle('sidebar-open', sidebar.classList.contains('active'))

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
      document.body.classList.remove('sidebar-open')
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
      this.syncPresetSelection()
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
   * Ask genuinely new users for their preferred starting view.
   */
  maybeOpenOnboarding() {
    if (
      localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE) === 'true'
    ) {
      return
    }

    const actorSelect = document.getElementById('actor-select')
    const onboardingActor = document.getElementById('onboarding-actor-select')
    if (actorSelect && onboardingActor) {
      onboardingActor.value = actorSelect.value
    }

    const overlay = document.getElementById('onboarding-modal-overlay')
    const modal = document.getElementById('onboarding-modal')
    if (overlay && modal) {
      overlay.classList.add('active')
      modal.classList.add('active')
      document.body.style.overflow = 'hidden'
      modal.querySelector('[data-preset]')?.focus()
    }
  }

  /**
   * Remember the onboarding decision and return to the script.
   */
  completeOnboarding() {
    const onboardingActor = document.getElementById('onboarding-actor-select')
    const actorSelect = document.getElementById('actor-select')
    if (onboardingActor && actorSelect) {
      actorSelect.value = onboardingActor.value
    }

    localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true')
    const overlay = document.getElementById('onboarding-modal-overlay')
    const modal = document.getElementById('onboarding-modal')
    if (overlay && modal) {
      overlay.classList.remove('active')
      modal.classList.remove('active')
      document.body.style.overflow = ''
    }
  }

  /**
   * Setup theme switching.
   */
  setupThemeSwitching() {
    const themeTrigger = document.getElementById('theme-select')
    const themeMenu = document.getElementById('theme-select-menu')
    const themeOptions = Array.from(
      document.querySelectorAll('[data-theme-value]')
    )
    if (!themeTrigger || !themeMenu || !themeOptions.length) return

    const setMenuOpen = (isOpen, focusSelected = false) => {
      themeMenu.hidden = !isOpen
      themeTrigger.setAttribute('aria-expanded', String(isOpen))
      if (isOpen && focusSelected) {
        const selectedOption =
          themeOptions.find(
            (option) => option.dataset.themeValue === themeTrigger.dataset.value
          ) || themeOptions[0]
        selectedOption.focus()
      }
    }

    themeTrigger.addEventListener('click', () => {
      setMenuOpen(themeMenu.hidden, true)
    })

    themeTrigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setMenuOpen(true, true)
      }
    })

    themeOptions.forEach((option, index) => {
      option.addEventListener('click', () => {
        this.applyTheme(option.dataset.themeValue)
        this.saveState()
        setMenuOpen(false)
        themeTrigger.focus()
      })

      option.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          setMenuOpen(false)
          themeTrigger.focus()
          return
        }

        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        const direction = event.key === 'ArrowDown' ? 1 : -1
        themeOptions[
          (index + direction + themeOptions.length) % themeOptions.length
        ].focus()
      })
    })

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.theme-dropdown')) {
        setMenuOpen(false)
      }
    })
  }

  /**
   * Populate actors dropdown
   * @param {Array} actors - Array of [roleName, actorName] pairs
   */
  populateActors(actors) {
    const groups = groupActorsByName(actors)
    ;['actor-select', 'onboarding-actor-select'].forEach((id) => {
      const select = document.getElementById(id)
      if (!select) return

      select.innerHTML = '<option value="">Alle Charaktere anzeigen</option>'
      groups.forEach((group) => {
        const option = document.createElement('option')
        option.value = group.value
        option.textContent = group.label
        select.appendChild(option)
      })
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
      const entries = Object.entries(playsConfig)
      const duplicateDefault =
        playsConfig.default &&
        entries.some(
          ([id, info]) =>
            id !== 'default' &&
            info?.name === playsConfig.default.name &&
            info?.sheet === playsConfig.default.sheet
        )
      entries.forEach(([id, info]) => {
        if (id === 'default' && duplicateDefault) return
        const opt = document.createElement('option')
        opt.value = id
        opt.textContent = info?.name || id
        playSelect.appendChild(opt)
      })
      playSelect.value = currentPlayId === 'default' && duplicateDefault ? CONFIG.DEFAULT_PLAY_ID : currentPlayId
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
    const sheet = document.getElementById('sheet-link')
    if (sheet) {
      const sheetUrl = this.state.get('playsConfig')?.[playId]?.sheet || this.state.get('playsConfig')?.default?.sheet
      if (sheetUrl) {
        sheet.setAttribute('href', sheetUrl)
        sheet.style.display = ''
      } else {
        sheet.style.display = 'none'
      }
    }

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
      showMicrophone:
        document.getElementById('show-microphone')?.checked || false,
      showAutoMicrophone:
        document.getElementById('show-auto-microphone')?.checked || false,
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
      microphoneContext: parseInt(
        document.getElementById('microphone-context')?.value || '0'
      ),
      autoMicrophoneContext: parseInt(
        document.getElementById('auto-microphone-context')?.value || '0'
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

  /**
   * Clear application cache and local storage
   */
  async clearCache() {
    if (
      confirm(
        'Möchten Sie wirklich alle lokal gespeicherten Daten löschen? Dies setzt alle Einstellungen zurück und erfordert eine neue Internetverbindung zum Laden des Skripts.'
      )
    ) {
      // Clear localStorage
      localStorage.clear()

      // Clear sessionStorage
      sessionStorage.clear()

      // Clear all caches
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys()
          await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
        } catch (e) {
          console.error('Failed to clear caches:', e)
        }
      }

      // Reload the page
      window.location.reload()
    }
  }
}
