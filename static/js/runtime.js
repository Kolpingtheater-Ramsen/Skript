/**
 * Runtime helpers for static-first deployments.
 */

export function isStaticRuntime() {
  return window.location.protocol === 'file:' || !window.location.origin.startsWith('http')
}

export function appBasePath() {
  const marker = '/templates/'
  const path = window.location.pathname
  if (path.includes(marker)) {
    return path.slice(0, path.indexOf(marker) + 1)
  }
  return '/'
}

export function assetUrl(path) {
  const cleanPath = path.replace(/^\/+/, '')
  if (window.location.protocol === 'file:') {
    return `../${cleanPath}`
  }
  return `${appBasePath()}${cleanPath}`.replace(/\/{2,}/g, '/')
}

export async function fetchFirst(urls, options) {
  let lastError = null
  for (const url of urls) {
    try {
      const response = await fetch(url, options)
      if (response.ok) {
        return response
      }
      lastError = new Error(`Failed to fetch ${url}: ${response.status}`)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('No fetch candidates supplied')
}
