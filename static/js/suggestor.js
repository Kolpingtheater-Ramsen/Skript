/**
 * Role suggester - Shows which scenes can be rehearsed based on present actors
 */

import { loadPlaysConfig, loadScript, collectScenes } from './api.js'
import { getUrlParams, getEl, createElement } from './utils.js'
import { STORAGE_KEYS } from './config.js'

const ACTOR_CATEGORY = 'Schauspieler'
const IGNORE_ROLES = new Set(['OFFTEXT', 'ALLE', 'LIED', '[LIED]', 'CHOR'])

class RoleSuggestor {
  constructor() {
    this.scriptData = []
    this.actors = new Set()
    this.presentActors = new Set()
    this.characterMap = new Map()
    this.actorStats = new Map()
    this.sceneStats = new Map()
    this.playId = null
    this.sheetUrl = null
    this.searchTerm = ''
    this.showPlayableOnly = false
    this.sortMode = 'best'
  }

  async init() {
    const urlParams = getUrlParams()
    const storedPlayId = localStorage.getItem(STORAGE_KEYS.PLAY_ID) || 'default'
    this.playId = urlParams.get('play') || storedPlayId

    if (urlParams.get('play')) {
      localStorage.setItem(STORAGE_KEYS.PLAY_ID, this.playId)
    }

    const playsConfig = await loadPlaysConfig()
    this.sheetUrl = playsConfig?.[this.playId]?.sheet || playsConfig?.default?.sheet

    await this.loadCharacterMap()
    this.scriptData = await loadScript(this.sheetUrl, this.playId)
    this.buildStats()

    this.actors.forEach((actor) => this.presentActors.add(actor))
    this.loadPresentActorsFromStorage()

    this.populateActorList()
    this.setupControls()
    this.updateSuggestions()
  }

  normalizeActor(raw) {
    return String(raw || '').replace(/\(.*\)/, '').trim().toUpperCase()
  }

  getScene(row) {
    return String(row.Szene || row.Scene || '').trim()
  }

  getText(row) {
    return String(row['Text/Anweisung'] || row.Text || '').trim()
  }

  wordCount(text) {
    return text.split(/\s+/).filter(Boolean).length
  }

  isActorLine(row) {
    const actor = this.normalizeActor(row.Charakter)
    const scene = this.getScene(row)
    return row.Kategorie === ACTOR_CATEGORY && actor && scene && scene !== '0' && !IGNORE_ROLES.has(actor)
  }

  buildStats() {
    this.actors.clear()
    this.actorStats.clear()
    this.sceneStats.clear()

    this.scriptData.forEach((row, index) => {
      const scene = this.getScene(row)
      if (scene && scene !== '0' && !this.sceneStats.has(scene)) {
        this.sceneStats.set(scene, {
          scene,
          order: this.sceneStats.size + 1,
          words: 0,
          lines: 0,
          actors: new Set(),
          actorWords: new Map(),
        })
      }

      if (!this.isActorLine(row)) return

      const actor = this.normalizeActor(row.Charakter)
      const text = this.getText(row)
      const words = this.wordCount(text)
      const stats = this.actorStats.get(actor) || {
        actor,
        words: 0,
        lines: 0,
        scenes: new Set(),
      }
      stats.words += words
      stats.lines += 1
      stats.scenes.add(scene)
      this.actorStats.set(actor, stats)
      this.actors.add(actor)

      const sceneInfo = this.sceneStats.get(scene)
      sceneInfo.words += words
      sceneInfo.lines += 1
      sceneInfo.actors.add(actor)
      sceneInfo.actorWords.set(actor, (sceneInfo.actorWords.get(actor) || 0) + words)
    })
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
            this.normalizeActor(row.Charakter),
            row.Schauspieler.trim()
          )
        }
      })
    } catch (error) {
      console.warn('Character map not available:', error)
    }
  }

  loadPresentActorsFromStorage() {
    const key = `${STORAGE_KEYS.PRESENT_ACTORS}:${this.playId}`
    const legacy = localStorage.getItem(STORAGE_KEYS.PRESENT_ACTORS)
    const saved = localStorage.getItem(key) || legacy
    if (!saved) return

    try {
      const parsedActors = JSON.parse(saved)
      this.presentActors = new Set(
        parsedActors.map((actor) => this.normalizeActor(actor)).filter((actor) => this.actors.has(actor))
      )
    } catch (error) {
      console.error('Failed to load present actors:', error)
    }
  }

  savePresentActorsToStorage() {
    localStorage.setItem(
      `${STORAGE_KEYS.PRESENT_ACTORS}:${this.playId}`,
      JSON.stringify([...this.presentActors])
    )
  }

  setupControls() {
    const toggleBtn = getEl('toggle-all-btn')
    if (toggleBtn) toggleBtn.addEventListener('click', () => this.toggleAllActors())

    const search = getEl('actor-search')
    if (search) {
      search.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase().trim()
        this.populateActorList()
      })
    }

    const playable = getEl('playable-only')
    if (playable) {
      playable.addEventListener('change', (e) => {
        this.showPlayableOnly = e.target.checked
        this.updateSuggestions()
      })
    }

    const sort = getEl('sort-scenes')
    if (sort) {
      sort.addEventListener('change', (e) => {
        this.sortMode = e.target.value
        this.updateSuggestions()
      })
    }
  }

  toggleAllActors() {
    const allSelected = this.presentActors.size === this.actors.size

    if (allSelected) {
      this.presentActors.clear()
    } else {
      this.actors.forEach((actor) => this.presentActors.add(actor))
    }

    this.savePresentActorsToStorage()
    this.populateActorList()
    this.updateToggleButtonText()
    this.updateSuggestions()
  }

  updateToggleButtonText() {
    const btn = getEl('toggle-all-btn')
    if (btn) {
      const allSelected = this.presentActors.size === this.actors.size
      btn.textContent = allSelected ? '☐ Alle abwählen' : '☑ Alle auswählen'
    }
  }

  getActorName(character) {
    const actor = this.characterMap.get(this.normalizeActor(character))
    return actor ? actor : ''
  }

  getActorLabel(actor) {
    const performer = this.getActorName(actor)
    return performer ? `${actor} · ${performer}` : actor
  }

  populateActorList() {
    const container = getEl('actor-list')
    if (!container) return

    container.innerHTML = ''
    const sortedActors = [...this.actors]
      .filter((actor) => !this.searchTerm || this.getActorLabel(actor).toLowerCase().includes(this.searchTerm))
      .sort((a, b) => a.localeCompare(b, 'de'))

    sortedActors.forEach((actor) => {
      const stats = this.actorStats.get(actor) || { words: 0, scenes: new Set() }
      const label = createElement('label', {
        className: `actor-item ${this.presentActors.has(actor) ? 'selected' : ''}`,
      })

      const checkbox = createElement('input', {
        type: 'checkbox',
        value: actor,
        onchange: (e) => {
          if (e.target.checked) this.presentActors.add(actor)
          else this.presentActors.delete(actor)
          this.savePresentActorsToStorage()
          this.populateActorList()
          this.updateToggleButtonText()
          this.updateSuggestions()
        },
      })
      checkbox.checked = this.presentActors.has(actor)

      const text = createElement('span', { className: 'actor-copy' })
      text.innerHTML = `<strong>${actor}</strong><small>${this.getActorName(actor) || '–'} · ${stats.scenes.size} Szenen · ${stats.words} Wörter</small>`

      label.appendChild(checkbox)
      label.appendChild(text)
      container.appendChild(label)
    })

    const count = getEl('actor-filter-count')
    if (count) count.textContent = `${sortedActors.length} Rollen angezeigt`
    this.updateToggleButtonText()
  }

  getSceneActors(scene) {
    return this.sceneStats.get(scene)?.actors || new Set()
  }

  getSceneData(scene) {
    const sceneActors = this.getSceneActors(scene)
    const presentActors = [...sceneActors].filter((actor) => this.presentActors.has(actor))
    const missingActors = [...sceneActors].filter((actor) => !this.presentActors.has(actor))
    const percentage = sceneActors.size ? Math.round((presentActors.length / sceneActors.size) * 100) : 100
    const sceneInfo = this.sceneStats.get(scene)
    const missingWords = missingActors.reduce((sum, actor) => sum + (sceneInfo.actorWords.get(actor) || 0), 0)

    return {
      scene,
      order: sceneInfo?.order || 9999,
      sceneActors,
      presentActors,
      missingActors,
      percentage,
      isPlayable: missingActors.length === 0,
      words: sceneInfo?.words || 0,
      lines: sceneInfo?.lines || 0,
      missingWords,
    }
  }

  updateSuggestions() {
    const container = getEl('suggestions')
    if (!container) return

    container.innerHTML = ''

    const presentCount = getEl('present-count')
    if (presentCount) presentCount.textContent = this.presentActors.size

    const totalActors = getEl('total-actors')
    if (totalActors) totalActors.textContent = this.actors.size

    const scenes = collectScenes(this.scriptData).filter((scene) => scene && scene !== '0')
    let sceneArray = scenes.map((scene) => this.getSceneData(scene))

    const playableScenes = sceneArray.filter((scene) => scene.isPlayable).length
    if (this.showPlayableOnly) sceneArray = sceneArray.filter((scene) => scene.isPlayable)

    if (this.sortMode === 'script') {
      sceneArray.sort((a, b) => a.order - b.order)
    } else if (this.sortMode === 'words') {
      sceneArray.sort((a, b) => b.words - a.words || a.order - b.order)
    } else {
      sceneArray.sort((a, b) => b.percentage - a.percentage || a.missingActors.length - b.missingActors.length || b.words - a.words)
    }

    const totalScenes = getEl('total-scenes')
    const playableScenesEl = getEl('playable-scenes')
    const hiddenScenesEl = getEl('hidden-scenes')
    if (totalScenes) totalScenes.textContent = scenes.length
    if (playableScenesEl) playableScenesEl.textContent = playableScenes
    if (hiddenScenesEl) hiddenScenesEl.textContent = this.showPlayableOnly ? `${scenes.length - sceneArray.length} ausgeblendet` : ''

    if (sceneArray.length === 0) {
      container.innerHTML = '<div class="empty-state">Keine Szenen passen zu dieser Auswahl.</div>'
      return
    }

    sceneArray.forEach((sceneData) => this.renderSceneCard(container, sceneData))
  }

  renderSceneCard(container, data) {
    const { scene, sceneActors, percentage, isPlayable, presentActors, missingActors, words, lines, missingWords } = data
    const div = createElement('div', { className: `scene-card ${isPlayable ? 'playable' : 'not-playable'}` })

    const header = createElement('div', { className: 'scene-card-header' })
    const titleWrap = createElement('div')
    titleWrap.innerHTML = `<div class="scene-card-title">Szene ${scene}</div><div class="scene-card-summary">${words} Wörter · ${lines} Einsätze · ${sceneActors.size} Rollen</div>`
    const status = createElement('div', { className: 'scene-card-status' }, isPlayable ? '✅ spielbar' : `${percentage}% · ${missingActors.length} fehlen`)
    header.appendChild(titleWrap)
    header.appendChild(status)
    div.appendChild(header)

    const body = createElement('div', { className: 'scene-card-body' })
    const progress = createElement('div', { className: 'scene-progress' })
    progress.innerHTML = `<span style="width:${percentage}%"></span>`
    body.appendChild(progress)

    if (!isPlayable) {
      const missing = createElement('div', { className: 'missing-summary' }, `Fehlende Textlast: ${missingWords} Wörter`)
      body.appendChild(missing)
    }

    const availableBlock = createElement('div', { className: 'role-block' })
    availableBlock.innerHTML = `<h4>Anwesend (${presentActors.length})</h4>`
    const availableGrid = createElement('div', { className: 'roles-grid' })
    presentActors.forEach((actor) => availableGrid.appendChild(this.createRoleTag(actor, true)))
    availableBlock.appendChild(availableGrid)
    body.appendChild(availableBlock)

    if (missingActors.length) {
      const missingBlock = createElement('div', { className: 'role-block' })
      missingBlock.innerHTML = `<h4>Fehlt (${missingActors.length})</h4>`
      const missingGrid = createElement('div', { className: 'roles-grid' })
      missingActors.forEach((actor) => missingGrid.appendChild(this.createRoleTag(actor, false)))
      missingBlock.appendChild(missingGrid)
      body.appendChild(missingBlock)
    }

    div.appendChild(body)
    container.appendChild(div)
  }

  createRoleTag(actor, available) {
    const stats = this.actorStats.get(actor)
    const tag = createElement('span', { className: `role-tag ${available ? 'available' : 'missing'}` })
    tag.innerHTML = `<span class="role-name">${actor}</span><span class="role-actor">${this.getActorName(actor) || '–'} · ${stats?.words || 0} W</span>`
    return tag
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const suggestor = new RoleSuggestor()
    suggestor.init().catch(console.error)
  })
} else {
  const suggestor = new RoleSuggestor()
  suggestor.init().catch(console.error)
}
