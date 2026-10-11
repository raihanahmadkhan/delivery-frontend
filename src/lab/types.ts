export interface Stop {
  id: string
  name: string
  x: number
  y: number
  latitude?: number | null
  longitude?: number | null
  demand: number
  service_minutes: number
  window_start: number
  window_end: number
}
export interface Scenario {
  name: string
  description: string
  coordinate_mode: 'cartesian' | 'geographic'
  nodes: Stop[]
  depot_id: string
  speed_kph: number
  travel_model?: 'straight_line' | 'road'
  fleet: {
    count: number
    capacity: number
    start_time: number
    end_time: number
    max_distance_km: number | null
  }
  matrix?: {
    distances_km: (number | null)[][]
    durations_minutes: (number | null)[][]
    source: string
    profile: string
    data_version: string
    road?: {
      engine: string
      coordinates_hash: string
      captured_at: string
      snapped: [number, number][]
      hints: string[]
    } | null
  } | null
  execution?: {
    vehicle_index: number
    completed: string[]
    assigned: string[]
    ready_time: number
  }[]
}
export type Algorithm = 'greedy' | 'local_search' | 'alns' | 'exact' | 'ortools'
export interface Options {
  algorithm: Algorithm
  seed: number
  time_limit_seconds: number
  iterations: number
  removal_fraction: number
  adaptive: boolean
  local_improvement: boolean
}
export interface ScheduledStop {
  node_id: string
  arrival: number
  service_start: number
  departure: number
  waiting: number
  travel_minutes: number
  service_minutes: number
  load_remaining: number
  slack: number
  disruption_minutes: number
}
export interface Vehicle {
  vehicle_index: number
  customers: string[]
  route: string[]
  distance_km: number
  driving_minutes: number
  waiting_minutes: number
  service_minutes: number
  return_time: number
  initial_load: number
  capacity: number
  schedule: ScheduledStop[]
}
export interface Evaluation {
  feasible: boolean
  vehicles_used: number
  distance_km: number
  driving_minutes: number
  waiting_minutes: number
  service_minutes: number
  unserved: string[]
  violations: {
    kind: string
    message: string
    vehicle_index: number | null
    node_id: string | null
    amount: number
  }[]
  vehicles: Vehicle[]
  objective: number[]
}
export interface Checkpoint {
  iteration: number
  elapsed_ms: number
  feasible: boolean
  vehicles_used: number
  distance_km: number
  unserved: number
  operation: string
  routes?: string[][]
  removed?: string[]
}
export interface Result {
  kind?: string
  algorithm: string
  status: string
  termination_reason: string
  proven_optimal: boolean
  routes: string[][]
  evaluation: Evaluation
  history: Checkpoint[]
  trace: Checkpoint[]
  solver_time_ms: number
  evaluations: number
  options: Options
  scenario: Scenario
  scenario_hash: string
  matrix_hash: string
  matrix_provenance: Record<string, unknown>
  solver_version: string
  environment?: {
    python: string
    platform: string
    processor: string
    packages: Record<string, string>
    source_sha256: string
  }
  exact_reference?: {
    vehicles_gap: number
    distance_gap_percent: number | null
    optimal_vehicles: number
    optimal_distance_km: number
    note: string
  }
  operator_stats: Record<
    string,
    { uses: number; accepted: number; improvements: number; weight: number }
  >
  disruption?: {
    decision_time: number
    continued: Evaluation
    changed_successors: number
    change_budget: number | null
    delay_minutes: number
    vehicle_index: number
    semantics: string
  }
  error?: string
}
export interface Experiment {
  kind: 'experiment'
  scenario: Scenario
  trials: Result[]
  completed_trials: number
  planned_trials: number
  total_time_ms: number
  methodology: string
  paired_comparisons?: {
    algorithm: string
    baseline: string
    wins: number
    ties: number
    losses: number
    both_infeasible: number
    missing_or_error: number
  }[]
  summary: {
    algorithm: string
    runs: number
    feasible_runs: number
    feasible_rate: number
    min_vehicles: number | null
    max_vehicles: number | null
    median_distance_at_min_vehicles: number | null
    min_distance_at_min_vehicles: number | null
    max_distance_at_min_vehicles: number | null
    distance_stdev_at_min_vehicles: number | null
    median_solver_ms: number | null
  }[]
}
export interface Job {
  id: string
  kind: 'run' | 'experiment' | 'replan'
  status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed'
  request?: { scenario?: Scenario; options?: Options }
  result?: Result | Experiment | null
  progress?: Checkpoint & {
    routes?: string[][]
    evaluations?: number
    history?: Checkpoint[]
    trial_index?: number
    trial_count?: number
    algorithm?: string
  }
  error?: string | null
  created: number
  started?: number
  finished?: number
  name?: string
  algorithm?: string
}
export interface Preset {
  id: string
  name: string
  description: string
  customers: number
  tag: string
}

export interface MapConfiguration {
  configured: boolean
  public?: boolean
  max_customers?: number
  tile_url?: string
  search_public?: boolean
  search_provider?: string
}

export interface Place {
  name: string
  latitude: number
  longitude: number
}
