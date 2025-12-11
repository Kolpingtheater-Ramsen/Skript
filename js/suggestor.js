/**
 * Role suggester - Shows which scenes can be rehearsed based on present actors
 */

import { loadPlaysConfig, loadScript, collectScenes } from './api.js'
import { getUrlParams, getEl, createElement } from './utils.js'
import { STORAGE_KEYS } from './config.js'

class RoleSuggestor {
  constructor() {
    this.scriptData = []
    this.actors = new Set()
    this.presentActors = new Set()
    this.characterMap = new Map()
    this.playId = null
    this.sheetUrl = null
  }

  async init() {
    // Get play ID
    const urlParams = getUrlParams()
    const storedPlayId = localStorage.getItem(STORAGE_KEYS.PLAY_ID) || 'default'
    this.playId = urlParams.get('play') || storedPlayId

    if (urlParams.get('play')) {
      localStorage.setItem(STORAGE_KEYS.PLAY_ID, this.playId)
    }

    // Load configuration and data
    const playsConfig = await loadPlaysConfig()
    this.sheetUrl = playsConfig?.[this.playId]?.sheet || playsConfig?.default?.sheet

    await this.loadCharacterMap()
    this.scriptData = await loadScript(this.sheetUrl, this.playId)

    // Extract unique actors
    this.scriptData.forEach((row) => {
      if (row.Charakter && row.Szene && row.Szene > 0) {
        this.actors.add(row.Charakter.trim())
      }
    })

    // Initialize all actors as present
    this.actors.forEach((actor) => this.presentActors.add(actor))

    // Load saved state
    this.loadPresentActorsFromStorage()

    // Render
    this.populateActorList()
    this.updateSuggestions()

    // Setup toggle button
    const toggleBtn = getEl('toggle-all-btn')
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleAllActors())
    }
  }

  async loadCharacterMap() {
    try {
      const response = await fetch('charaktere.csv')
      if (!response.ok) return

      const csvText = await response.text()
      const data = Papa.parse(csvText, { header: true }).data

      data.forEach((row) => {
        if (row.Charakter && row.Schauspieler) {
          this.characterMap.set(
            row.Charakter.trim().toUpperCase(),
            row.Schauspieler.trim()
          )
        }
      })
    } catch (error) {
      console.warn('Character map not available:', error)
    }
  }

  loadPresentActorsFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEYS.PRESENT_ACTORS)
    if (saved) {
      try {
        const parsedActors = JSON.parse(saved)
        this.presentActors = new Set(parsedActors)
      } catch (error) {
        console.error('Failed to load present actors:', error)
      }
    }
  }

  savePresentActorsToStorage() {
    localStorage.setItem(
      STORAGE_KEYS.PRESENT_ACTORS,
      JSON.stringify([...this.presentActors])
    )
  }

  toggleAllActors() {
    const allSelected = this.presentActors.size === this.actors.size
    const checkboxes = document.querySelectorAll('input[type="checkbox"]')

    if (allSelected) {
      // Deselect all
      this.presentActors.clear()
      checkboxes.forEach((cb) => (cb.checked = false))
    } else {
      // Select all
      this.actors.forEach((actor) => this.presentActors.add(actor))
      checkboxes.forEach((cb) => (cb.checked = true))
    }

    this.savePresentActorsToStorage()
    this.updateToggleButtonText()
    this.updateSuggestions()
  }

  updateToggleButtonText() {
    const btn = getEl('toggle-all-btn')
    if (btn) {
      const allSelected = this.presentActors.size === this.actors.size
      btn.textContent = allSelected ? 'Alle Abwählen' : 'Alle Auswählen'
    }
  }

  getActorName(character) {
    const actor = this.characterMap.get(character)
    return actor ? ` (${actor})` : ''
  }

  populateActorList() {
    const container = getEl('actor-list')
    if (!container) return

    container.innerHTML = ''

    // Sort actors alphabetically
    const sortedActors = [...this.actors].sort()

    sortedActors.forEach((actor) => {
      const label = createElement('label', { className: 'actor-item' })

      const checkbox = createElement('input', {
        type: 'checkbox',
        value: actor,
        checked: this.presentActors.has(actor),
        onchange: (e) => {
          if (e.target.checked) {
            this.presentActors.add(actor)
          } else {
            this.presentActors.delete(actor)
          }
          this.savePresentActorsToStorage()
          this.updateToggleButtonText()
          this.updateSuggestions()
        },
      })

      label.appendChild(checkbox)
      label.appendChild(
        document.createTextNode(actor + this.getActorName(actor))
      )
      container.appendChild(label)
    })

    this.updateToggleButtonText()
  }

  getSceneActors(scene) {
    const sceneActors = new Set()
    this.scriptData.forEach((row) => {
      if (row.Szene === scene && row.Charakter) {
        sceneActors.add(row.Charakter.trim())
      }
    })
    return sceneActors
  }

  calculateScenePercentage(sceneActors) {
    if (sceneActors.size === 0) return 100

    const presentCount = [...sceneActors].filter((actor) =>
      this.presentActors.has(actor)
    ).length

    return Math.round((presentCount / sceneActors.size) * 100)
  }

  updateSuggestions() {
    const container = getEl('suggestions')
    if (!container) return

    container.innerHTML = ''

    // Update summary
    const presentCount = getEl('present-count')
    if (presentCount) {
      presentCount.textContent = this.presentActors.size
    }

    // Get unique scenes
    const scenes = collectScenes(this.scriptData)
    let playableScenes = 0

    // Build scene data
    const sceneArray = scenes
      .filter((scene) => scene && scene > 0)
      .map((scene) => {
        const sceneActors = this.getSceneActors(scene)
        const percentage = this.calculateScenePercentage(sceneActors)
        const missingActors = [...sceneActors].filter(
          (actor) => !this.presentActors.has(actor)
        )
        const isPlayable = missingActors.length === 0

        if (isPlayable) playableScenes++

        return {
          scene,
          sceneActors,
          percentage,
          isPlayable,
          missingActors,
        }
      })

    // Sort by percentage (descending)
    sceneArray.sort((a, b) => b.percentage - a.percentage)

    // Update counts
    const totalScenes = getEl('total-scenes')
    const playableScenesEl = getEl('playable-scenes')
    if (totalScenes) totalScenes.textContent = scenes.length
    if (playableScenesEl) playableScenesEl.textContent = playableScenes

    // Render scenes
    sceneArray.forEach(({ scene, sceneActors, percentage, isPlayable }) => {
      const div = createElement('div', {
        className: `scene-card ${
          isPlayable ? 'playable' : 'not-playable'
        }`,
      })

      const title = createElement('h3')
      title.innerHTML = `Szene ${scene} <span class="percentage">${percentage}% anwesend</span>`
      div.appendChild(title)

      const actorsDiv = createElement('div', { className: 'scene-actors' })

      sceneActors.forEach((actor) => {
        const tag = createElement(
          'span',
          {
            className: `role-tag ${
              this.presentActors.has(actor) ? 'available' : 'missing'
            }`,
          },
          actor + this.getActorName(actor)
        )
        actorsDiv.appendChild(tag)
      })

      div.appendChild(actorsDiv)
      container.appendChild(div)
    })
  }
}

// Initialize when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const suggestor = new RoleSuggestor()
    suggestor.init().catch(console.error)
  })
} else {
  const suggestor = new RoleSuggestor()
  suggestor.init().catch(console.error)
}
