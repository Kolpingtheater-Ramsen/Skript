/**
 * Stage viewer (viewer.html) - Shows current and next scene with actors
 */

import { BaseViewer } from './viewer-shared.js'
import { AutoScrollManager, smoothScrollToElement, getEl } from './utils.js'

export class StageViewer extends BaseViewer {
  constructor() {
    super()
    this.autoScrollManager = new AutoScrollManager()
    this.markedLine = null
  }

  /**
   * Render the stage viewer
   */
  render() {
    this.renderScript()
    this.updateProgress()

    // Setup scroll listener
    window.addEventListener('scroll', () => {
      this.onScroll()
    })
  }

  /**
   * Render script content
   */
  renderScript() {
    const container = getEl('script-container')
    if (!container) return

    container.innerHTML = ''
    let currentScene = ''

    this.scriptData.forEach((row, index) => {
      // Skip scene 0
      if (row.Szene == 0) return

      // Check for new scene
      if (row.Szene !== currentScene) {
        // Scene anchor
        const anchor = document.createElement('a')
        anchor.name = `scene-${row.Szene}`
        container.appendChild(anchor)

        // Scene title
        const sceneTitle = document.createElement('h2')
        sceneTitle.className = 'scene-title'
        sceneTitle.textContent = `Szene ${row.Szene}`
        container.appendChild(sceneTitle)

        currentScene = row.Szene
      }

      // Create script line
      const div = document.createElement('div')
      div.className = 'script-line'
      div.dataset.scene = row.Szene
      div.dataset.index = index

      // Apply category styling
      this.applyLineStyle(div, row)

      // Add character name
      if (row.Charakter) {
        const nameSpan = document.createElement('div')
        nameSpan.className = 'actor-name'
        const actorName =
          this.actors.find(([roleName]) => roleName === row.Charakter)?.[1] || '?'
        nameSpan.textContent = `${row.Charakter} (${actorName})`
        div.appendChild(nameSpan)
      }

      // Add text content
      const textDiv = document.createElement('div')
      textDiv.textContent = row['Text/Anweisung']
      div.appendChild(textDiv)

      container.appendChild(div)
    })

    // Update scene info for initial scene
    const firstSceneRow = this.scriptData.find((r) => r.Szene && r.Szene != 0)
    if (firstSceneRow) {
      this.updateSceneInfo(firstSceneRow.Szene)
    }
  }

  /**
   * Apply styling based on category
   */
  applyLineStyle(div, row) {
    const category = row.Kategorie

    if (category === 'Anweisung') {
      div.classList.add('instruction')
    } else if (category === 'Einspieler') {
      div.classList.add('audio')
      const tag = document.createElement('div')
      tag.className = 'tag'
      tag.textContent = 'Einspieler'
      div.appendChild(tag)
    } else if (category === 'Technik') {
      div.classList.add('technical')
      const tag = document.createElement('div')
      tag.className = 'tag'
      tag.textContent = 'Technik'
      div.appendChild(tag)
    } else if (category === 'Licht') {
      div.classList.add('lighting')
      const tag = document.createElement('div')
      tag.className = 'tag'
      tag.textContent = 'Licht'
      div.appendChild(tag)
    } else if (category === 'Requisiten') {
      div.classList.add('props')
      const tag = document.createElement('div')
      tag.className = 'tag'
      tag.textContent = 'Requisiten'
      div.appendChild(tag)
    }
  }

  /**
   * Handle marker update
   */
  onMarkerUpdate(data) {
    // Clear previous marker
    if (this.markedLine) {
      this.markedLine.classList.remove('marked-line')
    }

    // Find and mark the line
    const allLines = document.querySelectorAll('.script-line')
    if (allLines[data.index]) {
      this.markedLine = allLines[data.index]
      this.markedLine.classList.add('marked-line')
      smoothScrollToElement(this.markedLine, 25)

      // Update scene info
      const scene = this.markedLine.dataset.scene
      if (scene) {
        this.updateSceneInfo(scene)
      }
    }
  }

  /**
   * Handle marker clear
   */
  onMarkerClear() {
    if (this.markedLine) {
      this.markedLine.classList.remove('marked-line')
      this.markedLine = null
    }
  }

  /**
   * Handle scroll events
   */
  onScroll() {
    const currentScene = this.getCurrentSceneFromScroll()
    if (currentScene) {
      this.updateSceneInfo(currentScene)
    }
  }

  /**
   * Get current scene from scroll position
   */
  getCurrentSceneFromScroll() {
    const viewportMiddle = window.scrollY + window.innerHeight / 2
    const lines = document.querySelectorAll('.script-line')
    let currentScene = null
    let closestDistance = Infinity

    lines.forEach((line) => {
      const rect = line.getBoundingClientRect()
      const lineMiddle = window.scrollY + rect.top + rect.height / 2
      const distance = Math.abs(viewportMiddle - lineMiddle)

      if (distance < closestDistance) {
        closestDistance = distance
        currentScene = line.dataset.scene
      }
    })

    return currentScene
  }

  /**
   * Update scene info sidebar
   */
  updateSceneInfo(currentScene) {
    this.autoScrollManager.stopAll()

    const sidebar = document.querySelector('.scene-info-sidebar')
    if (!sidebar) return

    sidebar.innerHTML = ''

    // Current scene box
    const currentBox = this.createSceneInfoBox('Aktuelle Szene', currentScene)
    currentBox.classList.add('active')
    sidebar.appendChild(currentBox)

    // Next scene box
    const nextScene = this.getNextScene(currentScene)
    if (nextScene) {
      const nextBox = this.createSceneInfoBox('Nächste Szene', nextScene)
      nextBox.classList.add('next')
      sidebar.appendChild(nextBox)
    }

    // Start auto-scroll after DOM update
    setTimeout(() => {
      const boxes = sidebar.querySelectorAll('.scene-info-box')
      boxes.forEach((box) => {
        const list = box.querySelector('.actor-list')
        if (list) {
          this.autoScrollManager.start(list)
        }
      })
    }, 100)
  }

  /**
   * Create scene info box
   */
  createSceneInfoBox(title, sceneNumber) {
    const box = document.createElement('div')
    box.className = 'scene-info-box'

    const heading = document.createElement('h3')
    heading.textContent = `${title} ${sceneNumber}`
    box.appendChild(heading)

    const actors = this.getSceneActors(sceneNumber)
    const list = document.createElement('ul')
    list.className = 'actor-list'

    // Sort actors by microphone number
    const sortedActors = Array.from(actors.entries()).sort((a, b) => {
      const microA = parseInt(a[1]) || 0
      const microB = parseInt(b[1]) || 0
      return microA - microB
    })

    // Add size classes based on number of actors
    if (sortedActors.length > 8) {
      list.classList.add('very-small')
    } else if (sortedActors.length > 6) {
      list.classList.add('small')
    }

    sortedActors.forEach(([actor, micro]) => {
      const li = document.createElement('li')
      li.innerHTML = `
        <span>${actor}</span>
        ${micro ? `<span class="actor-micro">${micro}</span>` : ''}
      `
      list.appendChild(li)
    })

    box.appendChild(list)
    return box
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const viewer = new StageViewer()
    viewer.init()
  })
} else {
  const viewer = new StageViewer()
  viewer.init()
}
