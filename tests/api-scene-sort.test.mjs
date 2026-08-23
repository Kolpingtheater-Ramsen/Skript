import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}

const apiSource = await readFile(new URL('../static/js/api.js', import.meta.url), 'utf8')
const configUrl = moduleUrl(`
  export const CONFIG = { DEFAULT_SHEET_URL: '', CACHE_DURATION: 0 }
  export const STORAGE_KEYS = { SCRIPT_DATA: 'data', SCRIPT_LAST_FETCH: 'time' }
`)
const api = await import(moduleUrl(apiSource.replace("'./config.js'", `'${configUrl}'`)))

test('collectScenes sorts decimal scene numbers numerically', () => {
  const rows = ['11', '2', '10.5', '10', '1', '10.25', '0', ''].map(Szene => ({ Szene }))
  assert.deepEqual(api.collectScenes(rows), ['1', '2', '10', '10.25', '10.5', '11'])
})

test('collectScenes uses natural ordering as a deterministic fallback', () => {
  const rows = ['10b', '10.5', '10a', '10'].map(Szene => ({ Szene }))
  assert.deepEqual(api.collectScenes(rows), ['10', '10.5', '10a', '10b'])
})
