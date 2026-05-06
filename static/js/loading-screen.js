/**
 * Initial loading overlay lifecycle.
 */

const LOADING_LINES = [
  'Bühne wird gefegt.',
  'Requisiten werden sortiert.',
  'Souffleuse sucht Seite 1.',
  'Mikros werden wachgeküsst.',
  'Lichtpult sagt kurz Hallo.',
  'Vorhang klemmt noch ein bisschen.',
  'Text wird entknittert.',
]

export class LoadingScreen {
  constructor({ minVisibleMs = 1000, fadeRemoveMs = 520 } = {}) {
    this.minVisibleMs = minVisibleMs
    this.fadeRemoveMs = fadeRemoveMs
    this.startedAt = null
    this.lineTimer = null
  }

  start() {
    this.startedAt = performance.now()
    this.startLines()
  }

  startLines() {
    const loadingLine = document.getElementById('loading-line')
    if (!loadingLine) return

    let index = Math.floor(Math.random() * LOADING_LINES.length)
    loadingLine.textContent = LOADING_LINES[index]
    this.lineTimer = window.setInterval(() => {
      loadingLine.classList.add('changing')
      window.setTimeout(() => {
        index = (index + 1) % LOADING_LINES.length
        loadingLine.textContent = LOADING_LINES[index]
        loadingLine.classList.remove('changing')
      }, 160)
    }, 1400)
  }

  finish() {
    const elapsed = this.startedAt ? performance.now() - this.startedAt : this.minVisibleMs
    const remaining = Math.max(0, this.minVisibleMs - elapsed)
    window.setTimeout(() => this.hideNow(), remaining)
  }

  hideNow() {
    const overlay = document.getElementById('loading-overlay')
    const scriptContainer = document.getElementById('script-container')
    document.body.classList.remove('app-loading')
    document.body.classList.add('app-ready')

    if (this.lineTimer) {
      window.clearInterval(this.lineTimer)
      this.lineTimer = null
    }

    if (scriptContainer) scriptContainer.setAttribute('aria-busy', 'false')
    if (overlay) {
      overlay.classList.add('hidden')
      window.setTimeout(() => overlay.remove(), this.fadeRemoveMs)
    }
  }
}
