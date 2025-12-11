/**
 * Main entry point for the application
 */

import { CONFIG, STORAGE_KEYS } from './config.js'
import { stateManager } from './state.js'
import { socketManager } from './socket.js'
import { dataManager } from './data-manager.js'
import { Renderer } from './renderer.js'
import { DirectorManager } from './director.js'
import { UIControlsManager } from './ui-controls.js'
import { NavigationManager } from './navigation.js'
import { getUrlParams } from './utils.js'

/**
 * Main Application class
 */
class App {
  constructor() {
    this.renderer = new Renderer(stateManager)
    this.directorManager = new DirectorManager(stateManager, socketManager)
    this.uiControls = new UIControlsManager(stateManager)
    this.navigation = new NavigationManager(stateManager)
  }

  /**
   * Initialize the application
   */
  async init() {
    // Get play ID from URL or localStorage
    const urlParams = getUrlParams()
    const storedPlayId =
      localStorage.getItem(STORAGE_KEYS.PLAY_ID) || CONFIG.DEFAULT_PLAY_ID
    const playId = urlParams.get('play') || storedPlayId

    if (urlParams.get('play')) {
      localStorage.setItem(STORAGE_KEYS.PLAY_ID, playId)
    }

    stateManager.set('playId', playId)

    // Initialize socket connection
    socketManager.init(playId)

    // Initialize director mode
    this.directorManager.init()

    // Load plays configuration
    await dataManager.loadPlaysConfig()

    // Setup play selector and update links
    this.uiControls.setupPlaySelector(dataManager.getPlaysConfig(), playId)
    this.uiControls.updateLinksWithPlayParam(playId)

    // Load script data
    let data = await dataManager.loadScript(playId)
    const actors = dataManager.getActors(data)

    // Normalize data
    data = dataManager.normalizeData(data)

    // Store in state and global for backward compatibility
    stateManager.set('scriptData', data)
    stateManager.set('actors', actors)
    window.scriptData = data
    window.actors = actors

    // Populate actors dropdown
    this.uiControls.populateActors(actors)

    // Load UI state
    this.uiControls.loadState()

    // Setup event listeners
    this.setupEventListeners()

    // Initial render
    this.render()

    // Update current scene
    this.navigation.updateCurrentScene()
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Checkbox change listeners
    document
      .querySelectorAll('#checkboxes input[type="checkbox"]')
      .forEach((input) => {
        input.addEventListener('change', () => {
          if (input.id === 'show-actor-text') {
            this.uiControls.updateContextSliderVisibility()
          }
          this.uiControls.saveState()
          this.render()
        })
      })

    // Actor name toggle listener
    const showActorNames = document.getElementById('show-actor-names')
    if (showActorNames) {
      showActorNames.addEventListener('change', () => {
        localStorage.setItem(
          STORAGE_KEYS.SHOW_ACTOR_NAMES,
          showActorNames.checked
        )
        this.render()
      })
    }

    // Actor select change listener
    const actorSelect = document.getElementById('actor-select')
    if (actorSelect) {
      actorSelect.addEventListener('change', () => {
        this.uiControls.saveState()
        this.render()
      })
    }

    // Context slider listeners
    this.uiControls.addContextSliderListeners(() => {
      this.render()
    })

    // Theme switching
    this.uiControls.setupThemeSwitching()

    // Notes toggle listener
    this.uiControls.setupNotesListeners(() => {
      this.render()
    })

    // Scene overview toggle listener
    const sceneOverview = document.getElementById('show-scene-overview')
    if (sceneOverview) {
      sceneOverview.addEventListener('change', () => {
        this.uiControls.saveState()
        this.render()
      })
    }

    // Blur lines toggle listener
    const blurLines = document.getElementById('blur-lines')
    if (blurLines) {
      blurLines.addEventListener('change', () => {
        this.uiControls.saveState()
        this.render()
      })
    }

    // Autoscroll toggle listener
    const autoscroll = document.getElementById('autoscroll')
    if (autoscroll) {
      autoscroll.addEventListener('change', () => {
        this.uiControls.saveState()
      })
    }

    // Scroll listener
    this.navigation.setupScrollListener(this.directorManager)

    // Keyboard navigation
    this.navigation.setupKeyboardNavigation(this.directorManager)

    // Custom event for closing sidebar (from ToC links)
    document.addEventListener('closeSidebar', () => {
      this.uiControls.closeSidebar()
      this.navigation.updateCurrentScene()
    })

    // Custom event for ToC navigation to prevent scroll bounce
    document.addEventListener('tocNavigation', () => {
      this.navigation.startNavigationLock()
    })
  }

  /**
   * Render the script
   */
  render() {
    const data = stateManager.get('scriptData')
    const actors = stateManager.get('actors')
    const settings = this.uiControls.getRenderSettings()

    this.renderer.renderScript(data, settings, actors, (element, row) => {
      this.handleLineClick(element, row, settings)
    })

    // Update bottom navigation after rendering
    this.navigation.updateBottomNav()
  }

  /**
   * Handle line click
   * @param {HTMLElement} element - Clicked element
   * @param {Object} row - Script row data
   * @param {Object} settings - Current settings
   */
  handleLineClick(element, row, settings) {
    const allLines = document.querySelectorAll('.script-line')
    const lineIndex = Array.from(allLines).indexOf(element)
    this.directorManager.markLine(element, lineIndex)

    // Toggle blur if blur lines is enabled and this is the selected actor (case-insensitive)
    if (
      settings.blurLines &&
      settings.selectedActor &&
      row.Charakter &&
      row.Charakter.toUpperCase() === settings.selectedActor
    ) {
      element.style.filter =
        element.style.filter === 'none' ? 'blur(4px)' : 'none'
    }
  }
}

// Make functions globally accessible for inline event handlers in HTML
window.toggleSidebar = function () {
  const app = window.appInstance
  if (app) {
    app.uiControls.toggleSidebar()
  }
}

window.closeSidebar = function () {
  const app = window.appInstance
  if (app) {
    app.uiControls.closeSidebar()
  }
}

window.openSettingsModal = function () {
  const app = window.appInstance
  if (app) {
    app.uiControls.openSettingsModal()
  }
}

window.closeSettingsModal = function () {
  const app = window.appInstance
  if (app) {
    app.uiControls.closeSettingsModal()
  }
}

window.toggleDirector = function () {
  const app = window.appInstance
  if (app) {
    app.directorManager.toggleDirector()
  }
}

window.toggleDirectorPanel = function () {
  const app = window.appInstance
  if (app) {
    app.directorManager.toggleDirectorPanel()
  }
}

window.jumpToMarkedLine = function () {
  const app = window.appInstance
  if (app) {
    app.directorManager.jumpToMarkedLine()
  }
}

window.jumpToNextLine = function () {
  const app = window.appInstance
  if (app) {
    app.navigation.jumpToNextLine()
  }
}

window.jumpToPreviousLine = function () {
  const app = window.appInstance
  if (app) {
    app.navigation.jumpToPreviousLine()
  }
}

// Initialize the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.appInstance = new App()
    window.appInstance.init()
  })
} else {
  window.appInstance = new App()
  window.appInstance.init()
}
