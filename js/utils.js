/**
 * Utility functions
 */

/**
 * Smooth scroll an element into view with offset
 * @param {HTMLElement} element - Element to scroll to
 * @param {number} offsetVh - Viewport height offset in vh units
 */
export function smoothScrollToElement(element, offsetVh = 25) {
  if (!element) return
  element.style.scrollMarginTop = `${offsetVh}vh`
  element.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Get URL parameters
 * @returns {URLSearchParams} URL parameters
 */
export function getUrlParams() {
  return new URLSearchParams(window.location.search)
}

/**
 * Update URL parameter without reload
 * @param {string} key - Parameter key
 * @param {string} value - Parameter value
 */
export function updateUrlParam(key, value) {
  const url = new URL(window.location.href)
  url.searchParams.set(key, value)
  window.history.replaceState(null, '', url.toString())
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in ms
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * Format time to German locale
 * @param {Date} date - Date object
 * @returns {string} Formatted time string
 */
export function formatTime(date = new Date()) {
  return date.toLocaleTimeString('de-DE')
}

/**
 * Get element by id with error handling
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} Element or null
 */
export function getEl(id) {
  const el = document.getElementById(id)
  if (!el) {
    console.warn(`Element with id "${id}" not found`)
  }
  return el
}

/**
 * Create HTML element with attributes
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes object
 * @param {string} content - Text content
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, attrs = {}, content = '') {
  const el = document.createElement(tag)

  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      el.className = value
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        el.dataset[dataKey] = dataValue
      })
    } else if (key.startsWith('on')) {
      const eventName = key.substring(2).toLowerCase()
      el.addEventListener(eventName, value)
    } else {
      el.setAttribute(key, value)
    }
  })

  if (content) {
    el.textContent = content
  }

  return el
}

/**
 * Auto-scroll manager for long content
 */
export class AutoScrollManager {
  constructor() {
    this.intervals = []
  }

  /**
   * Start auto-scrolling for a container
   * @param {HTMLElement} container - Container to scroll
   * @param {Object} options - Scroll options
   */
  start(container, options = {}) {
    if (!container) return

    const {
      speed = 0.75,
      pauseDuration = 45,
      interval = 100,
    } = options

    // Check if scrolling is needed
    if (container.scrollHeight <= container.clientHeight) {
      return
    }

    const maxScroll = container.scrollHeight - container.clientHeight
    const heightFactor = Math.max(1, maxScroll / 100)
    const scrollSpeed = Math.max(1, Math.round(speed * heightFactor))
    const actualPauseDuration = Math.max(15, Math.round(pauseDuration / heightFactor))

    let direction = scrollSpeed
    let pauseCounter = 0

    const scrollInterval = setInterval(() => {
      if (pauseCounter > 0) {
        pauseCounter--
        return
      }

      container.scrollTop += direction

      // Check boundaries
      if (container.scrollTop >= maxScroll && direction > 0) {
        direction = -scrollSpeed
        pauseCounter = actualPauseDuration
        container.scrollTop = maxScroll
      } else if (container.scrollTop <= 0 && direction < 0) {
        direction = scrollSpeed
        pauseCounter = actualPauseDuration
        container.scrollTop = 0
      }
    }, interval)

    this.intervals.push(scrollInterval)
  }

  /**
   * Stop all auto-scrolling
   */
  stopAll() {
    this.intervals.forEach((interval) => clearInterval(interval))
    this.intervals = []
  }
}

/**
 * Simple event emitter for custom events
 */
export class EventEmitter {
  constructor() {
    this.events = {}
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  off(event, callback) {
    if (!this.events[event]) return
    this.events[event] = this.events[event].filter((cb) => cb !== callback)
  }

  emit(event, ...args) {
    if (!this.events[event]) return
    this.events[event].forEach((callback) => {
      try {
        callback(...args)
      } catch (error) {
        console.error(`Error in event "${event}" callback:`, error)
      }
    })
  }
}
