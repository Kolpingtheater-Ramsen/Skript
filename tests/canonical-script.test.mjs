import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.window = {
  location: {
    origin: 'http://localhost',
    pathname: '/',
    protocol: 'http:',
  },
}

const { DataManager, computeScriptRevision } = await import(
  '../static/js/data-manager.js'
)

const sourceRows = [
  {
    Szene: '1',
    Kategorie: 'Szenenbeginn',
    Charakter: '',
    Mikrofon: '',
    'Text/Anweisung': 'Eröffnung im großen Saal',
  },
  {
    Szene: '1',
    Kategorie: 'Anweisung',
    Charakter: '',
    Mikrofon: '',
    'Text/Anweisung': 'Hans betritt den Saal',
  },
  {
    Szene: '1',
    Kategorie: 'Schauspieler',
    Charakter: 'Hans',
    Mikrofon: '1',
    'Text/Anweisung': 'Guten Abend!',
  },
  {
    Szene: '1',
    Kategorie: 'Anweisung',
    Charakter: '',
    Mikrofon: '',
    'Text/Anweisung': 'Hans verlässt den Saal',
  },
]

test('normalization assigns unique deterministic IDs and canonical ordinals', () => {
  const manager = new DataManager()
  const first = manager.normalizeData(sourceRows)
  const second = manager.normalizeData(sourceRows)

  assert.ok(first.some((row) => row.isAutoMic))
  assert.deepEqual(
    first.map(({ cueId, cueOrdinal }) => ({ cueId, cueOrdinal })),
    second.map(({ cueId, cueOrdinal }) => ({ cueId, cueOrdinal }))
  )
  assert.equal(new Set(first.map((row) => row.cueId)).size, first.length)
  first.forEach((row, index) => {
    assert.equal(row.cueOrdinal, index)
    assert.match(row.cueId, row.isAutoMic ? /^cue-a-/ : /^cue-s-/)
  })

  // Normalization must not leak metadata or uppercase mutations into cached raw rows.
  assert.equal(sourceRows[2].Charakter, 'Hans')
  assert.equal(sourceRows[2].cueId, undefined)
})

test('script revision is stable and changes with canonical content', () => {
  const manager = new DataManager()
  const first = manager.normalizeData(sourceRows)
  const repeated = manager.normalizeData(sourceRows.map((row) => ({ ...row })))
  const changedRows = sourceRows.map((row) => ({ ...row }))
  changedRows[2]['Text/Anweisung'] = 'Guten Abend zusammen!'
  const changed = manager.normalizeData(changedRows)

  assert.equal(computeScriptRevision(first), computeScriptRevision(repeated))
  assert.notEqual(computeScriptRevision(first), computeScriptRevision(changed))

  const unchangedSummary = changed.find(
    (row) => row.Kategorie === 'Szenenbeginn'
  )
  assert.equal(first[0].cueId, unchangedSummary.cueId)
})
