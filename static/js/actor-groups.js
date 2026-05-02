/**
 * Actor grouping helpers for grouped dropdown selection.
 */

function normalizeKey(value) {
  return (value || '').toString().trim().toUpperCase()
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
      label:
        group.roles.length > 1
          ? `${group.actorName} (${group.roles.join(', ')})`
          : `${group.actorName} (${group.roles[0]})`,
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

  if (row?.Kategorie === 'Anweisung') {
    const text = ((row && row['Text/Anweisung']) || '').toUpperCase()
    return Array.from(selectedNames).some((name) => text.includes(name))
  }

  return false
}

export function getActorDisplayName(role, actors = [], useActorNames = false) {
  if (!role) return role
  if (!useActorNames) return role

  const group = findActorGroupBySelection(actors, role)
  if (!group) return role

  if (group.roles.length > 1) {
    return `${group.actorName} (${group.roles.join(', ')})`
  }

  return `${group.actorName} (${group.roles[0]})`
}
