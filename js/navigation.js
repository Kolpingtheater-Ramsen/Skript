/**
 * Navigation functionality for script
 */

import { smoothScrollToElement } from './utils.js'

/**
 * Navigation Manager class
 */
export class NavigationManager {
  constructor(stateManager) {
    this.state = stateManager
  }

  /**
   * Get current scene from scroll position
   * @returns {string} Current scene number or title
   */
  getCurrentSceneFromScroll() {
    const scenes = document.querySelectorAll('[name^="scene-"]')
    let currentScene = null

    for (const scene of scenes) {
      const rect = scene.getBoundingClientRect()
      if (rect.top <= 100) {
        // Adjust this value based on your navbar height
        currentScene = scene
      } else {
        break
      }
    }

    return currentScene
      ? currentScene.getAttribute('name').replace('scene-', '')
      : 'Kolpingtheater Ramsen - Drehbuch Viewer'
  }

  /**
   * Update current scene display
   */
  updateCurrentScene() {
    const currentSceneEl = document.getElementById('current-scene')
    const currentScene = this.getCurrentSceneFromScroll()

    if (currentSceneEl && currentScene) {
      currentSceneEl.textContent = `Szene ${currentScene}`
      // add Role Name if it's not empty and scene is numeric
      const roleName = document.getElementById('actor-select')?.value
      if (parseInt(currentScene) && roleName) {
        currentSceneEl.textContent += ` - ${roleName}`
      }
      if (currentScene === 'Kolpingtheater Ramsen - Drehbuch Viewer') {
        currentSceneEl.textContent = 'Kolpingtheater Ramsen - Drehbuch Viewer'
        history.replaceState(null, null, '')
        window.location.hash = ''
        return
      }
      // Only update hash if it's different to avoid unnecessary history entries
      const currentHash = window.location.hash.replace('#scene-', '')
      if (currentHash !== currentScene) {
        history.replaceState(null, null, `#scene-${currentScene}`)
      }
    }
  }

  /**
   * Get current line index from viewport position
   * @param {NodeList} lines - List of highlighted lines
   * @returns {number} Current line index
   */
  getCurrentLineIndex(lines) {
    if (!lines.length) return -1

    // Get the viewport height and scroll position
    const viewportHeight = window.innerHeight
    const viewportFocal = window.scrollY + viewportHeight * 0.25

    // Find the line closest to the center of the viewport
    let closestLine = 0
    let closestDistance = Infinity

    lines.forEach((line, index) => {
      const rect = line.getBoundingClientRect()
      const lineCenter = window.scrollY + rect.top + rect.height / 2
      const distance = Math.abs(viewportFocal - lineCenter)

      if (distance < closestDistance) {
        closestDistance = distance
        closestLine = index
      }
    })

    return closestLine
  }

  /**
   * Jump to a specific line with flash effect
   * @param {number} lineIndex - Index of line to jump to
   */
  jumpToLine(lineIndex) {
    const lines = document.querySelectorAll('.script-line.highlighted')
    if (lines[lineIndex]) {
      // Remove any existing flash effects
      document.querySelectorAll('.flash-highlight').forEach((el) => {
        el.classList.remove('flash-highlight')
      })

      // Add flash effect
      lines[lineIndex].classList.add('flash-highlight')

      // Remove the class after animation completes
      lines[lineIndex].addEventListener(
        'animationend',
        () => {
          lines[lineIndex].classList.remove('flash-highlight')
        },
        { once: true }
      )

      // Scroll to the line with ~25% viewport offset
      smoothScrollToElement(lines[lineIndex], 25)
      this.updateCurrentLineInfo(lineIndex, lines.length)
    }
  }

  /**
   * Jump to next line
   */
  jumpToNextLine() {
    const lines = document.querySelectorAll('.script-line.highlighted')
    const currentIndex = this.getCurrentLineIndex(lines)
    // Stop at the last item; do not jump to top
    if (currentIndex < lines.length - 1) {
      this.jumpToLine(currentIndex + 1)
    }
  }

  /**
   * Jump to previous line
   */
  jumpToPreviousLine() {
    const lines = document.querySelectorAll('.script-line.highlighted')
    const currentIndex = this.getCurrentLineIndex(lines)
    // Stop at the first item; do not wrap to end
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      this.jumpToLine(prevIndex)
    }
  }

  /**
   * Update current line info display
   * @param {number} currentIndex - Current line index
   * @param {number} totalLines - Total number of lines
   */
  updateCurrentLineInfo(currentIndex, totalLines) {
    const infoElement = document.getElementById('current-line-info')
    if (infoElement) {
      infoElement.textContent = `Text ${currentIndex + 1} von ${totalLines}`
    }
  }

  /**
   * Update bottom navigation bar visibility
   */
  updateBottomNav() {
    const selectedActor = document.getElementById('actor-select')?.value
    const bottomNav = document.querySelector('.bottom-nav')

    if (bottomNav) {
      if (selectedActor) {
        bottomNav.style.display = 'flex'
        document.body.classList.add('has-bottom-nav')

        const lines = document.querySelectorAll('.script-line.highlighted')
        const currentIndex = this.getCurrentLineIndex(lines)
        this.updateCurrentLineInfo(currentIndex, lines.length)
      } else {
        bottomNav.style.display = 'none'
        document.body.classList.remove('has-bottom-nav')
      }
    }
  }

  /**
   * Setup keyboard navigation
   * @param {Object} directorManager - Director manager instance
   */
  setupKeyboardNavigation(directorManager) {
    document.addEventListener('keydown', (e) => {
      const selectedActor = document.getElementById('actor-select')?.value
      const markedLine = this.state.get('markedLine')

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        if (selectedActor) {
          this.jumpToNextLine()
        } else if (markedLine) {
          // Move marker to next visible line
          const allLines = document.querySelectorAll('.script-line')
          let currentIndex = Array.from(allLines).indexOf(markedLine)

          while (currentIndex < allLines.length - 1) {
            currentIndex++
            const nextLine = allLines[currentIndex]
            // Check if line is visible (not display: none)
            if (window.getComputedStyle(nextLine).display !== 'none') {
              const allVisibleLines = Array.from(allLines)
              const globalIndex = allVisibleLines.indexOf(nextLine)
              directorManager.markLine(nextLine, globalIndex)
              break
            }
          }
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        if (selectedActor) {
          this.jumpToPreviousLine()
        } else if (markedLine) {
          // Move marker to previous visible line
          const allLines = document.querySelectorAll('.script-line')
          let currentIndex = Array.from(allLines).indexOf(markedLine)

          while (currentIndex > 0) {
            currentIndex--
            const prevLine = allLines[currentIndex]
            // Check if line is visible (not display: none)
            if (window.getComputedStyle(prevLine).display !== 'none') {
              const allVisibleLines = Array.from(allLines)
              const globalIndex = allVisibleLines.indexOf(prevLine)
              directorManager.markLine(prevLine, globalIndex)
              break
            }
          }
        }
      }
    })
  }

  /**
   * Setup scroll event listener
   * @param {Object} directorManager - Director manager instance
   */
  setupScrollListener(directorManager) {
    window.addEventListener('scroll', () => {
      this.updateCurrentScene()
      this.updateBottomNav()
      directorManager.updateFabVisibility()
    })
  }
}
