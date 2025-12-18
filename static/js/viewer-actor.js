/**
 * Actor viewer (viewer2.html) - Shows current and next scene for actors
 */

import { BaseViewer } from './viewer-shared.js'
import { getEl, createElement } from './utils.js'

export class ActorViewer extends BaseViewer {
  constructor() {
    super()
    this.roleToActor = new Map()
  }

  async init() {
    await super.init()
    
    // Build role to actor mapping
    this.roleToActor = this.buildRoleMapping()
  }

  buildRoleMapping() {
    const map = new Map()
    this.scriptData.forEach((row) => {
      if (row.Szene === '0' && row.Charakter && row['Text/Anweisung']) {
        map.set(row.Charakter, row['Text/Anweisung'])
      }
    })
    return map
  }

  render() {
    this.updateBothPanels()
  }

  onMarkerUpdate(data) {
    this.currentMarkerIndex = data.index
    this.updateBothPanels()
  }

  onMarkerClear() {
    this.currentMarkerIndex = null
    this.updateBothPanels()
  }

  updateBothPanels() {
    const currentScene = this.getSceneFromMarker() || this.scenesOrder[0] || null
    const nextScene = this.getNextScene(currentScene)

    this.renderSceneBox('current-scene-box', '🎬 Szene', currentScene)
    this.renderSceneBox('next-scene-box', '⏭️ Nächste Szene', nextScene)
    this.updateProgress()
  }

  renderSceneBox(containerId, titleText, scene) {
    const box = getEl(containerId)
    if (!box) return

    // Update scene title
    const titleEl = box.querySelector('.scene-title')
    if (titleEl) {
      titleEl.textContent = `${titleText} ${scene || '-'}`
    }

    // Update scene summary
    const summaryEl = box.querySelector('.scene-summary')
    if (summaryEl) {
      summaryEl.textContent = scene ? this.getSceneSummary(scene) || '—' : '—'
    }

    // Update roles list
    const rolesContainer = box.querySelector('.roles-list')
    if (rolesContainer && scene) {
      rolesContainer.innerHTML = ''

      const roles = this.getSceneRoles(scene)

      roles.forEach((role) => {
        const actor = this.roleToActor.get(role) || '?'
        const micro = this.getActorMicro(role, scene)
        
        const roleItem = createElement('div', { className: 'role-item' })
        
        const roleInfo = createElement('div')
        const roleName = createElement('span', { className: 'role-name' }, role)
        const roleActor = createElement('span', { className: 'role-actor' }, ` (${actor})`)
        roleInfo.appendChild(roleName)
        roleInfo.appendChild(roleActor)
        roleItem.appendChild(roleInfo)

        if (micro) {
          const microBadge = createElement('span', { className: 'role-micro' }, `🎤 ${micro}`)
          roleItem.appendChild(microBadge)
        }

        rolesContainer.appendChild(roleItem)
      })

      // Start auto-scroll if needed
      setTimeout(() => {
        this.autoScrollManager.stopAll()
        this.autoScrollManager.start(rolesContainer)
      }, 50)
    }
  }

  getActorMicro(role, scene) {
    const row = this.scriptData.find(
      (r) => r.Szene === scene && r.Charakter === role && r.Mikrofon
    )
    return row ? row.Mikrofon : null
  }

  getSceneRoles(scene) {
    const roles = new Set()

    // Find all roles in the scene
    this.scriptData.forEach((row) => {
      if (row.Szene !== scene) return

      // Check character field
      if (row.Charakter) {
        roles.add(row.Charakter)
      }

      // Check if role is mentioned in instructions
      if (row.Kategorie === 'Anweisung' && row['Text/Anweisung']) {
        this.roleToActor.forEach((_, role) => {
          const regex = new RegExp(`\\b${this.escapeRegExp(role)}\\b`, 'i')
          if (regex.test(row['Text/Anweisung'])) {
            roles.add(role)
          }
        })
      }
    })

    // Return sorted roles
    return Array.from(roles).sort()
  }

  escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

// Initialize when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const viewer = new ActorViewer()
    viewer.init().catch(console.error)
  })
} else {
  const viewer = new ActorViewer()
  viewer.init().catch(console.error)
}
