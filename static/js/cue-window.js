/**
 * Pure cue-window derivation for the configurable stage viewer.
 *
 * This module deliberately has no DOM, storage, or Socket.IO dependencies so
 * its ordering rules can be exercised directly with node:test.
 */

export const CUE_FILTERS = Object.freeze([
  'schauspieler',
  'anweisung',
  'technik',
  'licht',
  'einspieler',
  'requisiten',
  'mikrofon-manuell',
  'mikrofon-auto',
])

const FILTER_BY_CATEGORY = Object.freeze({
  Schauspieler: 'schauspieler',
  Anweisung: 'anweisung',
  Technik: 'technik',
  Licht: 'licht',
  Einspieler: 'einspieler',
  Requisiten: 'requisiten',
})

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function safeNonnegativeInteger(value) {
  const number = finiteNumber(value)
  return number !== null && Number.isSafeInteger(number) && number >= 0
    ? number
    : null
}

export function getCueId(row, fallbackIndex = 0) {
  const explicit = row?.cueId ?? row?._cueId
  if (explicit !== null && explicit !== undefined && String(explicit).trim()) {
    return String(explicit)
  }
  return `legacy:${fallbackIndex}`
}

export function getCueOrdinal(row, fallbackIndex = 0) {
  return (
    finiteNumber(row?.cueOrdinal) ??
    finiteNumber(row?.ordinal) ??
    finiteNumber(row?._ordinal) ??
    fallbackIndex
  )
}

export function cueFilterForRow(row) {
  if (!row) return null
  if (row.Kategorie === 'Mikrofon') {
    return row.isAutoMic ? 'mikrofon-auto' : 'mikrofon-manuell'
  }
  return FILTER_BY_CATEGORY[row.Kategorie] || null
}

export function rowMatchesCueFilters(row, filters) {
  const filter = cueFilterForRow(row)
  if (!filter) return false
  const selected = filters instanceof Set ? filters : new Set(filters || [])
  return selected.has(filter)
}

export function collectSceneSummaries(rows) {
  const summaries = new Map()
  for (const row of rows || []) {
    const scene = String(row?.Szene ?? '').trim()
    const text = String(row?.['Text/Anweisung'] ?? row?.Text ?? '').trim()
    if (scene && row?.Kategorie === 'Szenenbeginn' && text) {
      summaries.set(scene, text)
    }
  }
  return summaries
}

/**
 * Defensive revision for older script models. The canonical loader should
 * provide scriptRevision; this hash only keeps legacy clients internally
 * consistent and is not intended as a cross-client protocol revision.
 */
export function deriveLocalScriptRevision(rows) {
  let hash = 2166136261
  for (const row of rows || []) {
    const value = [
      row?.Szene,
      row?.Kategorie,
      row?.Charakter,
      row?.Mikrofon,
      row?.['Text/Anweisung'] ?? row?.Text,
      row?.isAutoMic ? 'auto' : '',
      row?.micCueType,
    ].join('\u001f')
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
  }
  return `local-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function cursorData(payload) {
  if (!payload || typeof payload !== 'object') return null
  return payload.cursor && typeof payload.cursor === 'object'
    ? { ...payload, ...payload.cursor }
    : payload
}

/**
 * Validate transport ordering before resolving any cursor content. Newer
 * invalid/mismatched events still advance the watermark, preventing an older
 * otherwise-valid event from reviving stale state afterwards.
 */
export function advanceCursorSequence(lastSequence, payload) {
  const cursor = cursorData(payload)
  const hasSequence =
    cursor && Object.prototype.hasOwnProperty.call(cursor, 'sequence')
  if (!hasSequence || cursor.sequence === null || cursor.sequence === undefined) {
    return {
      accept: true,
      sequence: null,
      lastSequence,
      reason: 'legacy-unsequenced',
    }
  }

  const sequence = safeNonnegativeInteger(cursor.sequence)
  if (sequence === null) {
    return {
      accept: false,
      sequence: null,
      lastSequence,
      reason: 'invalid-sequence',
    }
  }
  if (
    Number.isSafeInteger(lastSequence) &&
    sequence <= lastSequence
  ) {
    return {
      accept: false,
      sequence,
      lastSequence,
      reason: 'stale-sequence',
    }
  }
  return {
    accept: true,
    sequence,
    lastSequence: sequence,
    reason: 'new-sequence',
  }
}

/**
 * Resolve a transport cursor onto the canonical viewer timeline.
 * cueId is primary, ordinal is the v2 fallback, and index is legacy-only.
 */
export function resolveCueCursor(rows, payload, scriptRevision) {
  const cursor = cursorData(payload)
  if (!cursor) return { status: 'waiting', cursor: null }

  const incomingRevision = cursor.scriptRevision ?? cursor.revision ?? null
  const sameRevision = Boolean(
    incomingRevision &&
    scriptRevision &&
    String(incomingRevision) === String(scriptRevision)
  )
  if (
    incomingRevision &&
    scriptRevision &&
    String(incomingRevision) !== String(scriptRevision)
  ) {
    return {
      status: 'mismatch',
      reason: 'script-revision',
      expectedRevision: scriptRevision,
      receivedRevision: String(incomingRevision),
      cursor: null,
    }
  }

  const cueIdValue = cursor.cueId ?? cursor._cueId
  const cueId = cueIdValue === null || cueIdValue === undefined
    ? null
    : String(cueIdValue)
  let rowIndex = cueId
    ? (rows || []).findIndex((row, index) => getCueId(row, index) === cueId)
    : -1

  if (rowIndex >= 0) {
    return {
      status: 'ok',
      cursor: {
        cueId,
        ordinal: getCueOrdinal(rows[rowIndex], rowIndex),
        rowIndex,
        sequence: safeNonnegativeInteger(cursor.sequence),
        legacy: false,
      },
    }
  }

  if (cueId && !sameRevision) {
    return {
      status: 'invalid',
      reason: 'unknown-cue',
      cursor: null,
    }
  }

  const ordinal =
    finiteNumber(cursor.ordinal) ??
    finiteNumber(cursor.cueOrdinal) ??
    finiteNumber(cursor._ordinal)

  if (ordinal !== null) {
    if (!sameRevision) {
      return {
        status: 'invalid',
        reason: 'unverified-ordinal',
        cursor: null,
      }
    }
    rowIndex = (rows || []).findIndex(
      (row, index) => getCueOrdinal(row, index) === ordinal
    )
    if (rowIndex < 0) {
      return {
        status: 'invalid',
        reason: 'unknown-ordinal',
        cursor: null,
      }
    }
    return {
      status: 'ok',
      cursor: {
        cueId: getCueId(rows[rowIndex], rowIndex),
        ordinal,
        rowIndex,
        sequence: safeNonnegativeInteger(cursor.sequence),
        legacy: true,
      },
    }
  }

  const legacyIndex = finiteNumber(cursor.index)
  if (
    legacyIndex !== null &&
    Number.isInteger(legacyIndex) &&
    legacyIndex >= 0 &&
    legacyIndex < (rows || []).length
  ) {
    return {
      status: 'ok',
      cursor: {
        cueId: getCueId(rows[legacyIndex], legacyIndex),
        ordinal: getCueOrdinal(rows[legacyIndex], legacyIndex),
        rowIndex: legacyIndex,
        sequence: safeNonnegativeInteger(cursor.sequence),
        legacy: true,
      },
    }
  }

  return {
    status: 'invalid',
    reason: cueId ? 'unknown-cue' : 'missing-position',
    cursor: null,
  }
}

function cueFromRow(row, rowIndex, sceneSummaries) {
  const scene = String(row?.Szene ?? '').trim()
  return {
    cueId: getCueId(row, rowIndex),
    ordinal: getCueOrdinal(row, rowIndex),
    rowIndex,
    scene,
    sceneSummary: sceneSummaries.get(scene) || '',
    category: String(row?.Kategorie ?? '').trim(),
    character: String(row?.Charakter ?? '').trim(),
    microphone: String(row?.Mikrofon ?? '').trim(),
    text: String(row?.['Text/Anweisung'] ?? row?.Text ?? '').trim(),
    isAutoMic: Boolean(row?.isAutoMic),
    micCueType: String(row?.micCueType ?? '').trim(),
    row,
  }
}

/**
 * Produce the fixed previous/current/next/next2 operational window.
 */
export function buildCueWindow(rows, filters, resolvedCursor = null) {
  const selected = filters instanceof Set ? filters : new Set(filters || [])
  const sceneSummaries = collectSceneSummaries(rows)
  const eligible = []

  ;(rows || []).forEach((row, rowIndex) => {
    const text = String(row?.['Text/Anweisung'] ?? row?.Text ?? '').trim()
    if (!text || !rowMatchesCueFilters(row, selected)) return
    eligible.push(cueFromRow(row, rowIndex, sceneSummaries))
  })

  eligible.sort((left, right) =>
    left.ordinal - right.ordinal || left.rowIndex - right.rowIndex
  )

  const cursorOrdinal = finiteNumber(resolvedCursor?.ordinal)
  let currentIndex = -1
  if (cursorOrdinal !== null) {
    let low = 0
    let high = eligible.length - 1
    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      if (eligible[middle].ordinal <= cursorOrdinal) {
        currentIndex = middle
        low = middle + 1
      } else {
        high = middle - 1
      }
    }
  }

  const markerRow = Number.isInteger(resolvedCursor?.rowIndex)
    ? rows?.[resolvedCursor.rowIndex]
    : null
  const activeCue = currentIndex >= 0
    ? eligible[currentIndex]
    : eligible[0] || null
  const activeScene = String(markerRow?.Szene ?? activeCue?.scene ?? '').trim()

  return {
    status: eligible.length === 0
      ? 'empty'
      : cursorOrdinal === null
        ? 'waiting'
        : 'ready',
    eligibleCount: eligible.length,
    activeScene,
    activeSceneSummary: sceneSummaries.get(activeScene) || '',
    previous: currentIndex > 0 ? eligible[currentIndex - 1] : null,
    current: currentIndex >= 0 ? eligible[currentIndex] : null,
    next: eligible[currentIndex + 1] || null,
    next2: eligible[currentIndex + 2] || null,
  }
}
