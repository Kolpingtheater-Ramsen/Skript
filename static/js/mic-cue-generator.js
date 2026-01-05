/**
 * Automatic microphone cue generator
 * Injects virtual mic ON/OFF rows based on actor presence in stage directions
 */

import { escapeRegExp } from './utils.js'
import { CATEGORIES } from './config.js'

/**
 * Check if text mentions an actor name using word boundary matching
 * @param {string} text - Text to search in
 * @param {string} actorName - Actor name to find (uppercase)
 * @returns {boolean} True if actor is mentioned
 */
function textMentionsActor(text, actorName) {
  if (!text || !actorName) return false
  try {
    const pattern = new RegExp(`\\b${escapeRegExp(actorName)}\\b`, 'i')
    return pattern.test(text)
  } catch (e) {
    // Fallback to simple includes if regex fails
    return text.toUpperCase().includes(actorName)
  }
}

/**
 * Get scene boundaries (start and end indices) for each scene
 * @param {Array} data - Normalized script data
 * @returns {Map<string, {start: number, end: number}>} Map of scene to boundaries
 */
function getSceneBoundaries(data) {
  const boundaries = new Map()
  let currentScene = null
  let sceneStart = 0

  data.forEach((row, index) => {
    if (row.Szene && row.Szene !== currentScene) {
      // Close previous scene
      if (currentScene !== null) {
        boundaries.set(currentScene, { start: sceneStart, end: index - 1 })
      }
      // Start new scene
      currentScene = row.Szene
      sceneStart = index
    }
  })

  // Close last scene
  if (currentScene !== null) {
    boundaries.set(currentScene, { start: sceneStart, end: data.length - 1 })
  }

  return boundaries
}

/**
 * Get actors who speak in a scene and their line indices
 * @param {Array} data - Script data
 * @param {number} sceneStart - Scene start index
 * @param {number} sceneEnd - Scene end index
 * @returns {Map<string, {firstLine: number, lastLine: number, mic: string}>} Actor info
 */
function getSpeakingActorsInScene(data, sceneStart, sceneEnd) {
  const actors = new Map()

  for (let i = sceneStart; i <= sceneEnd; i++) {
    const row = data[i]
    if (row.Kategorie === CATEGORIES.ACTOR && row.Charakter) {
      const actor = row.Charakter.toUpperCase()
      if (!actors.has(actor)) {
        actors.set(actor, {
          firstLine: i,
          lastLine: i,
          mic: row.Mikrofon || '',
        })
      } else {
        actors.get(actor).lastLine = i
        // Update mic if we find one
        if (row.Mikrofon && !actors.get(actor).mic) {
          actors.get(actor).mic = row.Mikrofon
        }
      }
    }
  }

  return actors
}

/**
 * Find entrance Anweisung for an actor before their first line
 * @param {Array} data - Script data
 * @param {number} sceneStart - Scene start index
 * @param {number} firstLine - Actor's first spoken line index
 * @param {string} actorName - Actor name to search for
 * @returns {number|null} Index of entrance Anweisung or null
 */
function findEntranceAnweisung(data, sceneStart, firstLine, actorName) {
  // Scan backwards from first line to scene start
  for (let i = firstLine - 1; i >= sceneStart; i--) {
    const row = data[i]
    if (
      row.Kategorie === CATEGORIES.INSTRUCTION &&
      textMentionsActor(row['Text/Anweisung'], actorName)
    ) {
      return i
    }
  }
  return null
}

/**
 * Find exit Anweisung for an actor after their last line
 * @param {Array} data - Script data
 * @param {number} lastLine - Actor's last spoken line index
 * @param {number} sceneEnd - Scene end index
 * @param {string} actorName - Actor name to search for
 * @returns {number|null} Index of exit Anweisung or null
 */
function findExitAnweisung(data, lastLine, sceneEnd, actorName) {
  // Scan forwards from last line to scene end
  for (let i = lastLine + 1; i <= sceneEnd; i++) {
    const row = data[i]
    if (
      row.Kategorie === CATEGORIES.INSTRUCTION &&
      textMentionsActor(row['Text/Anweisung'], actorName)
    ) {
      return i
    }
  }
  return null
}

/**
 * Create a virtual mic cue row
 * @param {string} scene - Scene number
 * @param {Array<{name: string, mic: string}>} actors - Actors for this cue
 * @param {string} type - 'EIN' or 'AUS'
 * @returns {Object} Virtual row object
 */
function createMicCueRow(scene, actors, type) {
  // Format: "HANS (1), GRETA (3) EIN" or "HANS, GRETA EIN" if no mic
  const actorTexts = actors.map((a) => (a.mic ? `${a.name} (${a.mic})` : a.name))
  const text = `${actorTexts.join(', ')} ${type}`

  return {
    Szene: scene,
    Kategorie: CATEGORIES.MICROPHONE,
    Charakter: '',
    Mikrofon: '',
    'Text/Anweisung': text,
    isAutoMic: true,
  }
}

/**
 * Generate automatic mic cues for all scenes
 * @param {Array} data - Normalized script data
 * @returns {Array} Data with injected virtual mic cue rows
 */
export function generateSceneMicCues(data) {
  if (!data || data.length === 0) return data

  const sceneBoundaries = getSceneBoundaries(data)
  const insertions = new Map() // Map of insertIndex -> {onActors: [], offActors: []}

  // Process each scene
  for (const [scene, { start, end }] of sceneBoundaries) {
    const speakingActors = getSpeakingActorsInScene(data, start, end)

    for (const [actorName, info] of speakingActors) {
      // Find entrance cue position
      const entranceAnweisung = findEntranceAnweisung(
        data,
        start,
        info.firstLine,
        actorName
      )
      // Insert after the Anweisung, or at scene start (after scene header row)
      const onInsertIdx =
        entranceAnweisung !== null ? entranceAnweisung + 1 : start + 1

      // Find exit cue position
      const exitAnweisung = findExitAnweisung(
        data,
        info.lastLine,
        end,
        actorName
      )
      // Insert after the Anweisung, or at scene end
      const offInsertIdx = exitAnweisung !== null ? exitAnweisung + 1 : end + 1

      // Group by insertion index
      if (!insertions.has(onInsertIdx)) {
        insertions.set(onInsertIdx, { scene, onActors: [], offActors: [] })
      }
      insertions.get(onInsertIdx).onActors.push({
        name: actorName,
        mic: info.mic,
      })

      if (!insertions.has(offInsertIdx)) {
        insertions.set(offInsertIdx, { scene, onActors: [], offActors: [] })
      }
      insertions.get(offInsertIdx).offActors.push({
        name: actorName,
        mic: info.mic,
      })
    }
  }

  // Sort insertion indices in descending order to avoid index shifting issues
  const sortedIndices = Array.from(insertions.keys()).sort((a, b) => b - a)

  // Create result array and insert virtual rows
  const result = [...data]

  for (const idx of sortedIndices) {
    const { scene, onActors, offActors } = insertions.get(idx)
    const rowsToInsert = []

    // Create OFF cues first (they appear before ON cues at same position)
    if (offActors.length > 0) {
      rowsToInsert.push(createMicCueRow(scene, offActors, 'AUS'))
    }

    // Create ON cues
    if (onActors.length > 0) {
      rowsToInsert.push(createMicCueRow(scene, onActors, 'EIN'))
    }

    // Insert at position
    result.splice(idx, 0, ...rowsToInsert)
  }

  return result
}
