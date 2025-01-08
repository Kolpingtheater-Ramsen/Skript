// Socket.io initialization
const socket = io({
  transports: ['websocket'],
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  timeout: 20000,
})

// Director mode state
let isDirector = false
let directorName = ''
let isConnected = false
let reconnectAttempts = 0
let markedLine = null
let markedLineData = null

// Socket.IO event handlers
socket.on('connect', () => {
  console.log('Connected to server')
  isConnected = true
  reconnectAttempts = 0
  document.getElementById('director-status').textContent = directorName
    ? `Aktueller Director: ${directorName}`
    : 'Aktueller Director: Niemand'
})

socket.on('connect_error', (error) => {
  console.error('Connection error:', error)
  isConnected = false
  reconnectAttempts++
  document.getElementById(
    'director-status'
  ).textContent = `Director Mode: Offline (Verbindungsfehler - Versuch ${reconnectAttempts})`
})

socket.on('disconnect', (reason) => {
  console.log('Disconnected from server:', reason)
  isConnected = false
  document.getElementById('director-status').textContent =
    'Director Mode: Offline'

  // If we were the director, clear the state
  if (isDirector) {
    isDirector = false
    directorName = ''
    document.getElementById('name').value = ''
    document.getElementById('password').value = ''
    updateDirectorUI(false)
  }

  // Clear any markers
  clearMarkedLine()
})

socket.on('marker_update', (data) => {
  // Clear any existing marker
  clearMarkedLine()

  // Find and mark the line
  const allLines = document.querySelectorAll('.script-line')
  if (allLines[data.index]) {
    markLine(allLines[data.index])
  }
})

socket.on('marker_clear', () => {
  clearMarkedLine()
})

socket.on('set_director', (data) => {
  const directorStatus = document.getElementById('director-status')
  if (data.success) {
    directorStatus.textContent = data.director
    if (data.director !== 'Niemand') {
      document.body.classList.add('director-active')
      if (data.isDirector) {
        document.body.classList.add('is-director')
        isDirector = true
      } else {
        document.body.classList.remove('is-director')
        isDirector = false
      }
    } else {
      document.body.classList.remove('director-active', 'is-director')
    }
  } else {
    directorStatus.textContent = 'Niemand'
    document.body.classList.remove('director-active', 'is-director')
    if (data.message) {
      alert(data.message)
    }
  }
})

socket.on('unset_director', (data) => {
  handleDirectorChange(null, false)
  clearMarkedLine() // Clear markers when director leaves

  // Clear inputs if we were the director
  if (data.previousDirector === directorName) {
    document.getElementById('name').value = ''
    document.getElementById('password').value = ''
  }
})

socket.on('director_takeover', (data) => {
  const wasDirector =
    data.isDirector === false && directorName === data.previousDirector

  // Update state for the new director
  handleDirectorChange(data.newDirector, data.isDirector)

  // If we were the previous director, clear our inputs
  if (wasDirector) {
    document.getElementById('name').value = ''
    document.getElementById('password').value = ''
    alert('Ein neuer Director hat übernommen.')
  }
})

// Load and parse CSV
async function loadScript() {
  try {
    // Check cache first
    const cachedData = localStorage.getItem('scriptData')
    const lastFetch = localStorage.getItem('scriptLastFetch')
    const cacheAge = lastFetch ? Date.now() - parseInt(lastFetch) : Infinity

    // Use cache if it exists and is less than 5 minutes old
    if (cachedData && cacheAge < 5 * 60 * 1000) {
      return JSON.parse(cachedData)
    }

    const response = await fetch(
      'https://docs.google.com/spreadsheets/d/1LEhNzES1aLQ_UVA8esjXcGgkK3I5gv3q/export?format=csv&gid=2016971711'
    )

    if (!response.ok) {
      // If fetch fails and we have cached data, use it regardless of age
      if (cachedData) {
        console.log('Failed to fetch new data, using cached data')
        return JSON.parse(cachedData)
      }
      throw new Error('Network response was not ok')
    }

    const csvText = await response.text()
    const data = Papa.parse(csvText, { header: true }).data

    // Only update cache if we got valid data
    if (data && data.length > 0) {
      localStorage.setItem('scriptData', JSON.stringify(data))
      localStorage.setItem('scriptLastFetch', Date.now().toString())
    }

    return data
  } catch (error) {
    console.error('Error loading script:', error)
    // Try to return cached data if available
    const cachedData = localStorage.getItem('scriptData')
    if (cachedData) {
      console.log('Error fetching new data, using cached data')
      return JSON.parse(cachedData)
    }
    return []
  }
}

// Populate actors dropdown
function populateActors(data) {
  const actors = [
    ...new Set(
      data.filter((row) => row.Charakter).map((row) => row.Charakter.trim())
    ),
  ].sort()

  const select = document.getElementById('actor-select')
  select.innerHTML = '<option value="">Alle Charaktere</option>'
  actors.forEach((actor) => {
    const option = document.createElement('option')
    option.value = actor
    option.textContent = actor
    select.appendChild(option)
  })
}

// ToC
function createToC(data, selectedActor) {
  // Get all scenes & actors in each scene
  const scenes = new Map()
  data.forEach((row) => {
    if (!scenes.has(row.Szene)) {
      scenes.set(row.Szene, new Set())
    }
    if (row.Charakter) scenes.get(row.Szene).add(row.Charakter)
  })

  const createTocContent = () => {
    const toc = document.createElement('div')
    toc.className = 'toc'

    const title = document.createElement('h2')
    title.textContent = 'Inhaltsverzeichnis'
    toc.appendChild(title)

    scenes.forEach((actors, scene) => {
      const a = document.createElement('a')
      a.href = `#scene-${scene}`
      if (actors.has(selectedActor)) {
        a.style.fontWeight = 'bold'
        a.style.borderLeft = '4px solid #4299e1'
      }
      a.textContent = `Szene ${scene}`
      a.onclick = () => {
        if (window.innerWidth <= 768) {
          closeSidebar()
        }
        updateCurrentScene()
      }
      toc.appendChild(a)
    })

    return toc
  }

  // Create and return TOC for main content
  const mainToc = createTocContent()

  // Create and update sidebar TOC
  const sidebarToc = createTocContent()
  const sidebar = document.querySelector('.sidebar')
  if (sidebar) {
    sidebar.innerHTML = ''
    sidebar.appendChild(sidebarToc)
  }

  return mainToc
}

// Create scene overview
function createSceneOverview(sceneData, selectedActor) {
  let actors = new Set()
  const micros = new Map()

  sceneData.forEach((row) => {
    if (row.Charakter) {
      actors.add(row.Charakter.trim())
      if (row.Mikrofon) {
        micros.set(row.Charakter, row.Mikrofon)
      }
    }
  })

  if (actors.size === 0) return document.createElement('div')

  const overview = document.createElement('div')
  overview.className = 'scene-overview'

  const title = document.createElement('h3')
  title.textContent = 'Szenenübersicht'
  overview.appendChild(title)

  const table = document.createElement('table')

  const tr = document.createElement('tr')
  const th1 = document.createElement('th')
  th1.textContent = 'Mikro'
  tr.appendChild(th1)
  const th2 = document.createElement('th')
  th2.textContent = 'Schauspieler'
  tr.appendChild(th2)
  table.appendChild(tr)

  // Sort actors by micro and try to parse micros as numbers
  actors = Array.from(actors).sort((a, b) => {
    const microA = parseInt(micros.get(a), 10)
    const microB = parseInt(micros.get(b), 10)
    return microA - microB
  })

  actors.forEach((actor) => {
    const tr = document.createElement('tr')
    const td1 = document.createElement('td')
    td1.textContent = micros.get(actor) || ''
    tr.appendChild(td1)
    const td2 = document.createElement('td')
    td2.innerHTML = selectedActor === actor ? `<b>${actor}</b>` : actor
    tr.appendChild(td2)
    table.appendChild(tr)
  })

  overview.appendChild(table)

  return overview
}

// Render script
function renderScript(data) {
  const container = document.getElementById('script-container')
  const selectedActor = document.getElementById('actor-select').value
  const showDirections = document.getElementById('show-directions').checked
  const showTechnical = document.getElementById('show-technical').checked
  const showLighting = document.getElementById('show-lighting').checked
  const showActorText = document.getElementById('show-actor-text').checked
  const showMicro = document.getElementById('show-micro').checked
  const showEinspieler = document.getElementById('show-einspieler').checked
  const showSceneOverview = document.getElementById(
    'show-scene-overview'
  ).checked
  const blurLines = document.getElementById('blur-lines').checked

  // Get context values
  const directionsContext = parseInt(
    document.getElementById('directions-context').value
  )
  const technicalContext = parseInt(
    document.getElementById('technical-context').value
  )
  const lightingContext = parseInt(
    document.getElementById('lighting-context').value
  )
  const einspielContext = parseInt(
    document.getElementById('einspieler-context').value
  )

  container.innerHTML = ''

  const toc = createToC(data, selectedActor)
  container.appendChild(toc)

  let currentScene = ''
  let sceneData = []

  // First pass: determine which lines should be visible or context
  const lineStates = new Map() // Maps index to {visible: boolean, isContext: boolean}
  data.forEach((row, index) => {
    const state = { visible: false, isContext: false }

    // Check if line should be visible based on filters
    if (
      (showDirections && row.Kategorie === 'Anweisung') ||
      (showTechnical && row.Kategorie === 'Technik') ||
      (showLighting && row.Kategorie === 'Licht') ||
      (showEinspieler && row.Kategorie === 'Einspieler') ||
      (showActorText && row.Charakter)
    ) {
      state.visible = true

      // Add context lines based on category
      let contextRange = 0
      if (row.Kategorie === 'Anweisung') contextRange = directionsContext
      else if (row.Kategorie === 'Technik') contextRange = technicalContext
      else if (row.Kategorie === 'Licht') contextRange = lightingContext
      else if (row.Kategorie === 'Einspieler') contextRange = einspielContext

      // Mark context lines
      for (
        let i = Math.max(0, index - contextRange);
        i <= Math.min(data.length - 1, index + contextRange);
        i++
      ) {
        if (i !== index) {
          const contextState = lineStates.get(i) || {
            visible: false,
            isContext: false,
          }
          contextState.isContext = true
          lineStates.set(i, contextState)
        }
      }
    }

    lineStates.set(index, state)
  })

  // Second pass: render lines
  data.forEach((row, index) => {
    const state = lineStates.get(index)

    // Check for new scene
    const isNewScene = row.Szene !== currentScene

    if (isNewScene) {
      const a = document.createElement('a')
      a.name = `scene-${row.Szene}`
      container.appendChild(a)
      const szeneTitel = document.createElement('h2')
      szeneTitel.textContent = `Szene ${row.Szene}`
      container.appendChild(szeneTitel)
      const separator = document.createElement('div')
      separator.className = 'scene-separator'
      container.appendChild(separator)

      if (showSceneOverview) {
        for (let i = index; i < data.length; i++) {
          if (data[i].Szene === row.Szene) {
            sceneData.push(data[i])
          } else {
            break
          }
        }
        if (sceneData.length > 0) {
          container.appendChild(createSceneOverview(sceneData, selectedActor))
        }
        sceneData = []
      }
      currentScene = row.Szene
    }

    const div = document.createElement('div')
    div.className = 'script-line'

    // Set visibility based on state
    if (!state.visible && !state.isContext) {
      div.style.display = 'none'
    } else if (state.isContext && !state.visible) {
      div.classList.add('context-line')
    }

    // Apply styling based on type
    if (row.Kategorie === 'Anweisung') {
      div.classList.add('instruction')
    } else if (row.Kategorie === 'Szenenbeginn') {
      div.style.display = 'none'
    } else if (row.Kategorie === 'Einspieler') {
      div.classList.add('audio')
      const audioSpan = document.createElement('div')
      audioSpan.className = 'tag'
      audioSpan.textContent = 'Einspieler'
      div.appendChild(audioSpan)
    } else if (row.Kategorie === 'Technik') {
      const techSpan = document.createElement('div')
      techSpan.className = 'tag'
      techSpan.textContent = 'Technik'
      div.appendChild(techSpan)
      div.classList.add('technical')
    } else if (row.Kategorie === 'Licht') {
      const lightSpan = document.createElement('div')
      lightSpan.className = 'tag'
      lightSpan.textContent = 'Licht'
      div.appendChild(lightSpan)
      div.classList.add('lighting')
    } else if (row.Charakter === selectedActor && selectedActor) {
      div.classList.add('highlighted')
      if (blurLines) {
        div.style.filter = 'blur(4px)'
      }
    }

    // Add click handler for all lines
    div.style.cursor = 'pointer'
    div.addEventListener('click', () => {
      if (document.getElementById('set-marker').checked) {
        markLine(div)
      } else if (blurLines && row.Charakter === selectedActor) {
        div.style.filter = div.style.filter === 'none' ? 'blur(4px)' : 'none'
      }
    })

    // Create content
    if (row.Charakter) {
      const nameSpan = document.createElement('div')
      nameSpan.className = 'actor-name'
      nameSpan.textContent =
        row.Mikrofon && showMicro
          ? `${row.Charakter} (${row.Mikrofon})`
          : row.Charakter
      div.appendChild(nameSpan)
    }

    const textDiv = document.createElement('div')
    textDiv.textContent = row['Text/Anweisung']

    // Bold text for instruction
    if (row.Kategorie === 'Anweisung') {
      textDiv.innerHTML = textDiv.textContent.replace(
        selectedActor,
        `<b>${selectedActor}</b>`
      )
    }

    div.appendChild(textDiv)
    container.appendChild(div)
  })

  // Update bottom navigation after rendering
  updateBottomNav()
}

// Save state to localStorage
function saveState() {
  const checkboxes = document.querySelectorAll(
    '#checkboxes input[type="checkbox"]'
  )
  checkboxes.forEach((checkbox) => {
    localStorage.setItem(checkbox.id, checkbox.checked)
  })

  // Save context slider values
  const sliders = document.querySelectorAll('input[type="range"]')
  sliders.forEach((slider) => {
    localStorage.setItem(slider.id, slider.value)
  })

  const actorSelect = document.getElementById('actor-select')
  localStorage.setItem('actor-select', actorSelect.value)
  localStorage.setItem(
    'dark-mode',
    document.body.classList.contains('dark-mode')
  )
  localStorage.setItem(
    'pink-mode',
    document.body.classList.contains('pink-mode')
  )
}

// Load state from localStorage
function loadState() {
  const checkboxes = document.querySelectorAll(
    '#checkboxes input[type="checkbox"]'
  )
  checkboxes.forEach((checkbox) => {
    const storedValue = localStorage.getItem(checkbox.id)
    if (storedValue !== null) {
      checkbox.checked = storedValue === 'true'
    }
  })

  // Load context slider values
  const sliders = document.querySelectorAll('input[type="range"]')
  sliders.forEach((slider) => {
    const storedValue = localStorage.getItem(slider.id)
    if (storedValue !== null) {
      slider.value = storedValue
      document.getElementById(`${slider.id}-value`).textContent = storedValue
    }
  })

  const actorSelect = document.getElementById('actor-select')
  actorSelect.value = localStorage.getItem('actor-select') || ''

  // Handle blur-lines visibility based on actor selection
  const blurLinesGroup = document.getElementById('blur-lines').parentElement
  const markerGroup = document.getElementById('set-marker').parentElement

  blurLinesGroup.style.display = actorSelect.value ? 'flex' : 'none'
  markerGroup.style.display = 'flex' // Always show marker checkbox

  // Update context slider visibility
  updateContextSliderVisibility()

  const darkMode = localStorage.getItem('dark-mode') === 'true'
  const pinkMode = localStorage.getItem('pink-mode') === 'true'
  document.body.classList.toggle('dark-mode', darkMode)
  document.body.classList.toggle('pink-mode', pinkMode)
  document.getElementById('dark-mode').checked = darkMode
  document.getElementById('pink-mode').checked = pinkMode
}

// Initialize
async function init() {
  const data = await loadScript()
  window.scriptData = data
  populateActors(data)
  loadState()
  addContextSliderListeners()

  // Add event listeners for checkboxes
  document
    .querySelectorAll('#checkboxes input[type="checkbox"]')
    .forEach((input) => {
      input.addEventListener('change', () => {
        if (input.id === 'show-actor-text') {
          updateContextSliderVisibility()
        }
        if (input.id === 'set-marker') {
          document.getElementById('blur-lines').checked = false
        }
        if (input.id === 'blur-lines') {
          document.getElementById('set-marker').checked = false
        }
        saveState()
        renderScript(data)
      })
    })

  document.getElementById('actor-select').addEventListener('change', (e) => {
    // Show/hide blur-lines checkbox based on actor selection
    const blurLinesGroup = document.getElementById('blur-lines').parentElement
    const markerGroup = document.getElementById('set-marker').parentElement

    blurLinesGroup.style.display = e.target.value ? 'flex' : 'none'
    markerGroup.style.display = 'flex' // Always show marker checkbox

    saveState()
    renderScript(data)
  })

  document.getElementById('pink-mode').addEventListener('change', (e) => {
    if (e.target.checked) {
      document.body.classList.remove('dark-mode')
      document.getElementById('dark-mode').checked = false
      document.body.classList.add('pink-mode')
    } else {
      document.body.classList.remove('pink-mode')
    }
    saveState()
  })

  document.getElementById('dark-mode').addEventListener('change', (e) => {
    if (e.target.checked) {
      document.body.classList.remove('pink-mode')
      document.getElementById('pink-mode').checked = false
      document.body.classList.add('dark-mode')
    } else {
      document.body.classList.remove('dark-mode')
    }
    saveState()
  })

  // Add scroll event listener for updating current scene
  window.addEventListener('scroll', () => {
    updateCurrentScene()
    updateBottomNav()
    updateFabVisibility()
  })

  // Initial render and scene check
  renderScript(data)
  updateCurrentScene()
}

// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar')
  const overlay = document.querySelector('.sidebar-overlay')
  const navToggle = document.querySelector('.nav-toggle')

  sidebar.classList.toggle('active')
  overlay.classList.toggle('active')

  // Update button text
  navToggle.textContent = sidebar.classList.contains('active') ? '×' : '☰'
}

function closeSidebar() {
  const sidebar = document.querySelector('.sidebar')
  const overlay = document.querySelector('.sidebar-overlay')
  const navToggle = document.querySelector('.nav-toggle')

  sidebar.classList.remove('active')
  overlay.classList.remove('active')
  navToggle.textContent = '☰'
}

// Add this function before updateCurrentScene
function getCurrentSceneFromScroll() {
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

function updateCurrentScene() {
  const currentSceneEl = document.getElementById('current-scene')
  const currentScene = getCurrentSceneFromScroll()

  if (currentScene) {
    currentSceneEl.textContent = `Szene ${currentScene}`
    // add Role Name if it's not empty and scene is numeric
    const roleName = document.getElementById('actor-select').value
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
  } else {
    currentSceneEl.textContent = ''
  }
}

function findActorLines(actor) {
  const lines = []
  const scriptData = window.scriptData

  scriptData.forEach((row, index) => {
    if (row.Charakter === actor) {
      lines.push({
        index: index,
        scene: row.Szene,
        text: row['Text/Anweisung'],
      })
    }
  })

  return lines
}

function jumpToLine(lineIndex) {
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

    // Scroll to the line
    lines[lineIndex].scrollIntoView({ behavior: 'smooth', block: 'center' })
    updateCurrentLineInfo(lineIndex, lines.length)
  }
}

function jumpToNextLine() {
  const lines = document.querySelectorAll('.script-line.highlighted')
  const currentIndex = getCurrentLineIndex(lines)
  // If at the end, jump to the top
  if (currentIndex >= lines.length - 1) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    jumpToLine(currentIndex + 1)
  }
}

function jumpToPreviousLine() {
  const lines = document.querySelectorAll('.script-line.highlighted')
  const currentIndex = getCurrentLineIndex(lines)
  // If at the beginning, jump to the end, otherwise go to previous line
  const prevIndex = currentIndex <= 0 ? lines.length - 1 : currentIndex - 1
  jumpToLine(prevIndex)
}

function updateCurrentLineInfo(currentIndex, totalLines) {
  const infoElement = document.getElementById('current-line-info')
  infoElement.textContent = `Text ${currentIndex + 1} von ${totalLines}`
}

function updateBottomNav() {
  const selectedActor = document.getElementById('actor-select').value
  const bottomNav = document.querySelector('.bottom-nav')

  if (selectedActor) {
    bottomNav.style.display = 'flex'
    document.body.classList.add('has-bottom-nav')

    const lines = document.querySelectorAll('.script-line.highlighted')
    const currentIndex = getCurrentLineIndex(lines)
    updateCurrentLineInfo(currentIndex, lines.length)
  } else {
    bottomNav.style.display = 'none'
    document.body.classList.remove('has-bottom-nav')
  }
}

// Add keyboard navigation
document.addEventListener('keydown', (e) => {
  const selectedActor = document.getElementById('actor-select').value
  if (!selectedActor) return

  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    e.preventDefault()
    jumpToNextLine()
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault()
    jumpToPreviousLine()
  }
})

// Add this function after updateBottomNav
function getCurrentLineIndex(lines) {
  if (!lines.length) return -1

  // Get the viewport height and scroll position
  const viewportHeight = window.innerHeight
  const viewportCenter = window.scrollY + viewportHeight / 2

  // If we're near the top of the page (within first 100px), return 0
  if (window.scrollY < 1000) {
    return -1
  }

  // Find the line closest to the center of the viewport
  let closestLine = 0
  let closestDistance = Infinity

  lines.forEach((line, index) => {
    const rect = line.getBoundingClientRect()
    const lineCenter = window.scrollY + rect.top + rect.height / 2
    const distance = Math.abs(viewportCenter - lineCenter)

    if (distance < closestDistance) {
      closestDistance = distance
      closestLine = index
    }
  })

  return closestLine
}

// Add event listeners for context sliders
function addContextSliderListeners() {
  const sliders = document.querySelectorAll('input[type="range"]')
  sliders.forEach((slider) => {
    slider.addEventListener('input', (e) => {
      document.getElementById(`${e.target.id}-value`).textContent =
        e.target.value
      saveState()
      renderScript(window.scriptData)
    })
  })
}

function updateContextSliderVisibility() {
  const showActorText = document.getElementById('show-actor-text').checked
  const contextSliders = document.querySelectorAll('.context-slider-group')

  contextSliders.forEach((slider) => {
    slider.style.display = showActorText ? 'none' : 'flex'
  })
}

function markLine(element) {
  if (!document.getElementById('set-marker').checked) return

  // Clear previous mark
  clearMarkedLine()

  // Set new mark
  element.classList.add('marked-line')
  markedLine = element

  // If we're the director, broadcast the marker
  console.log('isDirector', isDirector)
  if (isDirector) {
    // Find the line's position in the script
    const allLines = document.querySelectorAll('.script-line')
    const lineIndex = Array.from(allLines).indexOf(element)
    markedLineData = { index: lineIndex }
    socket.emit('set_marker', markedLineData)
  }

  // Show/hide FAB based on scroll position
  updateFabVisibility()
}

function clearMarkedLine() {
  if (markedLine) {
    markedLine.classList.remove('marked-line')
    markedLine = null
    markedLineData = null

    // If we're the director, broadcast the clear
    if (isDirector) {
      socket.emit('clear_marker')
    }
  }
  document.querySelector('.fab').style.display = 'none'
}

function toggleDirectorPanel() {
  const content = document.querySelector('.director-content')
  content.classList.toggle('collapsed')
}

function toggleDirector() {
  const name = document.getElementById('name').value
  const password = document.getElementById('password').value

  if (!name || !password) {
    alert('Bitte Name und Passwort eingeben')
    return
  }

  if (isDirector) {
    // If already director, this acts as a logout
    socket.emit('unset_director', { name })
  } else {
    // Attempt to become director
    socket.emit('set_director', { name, password })
  }
}

// Update the director state management functions
function updateDirectorUI(isDirector) {
  // Toggle the border only if this user is the director
  document.body.classList.toggle('is-director', isDirector)

  // Keep director-active class if there's any director
  if (directorName && directorName !== 'Niemand') {
    document.body.classList.add('director-active')
  } else {
    document.body.classList.remove('director-active')
  }

  // Update button text
  document.querySelector('button[onclick="toggleDirector()"]').textContent =
    isDirector ? 'Director verlassen' : 'Director werden'
}

function handleDirectorChange(newDirector, isDirector) {
  directorName = newDirector

  // Update UI
  updateDirectorUI(isDirector)
  document.getElementById(
    'director-status'
  ).textContent = `Aktueller Director: ${newDirector || 'Niemand'}`
}

function jumpToMarkedLine() {
  if (markedLine) {
    markedLine.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

function updateFabVisibility() {
  const fab = document.querySelector('.fab')
  if (!markedLine) {
    fab.style.display = 'none'
    return
  }

  const markedRect = markedLine.getBoundingClientRect()
  const isMarkedLineVisible =
    markedRect.top >= 0 && markedRect.bottom <= window.innerHeight

  // set content to be arrow up or down
  fab.textContent = markedRect.top >= 0 ? '↓' : '↑'

  fab.style.display = isMarkedLineVisible ? 'none' : 'flex'
}
