/**
 * App-level DOM event wiring.
 *
 * Keeps main.js focused on boot/render lifecycle while this module owns
 * browser event hookups that glue UI controls, navigation, and rendering.
 */

import { STORAGE_KEYS } from './config.js'

export function setupAppEvents({ uiControls, navigation, directorManager, render }) {
  const rerenderAndSave = () => {
    uiControls.saveState()
    render()
  }

  // Checkbox change listeners
  document
    .querySelectorAll('#checkboxes input[type="checkbox"]')
    .forEach((input) => {
      input.addEventListener('change', () => {
        if (input.id === 'show-actor-text') {
          uiControls.updateContextSliderVisibility()
        }
        rerenderAndSave()
      })
    })

  // Actor name toggle listener
  const showActorNames = document.getElementById('show-actor-names')
  if (showActorNames) {
    showActorNames.addEventListener('change', () => {
      localStorage.setItem(STORAGE_KEYS.SHOW_ACTOR_NAMES, showActorNames.checked)
      render()
    })
  }

  // Actor select change listener
  const actorSelect = document.getElementById('actor-select')
  if (actorSelect) {
    actorSelect.addEventListener('change', rerenderAndSave)
  }

  // Context slider listeners
  uiControls.addContextSliderListeners(render)

  // Quick content presets
  uiControls.setupPresetButtons(render)

  // Theme switching
  uiControls.setupThemeSwitching()

  // Notes toggle listener
  uiControls.setupNotesListeners(render)

  // Render-affecting standalone toggles
  ;['show-scene-overview', 'blur-lines'].forEach((id) => {
    const input = document.getElementById(id)
    if (input) input.addEventListener('change', rerenderAndSave)
  })

  // Autoscroll is saved but does not require a rerender.
  const autoscroll = document.getElementById('autoscroll')
  if (autoscroll) {
    autoscroll.addEventListener('change', () => {
      uiControls.saveState()
    })
  }

  // Scroll and keyboard navigation
  navigation.setupScrollListener(directorManager)
  navigation.setupKeyboardNavigation(directorManager)

  // Custom event for closing sidebar (from ToC links)
  document.addEventListener('closeSidebar', () => {
    uiControls.closeSidebar()
    navigation.updateCurrentScene()
  })

  // Custom event for ToC navigation to prevent scroll bounce
  document.addEventListener('tocNavigation', () => {
    navigation.startNavigationLock()
  })
}
