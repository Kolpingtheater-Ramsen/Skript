/**
 * Lightweight script data status and validation helpers for settings.
 */

import { CATEGORIES } from './config.js'

const REQUIRED_COLUMNS = ['Szene', 'Kategorie', 'Charakter', 'Mikrofon', 'Text/Anweisung']
const KNOWN_CATEGORIES = new Set(Object.values(CATEGORIES))

function hasText(value) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

function rowLabel(row, index) {
  const scene = hasText(row.Szene) ? `Szene ${row.Szene}` : 'ohne Szene'
  return `${scene}, Zeile ${index + 1}`
}

function addWarning(warnings, message, maxWarnings) {
  if (warnings.length < maxWarnings) warnings.push(message)
}

export function validateScriptData(rawData = [], normalizedData = [], maxWarnings = 12) {
  const warnings = []
  const rows = Array.isArray(rawData) ? rawData : []
  const headers = rows.length ? Object.keys(rows[0]) : []

  REQUIRED_COLUMNS.forEach((column) => {
    if (!headers.includes(column)) {
      addWarning(warnings, `Spalte fehlt: ${column}`, maxWarnings)
    }
  })

  rows.forEach((row, index) => {
    const category = (row.Kategorie || '').trim()
    const text = row['Text/Anweisung']
    const character = row.Charakter
    const scene = row.Szene
    const mic = row.Mikrofon

    if (!category && Object.values(row).some(hasText)) {
      addWarning(warnings, `${rowLabel(row, index)}: Kategorie fehlt`, maxWarnings)
      return
    }

    if (category && !KNOWN_CATEGORIES.has(category)) {
      addWarning(warnings, `${rowLabel(row, index)}: unbekannte Kategorie „${category}“`, maxWarnings)
    }

    if (category !== CATEGORIES.ROLE && category !== CATEGORIES.SCENE_START && !hasText(scene)) {
      addWarning(warnings, `${rowLabel(row, index)}: Szenennummer fehlt`, maxWarnings)
    }

    if (category === CATEGORIES.ACTOR && !hasText(character)) {
      addWarning(warnings, `${rowLabel(row, index)}: Schauspieler-Zeile ohne Rolle`, maxWarnings)
    }

    if ([CATEGORIES.ACTOR, CATEGORIES.INSTRUCTION, CATEGORIES.TECHNICAL, CATEGORIES.LIGHTING, CATEGORIES.AUDIO, CATEGORIES.PROPS, CATEGORIES.MICROPHONE].includes(category) && !hasText(text)) {
      addWarning(warnings, `${rowLabel(row, index)}: Text/Anweisung fehlt`, maxWarnings)
    }

    if (hasText(mic) && !/^\d+(?:\.\d+)?(?:\s*[,/]\s*\d+(?:\.\d+)?)*$/.test(String(mic).trim())) {
      addWarning(warnings, `${rowLabel(row, index)}: ungewöhnlicher Mikrofonwert „${mic}“`, maxWarnings)
    }
  })

  const roleCounts = new Map()
  rows
    .filter((row) => row.Kategorie === CATEGORIES.ROLE && hasText(row.Charakter))
    .forEach((row) => {
      const role = String(row.Charakter).trim().toUpperCase()
      roleCounts.set(role, (roleCounts.get(role) || 0) + 1)
    })
  roleCounts.forEach((count, role) => {
    if (count > 1) addWarning(warnings, `Rolle mehrfach in Besetzung: ${role} (${count}×)`, maxWarnings)
  })

  const sceneCount = new Set(normalizedData.filter((row) => hasText(row.Szene)).map((row) => row.Szene)).size
  const generatedMicCueCount = normalizedData.filter((row) => row.isAutoMic).length

  return {
    warnings,
    warningCount: warnings.length,
    truncated: warnings.length >= maxWarnings,
    stats: {
      rows: rows.length,
      renderedRows: normalizedData.length,
      scenes: sceneCount,
      generatedMicCueCount,
    },
  }
}

export function cacheStatusFor(playId) {
  const lastFetch = localStorage.getItem(`scriptLastFetch:${playId}`)
  const cachedData = localStorage.getItem(`scriptData:${playId}`)
  const timestamp = lastFetch ? parseInt(lastFetch, 10) : null
  return {
    hasCachedData: Boolean(cachedData),
    lastFetch: timestamp,
    online: navigator.onLine,
  }
}

export function renderSettingsDiagnostics(playId, validation) {
  const cache = cacheStatusFor(playId)
  const dataState = document.getElementById('data-cache-status')
  const validationState = document.getElementById('sheet-validation-status')

  if (dataState) {
    const fetched = cache.lastFetch
      ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(cache.lastFetch))
      : 'noch nie'
    dataState.innerHTML = `
      <div><strong>Status:</strong> ${cache.online ? 'online' : 'offline'} · ${cache.hasCachedData ? 'Cache vorhanden' : 'kein Cache'}</div>
      <div><strong>Datenstand:</strong> ${fetched}</div>
      <div><strong>Zeilen:</strong> ${validation.stats.rows} Quelle · ${validation.stats.renderedRows} gerendert · ${validation.stats.generatedMicCueCount} Auto-Mikrofon-Cues</div>
    `
  }

  if (validationState) {
    if (!validation.warnings.length) {
      validationState.innerHTML = '<div class="validation-ok">Keine offensichtlichen Sheet-Probleme gefunden.</div>'
      return
    }
    validationState.innerHTML = `
      <div class="validation-warning-title">${validation.warningCount}${validation.truncated ? '+' : ''} Warnung(en)</div>
      <ul>${validation.warnings.map((warning) => `<li>${warning}</li>`).join('')}</ul>
    `
  }
}
