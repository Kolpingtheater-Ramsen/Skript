import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}

const source = await readFile(
  new URL('../static/js/navigation.js', import.meta.url),
  'utf8'
)
const utilsUrl = moduleUrl(
  'export function smoothScrollToElement(element) { globalThis.scrolledTo = element }'
)
const { NavigationManager } = await import(
  moduleUrl(source.replace("'./utils.js'", `'${utilsUrl}'`))
)

function line(name, { top, display = 'block', visibility = 'visible', hidden = false, rects = 1 } = {}) {
  const classes = new Set()
  return {
    name,
    hidden,
    computedStyle: { display, visibility },
    classList: {
      add(value) { classes.add(value) },
      remove(value) { classes.delete(value) },
    },
    addEventListener() {},
    getBoundingClientRect() { return { top } },
    getClientRects() { return { length: rects } },
  }
}

function installDom(lines) {
  const info = { textContent: '' }
  const previous = { disabled: false }
  const next = { disabled: false }
  const bottomNav = { style: {} }
  const actorSelect = { value: 'ALICE' }
  const ids = {
    'current-line-info': info,
    'bottom-nav-previous': previous,
    'bottom-nav-next': next,
    'actor-select': actorSelect,
  }

  globalThis.window = {
    innerHeight: 1000,
    getComputedStyle(element) { return element.computedStyle },
  }
  globalThis.document = {
    body: { classList: { add() {}, remove() {} } },
    getElementById(id) { return ids[id] ?? null },
    querySelector(selector) {
      if (selector === '.bottom-nav') return bottomNav
      return null
    },
    querySelectorAll(selector) {
      if (selector === '.script-line.highlighted') return lines
      if (selector === '.flash-highlight') return []
      return []
    },
  }
  return { info, previous, next }
}

test('bottom navigation counts and targets only rendered highlighted lines', () => {
  const visibleFirst = line('first', { top: 200 })
  const displayNone = line('display-none', { top: 300, display: 'none', rects: 0 })
  const noBoxes = line('no-boxes', { top: 350, rects: 0 })
  const hidden = line('hidden', { top: 400, hidden: true })
  const visibilityHidden = line('visibility-hidden', { top: 450, visibility: 'hidden' })
  const visibleSecond = line('second', { top: 700 })
  const dom = installDom([
    visibleFirst,
    displayNone,
    noBoxes,
    hidden,
    visibilityHidden,
    visibleSecond,
  ])
  const manager = new NavigationManager({})

  manager.updateBottomNav()
  assert.equal(dom.info.textContent, 'Text 1 von 2')
  assert.equal(dom.previous.disabled, true)
  assert.equal(dom.next.disabled, false)

  globalThis.scrolledTo = null
  manager.jumpToNextLine()
  assert.equal(globalThis.scrolledTo, visibleSecond)
  manager.updateBottomNav()
  assert.equal(dom.info.textContent, 'Text 2 von 2')
  assert.equal(dom.previous.disabled, false)
  assert.equal(dom.next.disabled, true)

  // Previous must use the intended target even while smooth scrolling is active.
  manager.jumpToPreviousLine()
  assert.equal(globalThis.scrolledTo, visibleFirst)
  manager.updateBottomNav()
  assert.equal(dom.info.textContent, 'Text 1 von 2')
  assert.equal(dom.previous.disabled, true)
})

test('bottom navigation has a sensible empty state', () => {
  const dom = installDom([])
  const manager = new NavigationManager({})

  manager.updateBottomNav()

  assert.equal(dom.info.textContent, 'Keine Texte')
  assert.equal(dom.previous.disabled, true)
  assert.equal(dom.next.disabled, true)
})
