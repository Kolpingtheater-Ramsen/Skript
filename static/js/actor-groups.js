/**
 * Actor grouping helpers for grouped dropdown selection.
 */

import { escapeRegExp } from './utils.js'

function normalizeKey(value) {
  return (value || '').toString().trim().toUpperCase()
}

function formatRoleSummary(roles = []) {
  if (roles.length <= 2) return roles.join(', ')
  return `${roles.length} Rollen`
}

function textMentionsValue(text, value) {
  const candidate = (value || '').toString().trim()
  if (!candidate) return false

  try {
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapeRegExp(candidate)}(?=$|[^\\p{L}\\p{N}])`,
      'iu'
    )
    return pattern.test((text || '').toString())
  } catch (error) {
    return normalizeKey(text).includes(normalizeKey(candidate))
  }
}

export function groupActorsByName(actors = []) {
  const groups = new Map()

  actors.forEach(([roleName, actorName]) => {
    const role = (roleName || '').trim()
    if (!role) return

    const cleanActorName = (actorName || '').trim() || role
    const key = normalizeKey((actorName || '').trim() || role)
    const existing = groups.get(key)

    if (existing) {
      if (!existing.roles.includes(role)) existing.roles.push(role)
      return
    }

    groups.set(key, {
      value: key,
      actorName: cleanActorName,
      roles: [role],
    })
  })

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      roles: [...group.roles].sort((a, b) => a.localeCompare(b, 'de')),
      label: `${group.actorName} (${formatRoleSummary(group.roles)})`,
    }))
    .sort((a, b) => a.actorName.localeCompare(b.actorName, 'de'))
}

export function findActorGroupBySelection(actors = [], selectedActor = '') {
  if (!selectedActor) return null

  const normalizedSelection = normalizeKey(selectedActor)
  const groups = groupActorsByName(actors)

  return (
    groups.find(
      (group) =>
        group.value === normalizedSelection ||
        group.roles.some((role) => normalizeKey(role) === normalizedSelection)
    ) || null
  )
}

/**
 * Return cast roles mentioned in a non-dialogue script row.
 * This makes silent roles in stage, technical, prop, and cue instructions
 * available to scene-level UI without treating names inside spoken dialogue
 * as an appearance.
 */
export function getMentionedRolesInRow(row, actors = []) {
  if (!row || row.Kategorie === 'Schauspieler' || row.Kategorie === 'Rolle') {
    return []
  }

  const text = row['Text/Anweisung'] || ''
  const mentionedRoles = new Set()

  actors.forEach(([roleName]) => {
    const role = (roleName || '').trim()
    if (role && textMentionsValue(text, role)) {
      mentionedRoles.add(role)
    }
  })

  return Array.from(mentionedRoles)
}

export function rowMatchesSelectedActor(row, selectedActor, actors = []) {
  if (!selectedActor) return false

  const group = findActorGroupBySelection(actors, selectedActor)
  const selectedRoles = group?.roles || [selectedActor]
  const selectedNames = new Set(
    [
      ...selectedRoles.map((role) => normalizeKey(role)),
      group?.actorName ? normalizeKey(group.actorName) : '',
      normalizeKey(selectedActor),
    ].filter(Boolean)
  )

  const rowCharacter = normalizeKey(row?.Charakter || '')
  if (rowCharacter && selectedNames.has(rowCharacter)) return true

  if (row?.Kategorie !== 'Schauspieler' && row?.Kategorie !== 'Rolle') {
    const text = (row && row['Text/Anweisung']) || ''
    return Array.from(selectedNames).some((name) => textMentionsValue(text, name))
  }

  return false
}

export function getActorDisplayName(role, actors = [], useActorNames = false) {
  if (!role) return role
  if (!useActorNames) return role

  const group = findActorGroupBySelection(actors, role)
  if (!group) return role

  return `${group.actorName} (${role})`
}
