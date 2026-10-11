import type { Scenario } from './types'

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// Rendering guard for untrusted/old browser storage. Server validation remains authoritative.
export function isDraft(value: unknown): value is Scenario {
  if (
    !record(value) ||
    !Array.isArray(value.nodes) ||
    (value.nodes.length < 2 &&
      !(value.coordinate_mode === 'geographic' && value.travel_model === 'road')) ||
    value.nodes.length > 101 ||
    !record(value.fleet)
  )
    return false
  if (
    typeof value.name !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.depot_id !== 'string' ||
    !['cartesian', 'geographic'].includes(String(value.coordinate_mode)) ||
    !finite(value.speed_kph)
  )
    return false
  const fleet = value.fleet
  if (!['count', 'capacity', 'start_time', 'end_time'].every((key) => finite(fleet[key])))
    return false
  if (!Number.isInteger(fleet.count) || (fleet.count as number) < 1 || (fleet.count as number) > 25)
    return false
  if (value.matrix != null) {
    const matrix = value.matrix
    const size = value.nodes.length
    if (
      !record(matrix) ||
      !['source', 'profile', 'data_version'].every((key) => typeof matrix[key] === 'string')
    )
      return false
    for (const key of ['distances_km', 'durations_minutes']) {
      const table = matrix[key]
      if (
        !Array.isArray(table) ||
        table.length !== size ||
        table.some(
          (row) =>
            !Array.isArray(row) ||
            row.length !== size ||
            row.some((entry) => entry !== null && !finite(entry)),
        )
      )
        return false
    }
    if (
      matrix.road != null &&
      (!record(matrix.road) || typeof matrix.road.captured_at !== 'string')
    )
      return false
  }
  const ids = new Set<string>()
  for (const node of value.nodes) {
    if (
      !record(node) ||
      typeof node.id !== 'string' ||
      typeof node.name !== 'string' ||
      ids.has(node.id)
    )
      return false
    if (
      !['x', 'y', 'demand', 'service_minutes', 'window_start', 'window_end'].every((key) =>
        finite(node[key]),
      )
    )
      return false
    if (
      value.coordinate_mode === 'geographic' &&
      (!finite(node.latitude) ||
        !finite(node.longitude) ||
        Math.abs(node.latitude) > 90 ||
        Math.abs(node.longitude) > 180)
    )
      return false
    ids.add(node.id)
  }
  return ids.has(value.depot_id) || (value.nodes.length === 0 && value.travel_model === 'road')
}

export function newRoadScenario(): Scenario {
  return {
    name: 'Untitled route',
    description: '',
    coordinate_mode: 'geographic',
    travel_model: 'road',
    depot_id: 'depot',
    nodes: [],
    speed_kph: 30,
    fleet: { count: 3, capacity: 30, start_time: 480, end_time: 1080, max_distance_km: null },
  }
}

export function changePlace(
  scenario: Scenario,
  place: { name: string; latitude: number; longitude: number },
  kind: 'depot' | 'delivery',
): Scenario {
  const isDepot = kind === 'depot'
  const existing = isDepot ? scenario.nodes.find((n) => n.id === scenario.depot_id) : undefined
  const node = {
    ...existing,
    id: isDepot ? scenario.depot_id : `s-${crypto.randomUUID().slice(0, 8)}`,
    name: place.name.slice(0, 120),
    latitude: place.latitude,
    longitude: place.longitude,
    x: 0,
    y: 0,
    demand: isDepot ? 0 : 1,
    service_minutes: isDepot ? 0 : 5,
    window_start: existing?.window_start ?? scenario.fleet.start_time,
    window_end: existing?.window_end ?? scenario.fleet.end_time,
  }
  return {
    ...scenario,
    matrix: null,
    execution: [],
    nodes: isDepot
      ? [node, ...scenario.nodes.filter((n) => n.id !== scenario.depot_id)]
      : [...scenario.nodes, node],
  }
}

export function parseSeeds(text: string): number[] {
  const parts = text.split(',').map((part) => part.trim())
  if (!parts.length || parts.some((part) => !/^\d+$/.test(part)))
    throw new Error('Seeds must be comma-separated nonnegative integers without empty entries.')
  const seeds = parts.map(Number)
  if (
    seeds.length > 10 ||
    new Set(seeds).size !== seeds.length ||
    seeds.some((seed) => seed > 2147483647)
  )
    throw new Error('Use 1–10 distinct seeds between 0 and 2147483647.')
  return seeds
}

export function jobFromHash(hash: string): string | null {
  const id = new URLSearchParams(hash.replace(/^#/, '')).get('run')
  return id && /^[a-f0-9]{32}$/.test(id) ? id : null
}
