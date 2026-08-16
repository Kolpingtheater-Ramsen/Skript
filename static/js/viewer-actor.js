/**
 * Actor viewer (viewer2.html) - Shows current and next scene for actors
 */

import { BaseViewer } from './viewer-shared.js'
import { getEl, createElement } from './utils.js'

export class ActorViewer extends BaseViewer {
  constructor() {
    super()
    this.roleToActor = new Map()
    this.cursorProblem = null
  }

  buildRoleMapping() {
    const map = new Map()

    // The canonical loader derives the cast before scene-zero rows are removed
    // from the playback timeline. Prefer that model so the first render already
    // has the correct actor names.
    this.actors.forEach(([role, actor]) => {
      const normalizedRole = this.normalizeRole(role)
      const actorName = String(actor || '').trim()
      if (normalizedRole && actorName) map.set(normalizedRole, actorName)
    })

    // Keep older sheets working when their scene-zero cast rows do not yet use
    // Kategorie "Rolle" and therefore are absent from model.actors.
    this.rawScriptData.forEach((row) => {
      const scene = String(row?.Szene ?? '').trim()
      const role = this.normalizeRole(row?.Charakter)
      const actor = String(row?.['Text/Anweisung'] ?? '').trim()
      if (scene === '0' && role && actor && !map.has(role)) {
        map.set(role, actor)
      }
    })

    return map
  }

  render() {
    this.roleToActor = this.buildRoleMapping()
    this.updateBothPanels()
  }

  onMarkerUpdate() {
    this.cursorProblem = null
    this.restoreConnectionStatus()
    this.updateBothPanels()
  }

  onMarkerClear() {
    this.cursorProblem = null
    this.restoreConnectionStatus()
    this.updateBothPanels()
  }

  onCursorMismatch() {
    this.cursorProblem = 'mismatch'
    this.updateConnectionStatus('⚠️ Nicht synchron')
  }

  onCursorInvalid() {
    this.cursorProblem = 'invalid'
    this.updateConnectionStatus('⚠️ Marker unbekannt')
  }

  onLoadError() {
    this.updateConnectionStatus('❌ Skript nicht verfügbar')
  }

  onConnectionStateChange() {
    this.restoreConnectionStatus()
  }

  restoreConnectionStatus() {
    if (this.loadError) {
      this.updateConnectionStatus('❌ Skript nicht verfügbar')
    } else if (this.cursorProblem === 'mismatch') {
      this.updateConnectionStatus('⚠️ Nicht synchron')
    } else if (this.cursorProblem === 'invalid') {
      this.updateConnectionStatus('⚠️ Marker unbekannt')
    } else {
      this.updateConnectionStatus(
        this.connectionState === 'online' ? '✅ Verbunden' : '⚠️ Offline'
      )
    }
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
    if (rolesContainer) {
      rolesContainer.innerHTML = ''

      if (!scene) {
        this.autoScrollManager.stopAll()
        return
      }

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
      (candidate) =>
        String(candidate?.Szene ?? '').trim() === String(scene) &&
        this.normalizeRole(candidate?.Charakter) === this.normalizeRole(role) &&
        candidate?.Mikrofon
    )
    return row ? row.Mikrofon : null
  }

  getSceneRoles(scene) {
    const roles = new Set()

    // Find all roles in the scene
    this.scriptData.forEach((row) => {
      if (String(row?.Szene ?? '').trim() !== String(scene)) return

      // Check character field
      if (row.Charakter) {
        roles.add(this.normalizeRole(row.Charakter))
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
    return Array.from(roles).filter(Boolean).sort((left, right) =>
      left.localeCompare(right, 'de')
    )
  }

  normalizeRole(value) {
    return String(value || '').trim().toUpperCase()
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
