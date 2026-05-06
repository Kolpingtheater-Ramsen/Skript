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
      'show-micro': true,
    },
    sliders: {},
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
    },
    sliders: {},
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
    },
    sliders: {},
  },
  all: {
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
    },
    sliders: {},
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
