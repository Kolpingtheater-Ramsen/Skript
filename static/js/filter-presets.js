/**
 * Settings content-filter presets.
 */

const FILTER_PRESETS = {
  actor: {
    checks: {
      'show-actor-text': true,
      'show-directions': true,
      'show-technical': false,
      'show-lighting': false,
      'show-einspieler': false,
      'show-requisiten': false,
      'show-microphone': false,
      'show-auto-microphone': false,
      'show-micro': false,
      'show-scene-overview': true,
      'blur-lines': false,
      'autoscroll': false,
    },
    sliders: {
      'directions-context': 0,
      'technical-context': 0,
      'lighting-context': 0,
      'einspieler-context': 0,
      'requisiten-context': 0,
      'microphone-context': 0,
      'auto-microphone-context': 0,
    },
  },
  practice: {
    checks: {
      'show-actor-text': true,
      'show-directions': true,
      'show-technical': false,
      'show-lighting': false,
      'show-einspieler': false,
      'show-requisiten': false,
      'show-microphone': false,
      'show-auto-microphone': false,
      'show-micro': false,
      'show-scene-overview': true,
      'blur-lines': true,
      'autoscroll': false,
    },
    sliders: {
      'directions-context': 0,
      'technical-context': 0,
      'lighting-context': 0,
      'einspieler-context': 0,
      'requisiten-context': 0,
      'microphone-context': 0,
      'auto-microphone-context': 0,
    },
  },
  tech: {
    checks: {
      'show-actor-text': true,
      'show-directions': true,
      'show-technical': true,
      'show-lighting': true,
      'show-einspieler': true,
      'show-requisiten': true,
      'show-microphone': true,
      'show-auto-microphone': true,
      'show-micro': true,
      'show-scene-overview': true,
      'blur-lines': false,
      'autoscroll': false,
    },
    sliders: {
      'directions-context': 0,
      'technical-context': 0,
      'lighting-context': 0,
      'einspieler-context': 0,
      'requisiten-context': 0,
      'microphone-context': 0,
      'auto-microphone-context': 0,
    },
  },
  text: {
    checks: {
      'show-actor-text': true,
      'show-directions': false,
      'show-technical': false,
      'show-lighting': false,
      'show-einspieler': false,
      'show-requisiten': false,
      'show-microphone': false,
      'show-auto-microphone': false,
      'show-micro': false,
      'show-scene-overview': true,
      'blur-lines': false,
      'autoscroll': false,
    },
    sliders: {
      'directions-context': 0,
      'technical-context': 0,
      'lighting-context': 0,
      'einspieler-context': 0,
      'requisiten-context': 0,
      'microphone-context': 0,
      'auto-microphone-context': 0,
    },
  },
}

export function applyFilterPreset(preset) {
  const config = FILTER_PRESETS[preset]
  if (!config) return false

  Object.entries(config.checks).forEach(([id, checked]) => {
    const checkbox = document.getElementById(id)
    if (checkbox) checkbox.checked = checked
  })

  Object.entries(config.sliders).forEach(([id, value]) => {
    const slider = document.getElementById(id)
    const valueDisplay = document.getElementById(`${id}-value`)
    if (slider) slider.value = value
    if (valueDisplay) valueDisplay.textContent = value
  })

  return true
}

export function getMatchingFilterPreset() {
  return (
    Object.entries(FILTER_PRESETS).find(([, config]) => {
      const checksMatch = Object.entries(config.checks).every(([id, checked]) => {
        const checkbox = document.getElementById(id)
        return !checkbox || checkbox.checked === checked
      })
      const slidersMatch = Object.entries(config.sliders).every(([id, value]) => {
        const slider = document.getElementById(id)
        return !slider || slider.value === String(value)
      })
      return checksMatch && slidersMatch
    })?.[0] || null
  )
}
