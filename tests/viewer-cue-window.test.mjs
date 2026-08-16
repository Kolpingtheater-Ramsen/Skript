import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}

const cueSource = await readFile(
  new URL('../static/js/cue-window.js', import.meta.url),
  'utf8'
)
const cueUrl = moduleUrl(cueSource)
const cueWindow = await import(cueUrl)

const profileSource = await readFile(
  new URL('../static/js/viewer-profile.js', import.meta.url),
  'utf8'
)
const viewerProfile = await import(
  moduleUrl(profileSource.replace("'./cue-window.js'", `'${cueUrl}'`))
)

const rows = [
  row('scene-1', 0, '1', 'Szenenbeginn', 'Eröffnung im großen Saal'),
  row('actor-1', 1, '1', 'Schauspieler', 'Willkommen!', { Charakter: 'ALICE' }),
  row('tech-1', 2, '1', 'Technik', 'Podest nach links schieben'),
  row('light-1', 3, '1', 'Licht', 'Lichtstimmung Abend'),
  row('props-1', 4, '1', 'Requisiten', 'Kelch bereitstellen'),
  row('auto-mic-1', 5, '1', 'Mikrofon', 'ALICE (1)', {
    isAutoMic: true,
    micCueType: 'EIN',
  }),
  row('manual-mic-1', 6, '1', 'Mikrofon', 'Reservekanal öffnen'),
  row('scene-2', 7, '2', 'Szenenbeginn', 'Umbau zum Garten'),
  row('tech-2', 8, '2', 'Technik', 'Gartenbank herein'),
]

function row(cueId, cueOrdinal, Szene, Kategorie, text, extra = {}) {
  return {
    cueId,
    cueOrdinal,
    Szene,
    Kategorie,
    'Text/Anweisung': text,
    Charakter: '',
    Mikrofon: '',
    ...extra,
  }
}

test('selects the last matching cue at-or-before the cursor and two forecasts', () => {
  const resolved = cueWindow.resolveCueCursor(
    rows,
    { cueId: 'light-1', ordinal: 3, scriptRevision: 'rev-1' },
    'rev-1'
  )
  const result = cueWindow.buildCueWindow(
    rows,
    ['technik', 'requisiten'],
    resolved.cursor
  )

  assert.equal(result.current.cueId, 'tech-1')
  assert.equal(result.previous, null)
  assert.equal(result.next.cueId, 'props-1')
  assert.equal(result.next2.cueId, 'tech-2')
})

test('advancing across another matching cue shifts all four slots deterministically', () => {
  const result = cueWindow.buildCueWindow(
    rows,
    ['technik', 'requisiten'],
    { ordinal: 4, rowIndex: 4 }
  )

  assert.equal(result.previous.cueId, 'tech-1')
  assert.equal(result.current.cueId, 'props-1')
  assert.equal(result.next.cueId, 'tech-2')
  assert.equal(result.next2, null)
})

test('without a marker the first two matching cues are forecasts', () => {
  const result = cueWindow.buildCueWindow(rows, ['technik'], null)

  assert.equal(result.status, 'waiting')
  assert.equal(result.previous, null)
  assert.equal(result.current, null)
  assert.equal(result.next.cueId, 'tech-1')
  assert.equal(result.next2.cueId, 'tech-2')
})

test('scene starts enrich cues without consuming a cue slot', () => {
  const result = cueWindow.buildCueWindow(rows, ['technik'], { ordinal: 2, rowIndex: 2 })

  assert.equal(result.eligibleCount, 2)
  assert.equal(result.current.sceneSummary, 'Eröffnung im großen Saal')
  assert.equal(result.next.sceneSummary, 'Umbau zum Garten')
})

test('manual and generated microphone cues can be filtered independently', () => {
  const auto = cueWindow.buildCueWindow(rows, ['mikrofon-auto'], null)
  const manual = cueWindow.buildCueWindow(rows, ['mikrofon-manuell'], null)

  assert.equal(auto.next.cueId, 'auto-mic-1')
  assert.equal(auto.eligibleCount, 1)
  assert.equal(manual.next.cueId, 'manual-mic-1')
  assert.equal(manual.eligibleCount, 1)
})

test('v2 cursor resolution prefers cueId and rejects a mismatched revision', () => {
  const ok = cueWindow.resolveCueCursor(
    rows,
    {
      protocolVersion: 2,
      cueId: 'props-1',
      ordinal: 999,
      scriptRevision: 'same',
      sequence: 12,
    },
    'same'
  )
  const mismatch = cueWindow.resolveCueCursor(
    rows,
    { cueId: 'props-1', scriptRevision: 'old' },
    'new'
  )

  assert.equal(ok.status, 'ok')
  assert.equal(ok.cursor.ordinal, 4)
  assert.equal(ok.cursor.sequence, 12)
  assert.equal(mismatch.status, 'mismatch')
})

test('unknown cue identity falls back only to a same-revision ordinal', () => {
  const sameRevisionFallback = cueWindow.resolveCueCursor(
    rows,
    { cueId: 'missing', ordinal: 2, scriptRevision: 'same' },
    'same'
  )
  const unverifiedCue = cueWindow.resolveCueCursor(
    rows,
    { cueId: 'missing', ordinal: 2 },
    'same'
  )
  const unknownOrdinal = cueWindow.resolveCueCursor(
    rows,
    { ordinal: 999, scriptRevision: 'same' },
    'same'
  )
  const unverifiedOrdinal = cueWindow.resolveCueCursor(
    rows,
    { ordinal: 2 },
    'same'
  )

  assert.equal(sameRevisionFallback.status, 'ok')
  assert.equal(sameRevisionFallback.cursor.cueId, 'tech-1')
  assert.equal(sameRevisionFallback.cursor.ordinal, 2)
  assert.equal(unverifiedCue.status, 'invalid')
  assert.equal(unverifiedCue.reason, 'unknown-cue')
  assert.equal(unknownOrdinal.status, 'invalid')
  assert.equal(unknownOrdinal.reason, 'unknown-ordinal')
  assert.equal(unverifiedOrdinal.status, 'invalid')
  assert.equal(unverifiedOrdinal.reason, 'unverified-ordinal')
})

test('sequence ordering rejects stale events before cursor content is considered', () => {
  const newerMismatch = cueWindow.advanceCursorSequence(10, {
    sequence: 12,
    scriptRevision: 'other',
  })
  const staleOtherwiseValid = cueWindow.advanceCursorSequence(
    newerMismatch.lastSequence,
    { sequence: 11, cueId: 'tech-1' }
  )
  const malformed = cueWindow.advanceCursorSequence(12, {
    sequence: 12.5,
    cueId: 'tech-1',
  })

  assert.equal(newerMismatch.accept, true)
  assert.equal(newerMismatch.lastSequence, 12)
  assert.equal(staleOtherwiseValid.accept, false)
  assert.equal(staleOtherwiseValid.reason, 'stale-sequence')
  assert.equal(malformed.accept, false)
  assert.equal(malformed.reason, 'invalid-sequence')
})

test('defensive metadata aliases and legacy index remain supported', () => {
  const aliasRows = [
    {
      _cueId: 'aliased',
      _ordinal: 42,
      Szene: '1',
      Kategorie: 'Technik',
      'Text/Anweisung': 'Test',
    },
  ]

  assert.equal(cueWindow.getCueId(aliasRows[0], 0), 'aliased')
  assert.equal(cueWindow.getCueOrdinal(aliasRows[0], 0), 42)
  assert.equal(cueWindow.resolveCueCursor(aliasRows, { index: 0 }, 'rev').status, 'ok')
})

test('stage and classic presets retain their distinct common-case layouts', () => {
  const stage = viewerProfile.profileFromPreset('buehne')
  const classic = viewerProfile.profileFromPreset('klassisch')

  assert.equal(stage.layout, 'timeline')
  assert.deepEqual(stage.filters, ['technik', 'requisiten'])
  assert.equal(classic.layout, 'script')
  assert.deepEqual(classic.filters, [...cueWindow.CUE_FILTERS])
})

test('normalization never persists a timeline profile without a category', () => {
  const normalized = viewerProfile.normalizeViewerProfile({
    presetId: 'custom',
    layout: 'timeline',
    filters: [],
  })

  assert.deepEqual(normalized.filters, ['technik'])
})

test('viewer profiles are stored independently by play and display', () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  const store = new viewerProfile.ViewerProfileStore(storage)
  store.save('play-a', 'left', viewerProfile.profileFromPreset('licht'))
  store.save('play-a', 'right', viewerProfile.profileFromPreset('ton'))

  assert.equal(store.load('play-a', 'left').presetId, 'licht')
  assert.equal(store.load('play-a', 'right').presetId, 'ton')
  assert.equal(store.load('play-b', 'left'), null)
})
