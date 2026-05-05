/**
 * Workbook legend loading/rendering.
 */

import { assetUrl, fetchFirst } from './runtime.js'

const LEGEND_CACHE_MS = 10 * 60 * 1000

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatLegendValue(value) {
  if (value === true) return 'Ja'
  if (value === false) return 'Nein'
  return String(value ?? '')
}

export async function loadLegend(playId) {
  const cacheKey = `scriptLegend:${playId}`
  const cacheTimeKey = `scriptLegendLastFetch:${playId}`
  const cached = localStorage.getItem(cacheKey)
  const lastFetch = localStorage.getItem(cacheTimeKey)
  const cacheAge = lastFetch ? Date.now() - parseInt(lastFetch, 10) : Infinity

  if (cached && cacheAge < LEGEND_CACHE_MS) {
    return JSON.parse(cached)
  }

  try {
    const response = await fetchFirst([
      `/api/legend/${encodeURIComponent(playId)}`,
      assetUrl(`static/data/legend-${playId}.json`),
      assetUrl('static/data/legend-default.json'),
    ], { cache: 'no-cache' })
    const legend = await response.json()
    if (legend?.rows?.length) {
      localStorage.setItem(cacheKey, JSON.stringify(legend))
      localStorage.setItem(cacheTimeKey, Date.now().toString())
    }
    return legend
  } catch (error) {
    console.warn('Failed to load workbook legend:', error)
    return cached ? JSON.parse(cached) : null
  }
}

export function createLegendElement(legend) {
  const details = document.createElement('details')
  details.className = 'workbook-legend'

  const summary = document.createElement('summary')
  summary.textContent = `📘 Legende${legend?.sheet ? ` · ${legend.sheet}` : ''}`
  details.appendChild(summary)

  if (!legend?.rows?.length) {
    const empty = document.createElement('p')
    empty.className = 'legend-empty'
    empty.textContent = 'Keine Legende in der XLSX gefunden.'
    details.appendChild(empty)
    return details
  }

  const columns = legend.columns || Object.keys(legend.rows[0] || {})
  const table = document.createElement('table')
  table.className = 'legend-table'

  const thead = document.createElement('thead')
  thead.innerHTML = `<tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>`
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  legend.rows.forEach((row) => {
    const tr = document.createElement('tr')
    columns.forEach((column) => {
      const td = document.createElement('td')
      if (column === 'Kategorie') {
        const tag = document.createElement('span')
        tag.className = 'legend-category'
        tag.textContent = String(row[column] ?? '').replace(/^\*\*|\*\*$/g, '')
        td.appendChild(tag)
      } else {
        td.textContent = formatLegendValue(row[column])
      }
      tr.appendChild(td)
    })
    tbody.appendChild(tr)
  })
  table.appendChild(tbody)
  details.appendChild(table)

  return details
}
