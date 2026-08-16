/* Privacy-conscious, dependency-free browser error reporting. */
;(() => {
  'use strict'
  if (window.__clientErrorReporterInstalled) return
  window.__clientErrorReporterInstalled = true
  const endpoint = '/api/client-errors'
  const seen = new Map()
  const recentReports = []
  let sending = false
  let swVersion = ''

  function stored(key) { try { return localStorage.getItem(key) || '' } catch (_) { return '' } }
  function clientId() {
    let id = stored('client-error-id')
    if (id) return id
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    try { localStorage.setItem('client-error-id', id) } catch (_) {}
    return id
  }
  function clean(value, max) {
    return String(value || '').replace(/(https?:\/\/[^\s?#]+)[?#][^\s)\]]*/g, '$1')
      .replace(/(password|passwd|token|secret|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]').slice(0, max)
  }
  function context() {
    const params = new URLSearchParams(location.search)
    return {
      pathname: location.pathname, appId: document.documentElement.dataset.appId || 'skript-html',
      playId: clean(params.get('play') || stored('playId'), 64),
      actorRole: clean(stored('actor-select') || stored('director_name'), 128),
      appVersion: clean(document.querySelector('meta[name="app-version"]')?.content || '', 64),
      serviceWorkerVersion: clean(swVersion, 64), clientId: clientId(),
    }
  }
  function report(error) {
    if (sending) return
    const payload = { ...context(), ...error }
    const key = `${payload.type}|${payload.message}|${payload.source}|${payload.line}`
    const now = Date.now()
    if (seen.has(key) && now - seen.get(key) < 60000) return
    while (recentReports.length && recentReports[0] < now - 60000) recentReports.shift()
    if (recentReports.length >= 10) return
    recentReports.push(now)
    seen.set(key, now)
    if (seen.size > 50) seen.delete(seen.keys().next().value)
    const body = JSON.stringify(payload)
    sending = true
    try {
      const sent = navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))
      if (!sent) fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
    } catch (_) {
      try { fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {}) } catch (_) {}
    } finally { sending = false }
  }
  window.addEventListener('error', event => report({
    type: 'error', message: clean(event.message || event.error?.message || 'Unknown error', 1000),
    stack: clean(event.error?.stack, 6000), source: clean(event.filename, 512).split('?')[0],
    line: Number.isInteger(event.lineno) ? event.lineno : null, column: Number.isInteger(event.colno) ? event.colno : null,
  }))
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason
    report({ type: 'unhandledrejection', message: clean(reason?.message || reason || 'Unhandled rejection', 1000), stack: clean(reason?.stack, 6000) })
  })
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'VERSION' || event.data?.type === 'SW_ACTIVATED') swVersion = event.data.version || ''
  })
  try { navigator.serviceWorker?.controller?.postMessage('GET_VERSION') } catch (_) {}
})()
