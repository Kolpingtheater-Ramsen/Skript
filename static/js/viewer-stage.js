/**
 * Configurable stage viewer with a legacy script layout and a four-cue window.
 */

import { BaseViewer } from './viewer-shared.js?v=20260816-cue-window'
import { smoothScrollToElement, getEl } from './utils.js'
import {
  buildCueWindow,
  getCueId,
  getCueOrdinal,
  rowMatchesCueFilters,
} from './cue-window.js'
import {
  VIEWER_PRESETS,
  VIEWER_PRESET_ORDER,
  ViewerProfileStore,
  normalizeViewerProfile,
  profileFromPreset,
} from './viewer-profile.js'

const FILTER_LABELS = Object.freeze({
  schauspieler: 'Schauspieler',
  anweisung: 'Anweisung',
  technik: 'Technik',
  licht: 'Licht',
  einspieler: 'Einspieler',
  requisiten: 'Requisiten',
  'mikrofon-manuell': 'Mikrofon',
  'mikrofon-auto': 'Mikrofon automatisch',
})

const CATEGORY_LABELS = Object.freeze({
  Schauspieler: '🎭 Schauspieler',
  Anweisung: '📝 Anweisung',
  Technik: '🛠️ Technik',
  Licht: '💡 Licht',
  Einspieler: '🔊 Einspieler',
  Requisiten: '📦 Requisiten',
  Mikrofon: '🎤 Mikrofon',
})

function appendActorText(container, text) {
  const source = String(text || '')
  const parenRegex = /\([^()]*\)/g
  let cursor = 0
  for (const match of source.matchAll(parenRegex)) {
    if (match.index > cursor) {
      container.appendChild(document.createTextNode(source.slice(cursor, match.index)))
    }
    const span = document.createElement('span')
    span.className = 'inline-stage-direction'
    span.textContent = match[0]
    container.appendChild(span)
    cursor = match.index + match[0].length
  }
  if (cursor < source.length) {
    container.appendChild(document.createTextNode(source.slice(cursor)))
  }
}

export class StageViewer extends BaseViewer {
  constructor() {
    super()
    this.profileStore = new ViewerProfileStore()
    this.profile = null
    this.profileLoaded = false
    this.needsPresetChoice = false
    this.controlsReady = false
    this.markedLine = null
    this.lineByCueId = new Map()
    this.lastWindow = null
    this.cursorProblem = null
    this.profileNotice = ''
    this.profileNoticeTimer = null
    this.scrollHandler = () => this.onScroll()
  }

  render() {
    this.ensureProfile()
    this.setupControls()
    this.syncControlsFromProfile()
    this.renderActiveLayout()
    this.updateProgress()
    if (this.needsPresetChoice) this.openPresetChooser()
  }

  ensureProfile() {
    if (this.profileLoaded) return
    this.profileLoaded = true

    const requestedPreset = new URLSearchParams(window.location.search).get('preset')
    const storedProfile = this.profileStore.load(this.playId, this.displayId)

    if (requestedPreset) {
      this.profile = profileFromPreset(requestedPreset, storedProfile)
      if (this.profile) {
        this.profileStore.save(this.playId, this.displayId, this.profile)
        this.needsPresetChoice = requestedPreset === 'custom' && !storedProfile
      } else {
        this.profile = profileFromPreset('gesamttechnik')
        this.needsPresetChoice = true
      }
    } else if (storedProfile) {
      this.profile = storedProfile
    } else {
      this.profile = profileFromPreset('gesamttechnik')
      this.needsPresetChoice = true
    }
  }

  setupControls() {
    if (this.controlsReady) return
    this.controlsReady = true

    getEl('settings-open')?.addEventListener('click', () => this.openSettings())
    getEl('settings-close')?.addEventListener('click', () => this.closeSettings())
    getEl('settings-done')?.addEventListener('click', () => this.closeSettings())
    getEl('settings-backdrop')?.addEventListener('click', () => this.closeSettings())

    getEl('preset-select')?.addEventListener('change', (event) => {
      const presetId = event.target.value
      const next = profileFromPreset(presetId, this.profile)
      if (next) this.applyProfile(next)
    })

    document.querySelectorAll('input[name="viewer-layout"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked) return
        this.applyProfile({
          ...this.profile,
          presetId: 'custom',
          layout: input.value,
        })
      })
    })

    document.querySelectorAll('[data-viewer-filter]').forEach((input) => {
      input.addEventListener('change', () => {
        const selectedFilters = this.readSelectedFilters()
        if (this.profile.layout === 'timeline' && selectedFilters.length === 0) {
          input.checked = true
          this.showProfileNotice(
            `Mindestens eine Kategorie muss aktiv bleiben. ${FILTER_LABELS[input.dataset.viewerFilter] || 'Diese Kategorie'} bleibt ausgewählt.`
          )
          return
        }
        this.applyProfile({
          ...this.profile,
          presetId: 'custom',
          filters: selectedFilters,
        })
      })
    })

    getEl('show-scene-summary')?.addEventListener('change', (event) => {
      this.applyProfile({
        ...this.profile,
        presetId: 'custom',
        showSceneSummary: event.target.checked,
      })
    })

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return
      this.closeSettings()
    })
    window.addEventListener('scroll', this.scrollHandler, { passive: true })

    this.renderPresetChoices()
    const scopeLabel = getEl('display-scope-label')
    if (scopeLabel) scopeLabel.textContent = `Display: ${this.displayId}`
  }

  renderPresetChoices() {
    const container = getEl('preset-choices')
    if (!container) return
    container.innerHTML = ''

    for (const presetId of VIEWER_PRESET_ORDER) {
      const isCustom = presetId === 'custom'
      const preset = VIEWER_PRESETS[presetId]
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'preset-choice'

      const title = document.createElement('strong')
      title.textContent = isCustom ? 'Benutzerdefiniert' : preset.label
      const description = document.createElement('span')
      description.textContent = isCustom
        ? 'Eigene Kategorien und Darstellung auswählen'
        : preset.description
      button.append(title, description)

      button.addEventListener('click', () => {
        const next = profileFromPreset(presetId, this.profile)
        if (!next) return
        this.needsPresetChoice = false
        this.applyProfile(next)
        this.closePresetChooser()
        if (isCustom) this.openSettings()
      })
      container.appendChild(button)
    }
  }

  readSelectedFilters() {
    return Array.from(document.querySelectorAll('[data-viewer-filter]:checked'))
      .map((input) => input.dataset.viewerFilter)
      .filter(Boolean)
  }

  applyProfile(value) {
    const attemptedEmptyTimeline =
      value?.layout !== 'script' &&
      Array.isArray(value?.filters) &&
      value.filters.length === 0
    const normalized = normalizeViewerProfile(value)
    if (!normalized) return
    this.profile = normalized
    this.profileStore.save(this.playId, this.displayId, normalized)
    this.syncControlsFromProfile()
    this.renderActiveLayout()
    if (attemptedEmptyTimeline) {
      this.showProfileNotice(
        'Die Vier-Cue-Ansicht braucht mindestens eine Kategorie. Technik wurde aktiviert.'
      )
    }
  }

  showProfileNotice(text) {
    this.profileNotice = text
    if (this.profileNoticeTimer) window.clearTimeout(this.profileNoticeTimer)
    this.updateViewerMessage()
    this.profileNoticeTimer = window.setTimeout(() => {
      this.profileNotice = ''
      this.profileNoticeTimer = null
      this.updateViewerMessage()
    }, 4500)
  }

  syncControlsFromProfile() {
    if (!this.profile) return
    const presetSelect = getEl('preset-select')
    if (presetSelect) presetSelect.value = this.profile.presetId

    document.querySelectorAll('input[name="viewer-layout"]').forEach((input) => {
      input.checked = input.value === this.profile.layout
    })
    document.querySelectorAll('[data-viewer-filter]').forEach((input) => {
      input.checked = this.profile.filters.includes(input.dataset.viewerFilter)
    })

    const summary = getEl('show-scene-summary')
    if (summary) summary.checked = this.profile.showSceneSummary

    const label = getEl('active-profile-label')
    if (label) {
      const preset = VIEWER_PRESETS[this.profile.presetId]
      label.textContent = preset?.label || 'Benutzerdefiniert'
    }
  }

  openSettings() {
    const panel = getEl('viewer-settings')
    const backdrop = getEl('settings-backdrop')
    if (!panel || !backdrop) return
    backdrop.hidden = false
    panel.classList.add('open')
    panel.setAttribute('aria-hidden', 'false')
    getEl('settings-open')?.setAttribute('aria-expanded', 'true')
    document.body.classList.add('settings-open')
    getEl('preset-select')?.focus()
  }

  closeSettings() {
    const panel = getEl('viewer-settings')
    const backdrop = getEl('settings-backdrop')
    if (!panel || !backdrop) return
    panel.classList.remove('open')
    panel.setAttribute('aria-hidden', 'true')
    backdrop.hidden = true
    getEl('settings-open')?.setAttribute('aria-expanded', 'false')
    document.body.classList.remove('settings-open')
  }

  openPresetChooser() {
    const chooser = getEl('preset-chooser')
    if (chooser) chooser.hidden = false
  }

  closePresetChooser() {
    const chooser = getEl('preset-chooser')
    if (chooser) chooser.hidden = true
  }

  renderActiveLayout({ scrollToMarker = false } = {}) {
    if (!this.profile) return
    const timeline = getEl('timeline-layout')
    const script = getEl('script-layout')
    const isTimeline = this.profile.layout === 'timeline'
    if (timeline) timeline.hidden = !isTimeline
    if (script) script.hidden = isTimeline
    document.body.dataset.viewerLayout = this.profile.layout

    if (isTimeline) {
      this.renderTimeline()
    } else {
      this.renderScript()
      this.applyMarkerToScript(scrollToMarker)
    }
    this.updateViewerMessage()
  }

  getCueWindow() {
    this.lastWindow = buildCueWindow(
      this.scriptData,
      this.profile?.filters || [],
      this.currentMarkerCursor
    )
    return this.lastWindow
  }

  renderTimeline() {
    const windowState = this.getCueWindow()
    const sceneLabel = getEl('timeline-scene-label')
    const sceneSummary = getEl('timeline-scene-summary')

    if (sceneLabel) {
      sceneLabel.textContent = windowState.activeScene
        ? `Szene ${windowState.activeScene}`
        : 'Noch keine Szene'
    }
    if (sceneSummary) {
      const showSummary =
        this.profile.showSceneSummary && windowState.activeSceneSummary
      sceneSummary.textContent = showSummary
        ? windowState.activeSceneSummary
        : windowState.status === 'waiting'
          ? 'Warte auf den Director-Marker.'
          : 'Keine Szenenzusammenfassung hinterlegt.'
      sceneSummary.hidden = !this.profile.showSceneSummary
    }

    this.renderCueCard(
      getEl('cue-previous'),
      windowState.previous,
      'Vergangen',
      'Keine frühere passende Anweisung'
    )
    this.renderCueCard(
      getEl('cue-current'),
      windowState.current,
      'Aktuell / zuletzt',
      'Noch keine passende Anweisung passiert'
    )
    this.renderCueCard(
      getEl('cue-next'),
      windowState.next,
      'Als Nächstes',
      'Keine weitere passende Anweisung'
    )
    this.renderCueCard(
      getEl('cue-next2'),
      windowState.next2,
      'Danach',
      'Keine weitere Vorschau'
    )
  }

  renderCueCard(element, cue, slotLabel, emptyText) {
    if (!element) return
    element.innerHTML = ''
    element.classList.toggle('cue-card-empty', !cue)
    element.removeAttribute('data-category')

    const header = document.createElement('header')
    header.className = 'cue-card-header'
    const slot = document.createElement('span')
    slot.className = 'cue-slot-label'
    slot.textContent = slotLabel
    header.appendChild(slot)

    if (!cue) {
      const empty = document.createElement('p')
      empty.className = 'cue-empty-text'
      empty.textContent = emptyText
      element.append(header, empty)
      return
    }

    element.dataset.category = cue.category.toLowerCase()
    const scene = document.createElement('span')
    scene.className = 'cue-scene-label'
    scene.textContent = cue.scene ? `Szene ${cue.scene}` : 'Ohne Szene'
    header.appendChild(scene)

    const category = document.createElement('div')
    category.className = 'cue-category'
    category.textContent = this.getCueCategoryLabel(cue)

    const text = document.createElement('div')
    text.className = 'cue-text'
    if (cue.category === 'Schauspieler') {
      appendActorText(text, cue.text)
    } else {
      text.textContent = cue.text
    }

    element.append(header, category)
    if (cue.character) {
      const character = document.createElement('div')
      character.className = 'cue-character'
      character.textContent = this.getCharacterLabel(cue.character, cue.microphone)
      element.appendChild(character)
    }
    element.appendChild(text)

    if (this.profile.showSceneSummary && cue.sceneSummary) {
      const summary = document.createElement('p')
      summary.className = 'cue-scene-summary'
      summary.textContent = cue.sceneSummary
      element.appendChild(summary)
    }
  }

  getCueCategoryLabel(cue) {
    if (cue.category === 'Mikrofon' && cue.isAutoMic && cue.micCueType) {
      return `🎤 Mikrofon ${cue.micCueType}`
    }
    return CATEGORY_LABELS[cue.category] || cue.category || 'Cue'
  }

  getCharacterLabel(character, microphone = '') {
    const actor = this.actors.find(
      ([role]) => String(role).toUpperCase() === String(character).toUpperCase()
    )?.[1]
    const actorSuffix = actor ? ` (${actor})` : ''
    const micSuffix = microphone ? ` · 🎤 ${microphone}` : ''
    return `${character}${actorSuffix}${micSuffix}`
  }

  renderScript() {
    const container = getEl('script-container')
    if (!container) return
    container.innerHTML = ''
    this.lineByCueId.clear()
    this.markedLine = null

    let currentScene = null
    let visibleCount = 0
    const selectedFilters = new Set(this.profile.filters)

    this.scriptData.forEach((row, index) => {
      const scene = String(row?.Szene ?? '').trim()
      if (!scene || scene === '0' || !rowMatchesCueFilters(row, selectedFilters)) return
      const text = String(row?.['Text/Anweisung'] ?? row?.Text ?? '').trim()
      if (!text) return

      if (scene !== currentScene) {
        this.appendSceneHeading(container, scene)
        currentScene = scene
      }

      const line = this.createScriptLine(row, index)
      container.appendChild(line)
      this.lineByCueId.set(getCueId(row, index), line)
      visibleCount += 1
    })

    if (visibleCount === 0) {
      const empty = document.createElement('div')
      empty.className = 'script-empty-state'
      empty.textContent = 'Für diese Auswahl gibt es keine Skriptzeilen.'
      container.appendChild(empty)
    }

    const windowState = this.getCueWindow()
    const scene = this.getSceneFromMarker() || windowState.activeScene || this.scenesOrder[0]
    if (scene) this.updateSceneInfo(scene)
  }

  appendSceneHeading(container, scene) {
    const anchor = document.createElement('a')
    anchor.id = `scene-${scene}`
    anchor.className = 'scene-anchor'
    container.appendChild(anchor)

    const title = document.createElement('h2')
    title.className = 'scene-title'
    title.textContent = `🎬 Szene ${scene}`
    container.appendChild(title)

    const summary = this.getSceneSummary(scene)
    if (this.profile.showSceneSummary && summary) {
      const summaryElement = document.createElement('p')
      summaryElement.className = 'script-scene-summary'
      summaryElement.textContent = summary
      container.appendChild(summaryElement)
    }
  }

  createScriptLine(row, index) {
    const line = document.createElement('article')
    line.className = 'script-line'
    line.dataset.scene = String(row.Szene || '')
    line.dataset.cueId = getCueId(row, index)
    line.dataset.ordinal = String(getCueOrdinal(row, index))
    this.applyLineStyle(line, row)

    if (row.Charakter) {
      const name = document.createElement('div')
      name.className = 'actor-name'
      name.textContent = this.getCharacterLabel(row.Charakter, row.Mikrofon)
      line.appendChild(name)
    }

    const text = document.createElement('div')
    text.className = 'script-line-text'
    if (row.Kategorie === 'Schauspieler') {
      appendActorText(text, row['Text/Anweisung'] || row.Text)
    } else {
      text.textContent = row['Text/Anweisung'] || row.Text || ''
    }
    line.appendChild(text)
    return line
  }

  applyLineStyle(element, row) {
    const styleByCategory = {
      Anweisung: 'instruction',
      Technik: 'technical',
      Licht: 'lighting',
      Einspieler: 'audio',
      Requisiten: 'props',
      Mikrofon: 'microphone',
    }
    const className = styleByCategory[row.Kategorie]
    if (className) element.classList.add(className)

    if (CATEGORY_LABELS[row.Kategorie]) {
      const tag = document.createElement('div')
      tag.className = 'tag'
      tag.textContent = row.Kategorie === 'Mikrofon' && row.isAutoMic && row.micCueType
        ? `🎤 Mikrofon ${row.micCueType}`
        : CATEGORY_LABELS[row.Kategorie]
      element.appendChild(tag)
    }
  }

  applyMarkerToScript(scrollToMarker = false) {
    if (this.markedLine) this.markedLine.classList.remove('marked-line')
    this.markedLine = null

    const windowState = this.lastWindow || this.getCueWindow()
    if (!windowState.current) return
    const line = this.lineByCueId.get(windowState.current.cueId)
    if (!line) return
    this.markedLine = line
    line.classList.add('marked-line')
    if (scrollToMarker) smoothScrollToElement(line, 25)
  }

  onMarkerUpdate() {
    this.cursorProblem = null
    this.renderActiveLayout({ scrollToMarker: true })
  }

  onMarkerClear() {
    this.cursorProblem = null
    this.renderActiveLayout()
  }

  onConnectionStateChange() {
    this.updateViewerMessage()
  }

  onCursorMismatch() {
    this.cursorProblem = 'mismatch'
    this.updateViewerMessage()
  }

  onCursorInvalid() {
    this.cursorProblem = 'invalid'
    this.updateViewerMessage()
  }

  onLoadError() {
    this.updateViewerMessage()
  }

  updateViewerMessage() {
    const message = getEl('viewer-message')
    if (!message || !this.profile) return
    const windowState = this.lastWindow || this.getCueWindow()
    let tone = ''
    let text = ''

    if (this.loadError || this.scriptData.length === 0) {
      tone = 'error'
      text = 'Das Skript konnte nicht geladen werden. Bitte Verbindung und Stückauswahl prüfen.'
    } else if (this.cursorProblem === 'mismatch') {
      tone = 'error'
      text = 'Skriptstand stimmt nicht mit dem Director überein. Der letzte gültige Stand bleibt sichtbar – bitte neu laden.'
    } else if (this.cursorProblem === 'invalid') {
      tone = 'warning'
      text = 'Die Director-Position konnte nicht zugeordnet werden. Der letzte gültige Stand bleibt sichtbar.'
    } else if (this.profileNotice) {
      tone = 'warning'
      text = this.profileNotice
    } else if (this.connectionState === 'offline') {
      tone = 'warning'
      text = 'Offline – der letzte empfangene Stand bleibt sichtbar.'
    } else if (windowState.status === 'empty') {
      tone = 'empty'
      text = 'Für die gewählten Kategorien gibt es keine Anweisungen. Öffne die Ansichtseinstellungen, um Filter zu ändern.'
    } else if (windowState.status === 'waiting') {
      tone = 'waiting'
      text = 'Warte auf den Director-Marker. Die ersten passenden Anweisungen stehen bereits in der Vorschau.'
    }

    message.hidden = !text
    message.className = `viewer-message${tone ? ` viewer-message-${tone}` : ''}`
    message.textContent = text
  }

  onScroll() {
    if (this.profile?.layout !== 'script' || this.currentMarkerCursor) return
    const currentScene = this.getCurrentSceneFromScroll()
    if (currentScene) this.updateSceneInfo(currentScene)
  }

  getCurrentSceneFromScroll() {
    const viewportMiddle = window.scrollY + window.innerHeight / 2
    const lines = document.querySelectorAll('#script-container .script-line')
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

  updateSceneInfo(currentScene) {
    this.autoScrollManager.stopAll()
    const sidebar = document.querySelector('.scene-info-sidebar')
    if (!sidebar) return
    sidebar.innerHTML = ''

    const current = this.createSceneInfoBox('🎬 Aktuelle Szene', currentScene)
    current.classList.add('active')
    sidebar.appendChild(current)

    const nextScene = this.getNextScene(currentScene)
    if (nextScene) {
      const next = this.createSceneInfoBox('⏭️ Nächste Szene', nextScene)
      next.classList.add('next')
      sidebar.appendChild(next)
    }

    window.setTimeout(() => {
      sidebar.querySelectorAll('.actor-list').forEach((list) => {
        this.autoScrollManager.start(list)
      })
    }, 100)
  }

  createSceneInfoBox(title, sceneNumber) {
    const box = document.createElement('section')
    box.className = 'scene-info-box'
    const heading = document.createElement('h3')
    heading.textContent = `${title} ${sceneNumber}`
    box.appendChild(heading)

    if (this.profile.showSceneSummary) {
      const summaryText = this.getSceneSummary(sceneNumber)
      if (summaryText) {
        const summary = document.createElement('p')
        summary.className = 'scene-info-summary'
        summary.textContent = summaryText
        box.appendChild(summary)
      }
    }

    const actors = Array.from(this.getSceneActors(sceneNumber).entries()).sort((a, b) => {
      const left = Number.parseInt(a[1], 10)
      const right = Number.parseInt(b[1], 10)
      const leftOrder = Number.isFinite(left) ? left : Number.POSITIVE_INFINITY
      const rightOrder = Number.isFinite(right) ? right : Number.POSITIVE_INFINITY
      return leftOrder - rightOrder || a[0].localeCompare(b[0], 'de')
    })

    const list = document.createElement('ul')
    list.className = 'actor-list'
    if (actors.length > 8) list.classList.add('very-small')
    else if (actors.length > 6) list.classList.add('small')

    actors.forEach(([role, microphone]) => {
      const item = document.createElement('li')
      const name = document.createElement('span')
      name.textContent = this.getCharacterLabel(role)
      item.appendChild(name)
      if (microphone) {
        const mic = document.createElement('span')
        mic.className = 'actor-micro'
        mic.textContent = `🎤 ${microphone}`
        item.appendChild(mic)
      }
      list.appendChild(item)
    })
    box.appendChild(list)
    return box
  }
}

function startViewer() {
  const viewer = new StageViewer()
  window.stageViewer = viewer
  viewer.init().catch((error) => {
    console.error('Bühnen-Viewer konnte nicht gestartet werden:', error)
    const message = getEl('viewer-message')
    if (message) {
      message.hidden = false
      message.className = 'viewer-message viewer-message-error'
      message.textContent = 'Der Bühnen-Viewer konnte nicht gestartet werden.'
    }
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startViewer, { once: true })
} else {
  startViewer()
}
