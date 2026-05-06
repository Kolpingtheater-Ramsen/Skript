/**
 * Script loading pipeline.
 *
 * Owns the sequence from play config + raw sheet rows to the normalized
 * render model consumed by the app. This keeps main.js from knowing the
 * ordering details between data-manager, validation, and derived actors.
 */

import { dataManager } from './data-manager.js'
import { validateScriptData } from './sheet-validation.js'

export async function loadScriptModel(playId) {
  await dataManager.loadPlaysConfig()

  const playsConfig = dataManager.getPlaysConfig()
  const rawData = await dataManager.loadScript(playId)
  const actors = dataManager.getActors(rawData)
  const data = dataManager.normalizeData(rawData)
  const validation = validateScriptData(rawData, data)

  return {
    playId,
    playsConfig,
    rawData,
    data,
    actors,
    validation,
  }
}
