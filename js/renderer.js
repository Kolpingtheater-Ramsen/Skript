/**
 * Renderer for script content
 */

import { escapeRegExp } from './utils.js'
import { CATEGORIES } from './config.js'

/**
 * Script Renderer class
 */
export class Renderer {
  constructor(stateManager) {
    this.state = stateManager
  }

  /**
   * Create Table of Contents
   * @param {Array} data - Script data
   * @param {string} selectedActor - Selected actor/role name
   * @returns {HTMLElement} ToC element
   */
  createToC(data, selectedActor) {
    // Get all scenes & actors in each scene
    const scenes = {}
    data.forEach((row) => {
      if (row.Szene) {
        if (!scenes[row.Szene]) {
          scenes[row.Szene] = false
        }
        if (row.Charakter && row.Charakter == selectedActor) {
          scenes[row.Szene] = true
        } else if (
          row.Kategorie === CATEGORIES.INSTRUCTION &&
          row['Text/Anweisung'].includes(selectedActor)
        ) {
          scenes[row.Szene] = true
        }
      }
    })

    const createTocContent = () => {
      const toc = document.createElement('div')
      toc.className = 'toc'

      const title = document.createElement('h2')
      title.textContent = 'Inhaltsverzeichnis'
      toc.appendChild(title)

      Object.keys(scenes).forEach((scene) => {
        const a = document.createElement('a')
        a.href = `#scene-${scene}`
        if (scenes[scene]) {
          a.style.fontWeight = 'bold'
          a.style.borderLeft = '4px solid #4299e1'
        }
        a.textContent = `Szene ${scene}`
        a.onclick = () => {
          if (window.innerWidth <= 768) {
            // Will be handled by ui-controls
            const event = new CustomEvent('closeSidebar')
            document.dispatchEvent(event)
          }
        }
        toc.appendChild(a)
      })

      return toc
    }

    // Create and return TOC for main content
    const mainToc = createTocContent()

    // Create and update sidebar TOC
    const sidebarToc = createTocContent()
    const sidebar = document.querySelector('.sidebar')
    if (sidebar) {
      sidebar.innerHTML = ''
      sidebar.appendChild(sidebarToc)
    }

    return mainToc
  }

  /**
   * Create scene overview table
   * @param {Array} sceneData - Data for a specific scene
   * @param {string} selectedActor - Selected actor/role name
   * @param {Array} actors - All actors array
   * @param {boolean} useActorNames - Whether to show actor names
   * @returns {HTMLElement} Scene overview element
   */
  createSceneOverview(sceneData, selectedActor, actors, useActorNames) {
    let actorsSet = new Set()
    const micros = new Map()

    sceneData.forEach((row) => {
      if (row.Charakter) {
        let display
        if (useActorNames) {
          const actor = actors?.find((a) => a[0] === row.Charakter)?.[1]
          display = actor ? `${row.Charakter} (${actor})` : row.Charakter
        } else {
          display = row.Charakter
        }
        actorsSet.add(display)
        if (row.Mikrofon) {
          micros.set(display, row.Mikrofon)
        }
      }
    })

    if (actorsSet.size === 0) return document.createElement('div')

    const overview = document.createElement('div')
    overview.className = 'scene-overview'

    const title = document.createElement('h3')
    title.textContent = 'Szenenübersicht'
    overview.appendChild(title)

    const table = document.createElement('table')

    const tr = document.createElement('tr')
    const th1 = document.createElement('th')
    th1.textContent = 'Mikro'
    tr.appendChild(th1)
    const th2 = document.createElement('th')
    th2.textContent = 'Schauspieler'
    tr.appendChild(th2)
    table.appendChild(tr)

    // Sort actors by micro and try to parse micros as numbers
    actorsSet = Array.from(actorsSet).sort((a, b) => {
      const microA = parseInt(micros.get(a), 10)
      const microB = parseInt(micros.get(b), 10)
      return microA - microB
    })

    actorsSet.forEach((actor) => {
      const tr = document.createElement('tr')
      const td1 = document.createElement('td')
      td1.textContent = micros.get(actor) || ''
      tr.appendChild(td1)
      const td2 = document.createElement('td')
      td2.innerHTML = selectedActor === actor ? `<b>${actor}</b>` : actor
      tr.appendChild(td2)
      table.appendChild(tr)
    })

    overview.appendChild(table)

    return overview
  }

  /**
   * Calculate visibility state for all lines
   * @param {Array} data - Script data
   * @param {Object} settings - Render settings
   * @returns {Map} Map of index to {visible, isContext}
   */
  calculateLineStates(data, settings) {
    const lineStates = new Map()

    data.forEach((row, index) => {
      const state = { visible: false, isContext: false }

      if (
        (settings.showDirections && row.Kategorie === CATEGORIES.INSTRUCTION) ||
        (settings.showTechnical && row.Kategorie === CATEGORIES.TECHNICAL) ||
        (settings.showLighting && row.Kategorie === CATEGORIES.LIGHTING) ||
        (settings.showEinspieler && row.Kategorie === CATEGORIES.AUDIO) ||
        (settings.showRequisiten && row.Kategorie === CATEGORIES.PROPS) ||
        (settings.showActorText &&
          row.Charakter &&
          row.Kategorie === CATEGORIES.ACTOR)
      ) {
        state.visible = true

        // Add context lines based on category
        let contextRange = 0
        if (row.Kategorie === CATEGORIES.INSTRUCTION)
          contextRange = settings.directionsContext
        else if (row.Kategorie === CATEGORIES.TECHNICAL)
          contextRange = settings.technicalContext
        else if (row.Kategorie === CATEGORIES.LIGHTING)
          contextRange = settings.lightingContext
        else if (row.Kategorie === CATEGORIES.AUDIO)
          contextRange = settings.einspielContext
        else if (row.Kategorie === CATEGORIES.PROPS)
          contextRange = settings.requisitenContext

        // Mark context lines
        for (
          let i = Math.max(0, index - contextRange);
          i <= Math.min(data.length - 1, index + contextRange);
          i++
        ) {
          if (i !== index) {
            const contextState = lineStates.get(i) || {
              visible: false,
              isContext: false,
            }
            contextState.isContext = true
            lineStates.set(i, contextState)
          }
        }
      }

      lineStates.set(index, state)
    })

    return lineStates
  }

  /**
   * Create a script line element
   * @param {Object} row - Script row data
   * @param {Object} state - Line visibility state
   * @param {Object} settings - Render settings
   * @param {Array} actors - All actors array
   * @param {Function} onLineClick - Click handler
   * @returns {HTMLElement} Script line element
   */
  createScriptLine(row, state, settings, actors, onLineClick) {
    const div = document.createElement('div')
    div.className = 'script-line'

    // Set visibility based on state
    if (!state.visible && !state.isContext) {
      div.style.display = 'none'
    } else if (state.isContext && !state.visible) {
      div.classList.add('context-line')
    }

    // Apply styling based on type
    if (row.Kategorie === CATEGORIES.INSTRUCTION) {
      div.classList.add('instruction')
    } else if (row.Kategorie === CATEGORIES.SCENE_START) {
      div.style.display = 'none'
    } else if (row.Kategorie === CATEGORIES.AUDIO) {
      div.classList.add('audio')
      const audioSpan = document.createElement('div')
      audioSpan.className = 'tag'
      audioSpan.textContent = 'Einspieler'
      div.appendChild(audioSpan)
    } else if (row.Kategorie === CATEGORIES.PROPS) {
      const propsSpan = document.createElement('div')
      propsSpan.className = 'tag'
      propsSpan.textContent = 'Requisiten'
      div.appendChild(propsSpan)
      div.classList.add('props')
      if (row.Charakter === settings.selectedActor) {
        div.classList.add('highlighted')
      }
    } else if (row.Kategorie === CATEGORIES.TECHNICAL) {
      const techSpan = document.createElement('div')
      techSpan.className = 'tag'
      techSpan.textContent = 'Technik'
      div.appendChild(techSpan)
      div.classList.add('technical')
    } else if (row.Kategorie === CATEGORIES.LIGHTING) {
      const lightSpan = document.createElement('div')
      lightSpan.className = 'tag'
      lightSpan.textContent = 'Licht'
      div.appendChild(lightSpan)
      div.classList.add('lighting')
    } else if (
      row.Charakter.includes(settings.selectedActor) &&
      settings.selectedActor
    ) {
      div.classList.add('highlighted')
      if (settings.blurLines) {
        div.style.filter = 'blur(4px)'
      }
    }

    // Add click handler for all lines
    div.style.cursor = 'pointer'
    div.addEventListener('click', () => {
      onLineClick(div, row)
    })

    // Create content - character name
    if (row.Charakter) {
      const nameSpan = document.createElement('div')
      nameSpan.className = 'actor-name'
      let displayName
      if (settings.useActorNames) {
        const actor = actors.find((a) => a[0] === row.Charakter)
        displayName = actor ? `${row.Charakter} (${actor[1]})` : row.Charakter
      } else {
        displayName = row.Charakter
      }
      nameSpan.textContent =
        row.Mikrofon && settings.showMicro
          ? `${displayName} (${row.Mikrofon})`
          : displayName
      div.appendChild(nameSpan)
    }

    // Create content - text
    const textDiv = document.createElement('div')
    let displayText = row['Text/Anweisung'] || ''

    // Highlight selected actor in text
    if (
      settings.selectedActor &&
      row['Text/Anweisung'].includes(settings.selectedActor)
    ) {
      div.classList.add('highlighted')
    }

    // Map role names to actor names in instructions
    if (
      settings.useActorNames &&
      row.Kategorie === CATEGORIES.INSTRUCTION &&
      actors &&
      actors.length > 0
    ) {
      for (const [roleUpper, actorName] of actors) {
        try {
          const pattern = new RegExp(`\\b${escapeRegExp(roleUpper)}\\b`, 'gi')
          displayText = displayText.replace(
            pattern,
            `${roleUpper} (${actorName})`
          )
        } catch (e) {
          // Fallback: skip problematic patterns
        }
      }
    }

    textDiv.textContent = displayText

    // Bold name in instruction according to toggle
    if (row.Kategorie === CATEGORIES.INSTRUCTION && settings.selectedActor) {
      const nameToBold = settings.useActorNames
        ? actors?.find((a) => a[0] === settings.selectedActor)?.[1] ||
          settings.selectedActor
        : settings.selectedActor
      try {
        const boldPattern = new RegExp(
          `\\b${escapeRegExp(nameToBold)}\\b`,
          'gi'
        )
        textDiv.innerHTML = textDiv.textContent.replace(
          boldPattern,
          `<b>${nameToBold}</b>`
        )
      } catch (e) {
        // If regex fails, fall back to simple replace
        textDiv.innerHTML = textDiv.textContent
          .split(nameToBold)
          .join(`<b>${nameToBold}</b>`)
      }
    }

    // Add actor name to technical instructions if useActorNames is true
    if (
      settings.useActorNames &&
      (row.Kategorie === CATEGORIES.INSTRUCTION ||
        row.Kategorie === CATEGORIES.TECHNICAL)
    ) {
      for (const [roleUpper, actorName] of actors) {
        try {
          const pattern = new RegExp(`\\b${escapeRegExp(roleUpper)}\\b`, 'gi')
          textDiv.innerHTML = textDiv.innerHTML.replace(
            pattern,
            `${roleUpper} (${actorName})`
          )
        } catch (e) {
          // Fallback: skip problematic patterns
        }
      }
    }

    div.appendChild(textDiv)
    return div
  }

  /**
   * Render the complete script
   * @param {Array} data - Script data
   * @param {Object} settings - Render settings
   * @param {Array} actors - All actors array
   * @param {Function} onLineClick - Click handler for lines
   */
  renderScript(data, settings, actors, onLineClick) {
    const container = document.getElementById('script-container')
    container.innerHTML = ''

    const toc = this.createToC(data, settings.selectedActor)
    container.appendChild(toc)

    let currentScene = ''
    let sceneData = []

    // First pass: determine which lines should be visible or context
    const lineStates = this.calculateLineStates(data, settings)

    // Second pass: render lines
    data.forEach((row, index) => {
      const state = lineStates.get(index)

      // Check for new scene
      const isNewScene = row.Szene !== currentScene

      if (isNewScene) {
        const a = document.createElement('a')
        a.name = `scene-${row.Szene}`
        container.appendChild(a)
        const szeneTitel = document.createElement('h2')
        szeneTitel.textContent = `Szene ${row.Szene}`
        container.appendChild(szeneTitel)

        // Insert scene summary (Kategorie: Szenenbeginn)
        const sceneStartRow = data.find(
          (r) => r.Szene === row.Szene && r.Kategorie === CATEGORIES.SCENE_START
        )
        if (sceneStartRow && sceneStartRow['Text/Anweisung']) {
          const summary = document.createElement('div')
          summary.className = 'scene-summary'
          summary.textContent = sceneStartRow['Text/Anweisung']
          container.appendChild(summary)
        }
        const separator = document.createElement('div')
        separator.className = 'scene-separator'
        container.appendChild(separator)

        if (settings.showSceneOverview) {
          for (let i = index; i < data.length; i++) {
            if (data[i].Szene === row.Szene) {
              sceneData.push(data[i])
            } else {
              break
            }
          }
          if (sceneData.length > 0) {
            container.appendChild(
              this.createSceneOverview(
                sceneData,
                settings.selectedActor,
                actors,
                settings.useActorNames
              )
            )
          }
          sceneData = []
        }
        currentScene = row.Szene
      }

      const lineElement = this.createScriptLine(
        row,
        state,
        settings,
        actors,
        onLineClick
      )
      container.appendChild(lineElement)
    })
  }
}
