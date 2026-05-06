/**
 * Inline text rendering helpers.
 *
 * Handles small rich-text transforms inside script lines: search/name
 * highlighting and dimming parenthetical stage directions.
 */

export function appendHighlightedText(container, text, needle) {
  container.textContent = ''
  appendTextWithTransforms(container, text, { highlight: needle })
}

export function appendTextWithTransforms(container, text, options = {}) {
  const source = text || ''
  const highlight = options.highlight || ''
  const dimParentheses = options.dimParentheses || false
  const lowerHighlight = highlight.toLowerCase()
  const parenRegex = /\([^()]*\)/g

  function appendSegment(segment) {
    if (!segment) return
    if (!highlight) {
      container.appendChild(document.createTextNode(segment))
      return
    }

    const lowerSegment = segment.toLowerCase()
    let cursor = 0
    let matchIndex = lowerSegment.indexOf(lowerHighlight)
    while (matchIndex !== -1) {
      if (matchIndex > cursor) {
        container.appendChild(document.createTextNode(segment.slice(cursor, matchIndex)))
      }
      const strong = document.createElement('b')
      strong.textContent = segment.slice(matchIndex, matchIndex + highlight.length)
      container.appendChild(strong)
      cursor = matchIndex + highlight.length
      matchIndex = lowerSegment.indexOf(lowerHighlight, cursor)
    }
    if (cursor < segment.length) {
      container.appendChild(document.createTextNode(segment.slice(cursor)))
    }
  }

  if (!dimParentheses) {
    appendSegment(source)
    return
  }

  let cursor = 0
  for (const match of source.matchAll(parenRegex)) {
    if (match.index > cursor) {
      appendSegment(source.slice(cursor, match.index))
    }
    const span = document.createElement('span')
    span.className = 'inline-stage-direction'
    appendTextWithTransforms(span, match[0], { highlight })
    container.appendChild(span)
    cursor = match.index + match[0].length
  }
  if (cursor < source.length) {
    appendSegment(source.slice(cursor))
  }
}
