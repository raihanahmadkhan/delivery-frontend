import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import type {
  Algorithm,
  Experiment,
  Job,
  MapConfiguration,
  Options,
  Place,
  Preset,
  Result,
  Scenario,
  Stop,
} from './types'
import { API, download, request, upload } from './api'
import RouteCanvas, { color } from './RouteCanvas'
import { changePlace, isDraft, jobFromHash, newRoadScenario, parseSeeds } from './state'
import WorkflowControls from './WorkflowControls'
import type { WorkflowStep } from './WorkflowControls'
import {
  Convergence,
  ExperimentView,
  LABELS,
  Metrics,
  MoveInspector,
  number,
  Provenance,
  Schedule,
} from './ResultViews'
import './lab.css'
import './geography.css'
const GeographicMap = lazy(() => import('./GeographicMap'))

const DEFAULT_OPTIONS: Options = {
  algorithm: 'alns',
  seed: 42,
  time_limit_seconds: 3,
  iterations: 600,
  removal_fraction: 0.25,
  adaptive: true,
  local_improvement: true,
}
const ACTIVE = ['queued', 'running']
const DRAFT_KEY = 'routelab.scenario.v1'
const PAGES = {
  workspace: { label: 'Plan', icon: 'work' },
  experiments: { label: 'Compare', icon: 'flask' },
  history: { label: 'History', icon: 'clock' },
}
type Page = keyof typeof PAGES

function restoreDraft(): Scenario | null {
  try {
    const value = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    return isDraft(value) ? value : null
  } catch {
    return null
  }
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    route: 'M5 6a2 2 0 1 0 0 .01M19 18a2 2 0 1 0 0 .01M7 6h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8',
    work: 'M4 4h16v16H4zM4 10h16M10 10v10',
    flask: 'M9 3h6M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3M8 14h8',
    clock: 'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    arrow: 'M5 12h14M14 7l5 5-5 5',
  }
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.route} />
    </svg>
  )
}

export default function RouteLab() {
  const [draft, storeDraft] = useState<Scenario | null>(() => restoreDraft() || newRoadScenario())
  const loadSequence = useRef(0)
  const setDraft = useCallback((action: SetStateAction<Scenario | null>) => {
    loadSequence.current += 1
    storeDraft(action)
  }, [])
  const [presets, setPresets] = useState<Preset[]>([])
  const [available, setAvailable] = useState<Algorithm[]>([
    'greedy',
    'local_search',
    'alns',
    'exact',
  ])
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS)
  const [page, setPage] = useState<Page>('workspace')
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('places')
  const [mapRevision, setMapRevision] = useState(0)
  const [preparingRoads, setPreparingRoads] = useState(false)
  const [view, setView] = useState<'schedule' | 'search' | 'provenance' | 'replan'>('schedule')
  const [selected, setSelected] = useState<string | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const [jobId, setJobId] = useState(() => jobFromHash(location.hash))
  const [job, setJob] = useState<Job | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [saved, setSaved] = useState<{ id: string; name: string; created: number }[]>([])
  const [trial, setTrial] = useState<{ result: Result; index: number } | null>(null)
  const [traceIndex, setTraceIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [connected, setConnected] = useState(false)
  const [roadConfig, setRoadConfig] = useState<MapConfiguration>({ configured: false })
  const [undoDraft, setUndoDraft] = useState<Scenario | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [experimentAlgos, setExperimentAlgos] = useState<Algorithm[]>([
    'greedy',
    'local_search',
    'alns',
  ])
  const [seeds, setSeeds] = useState('11, 22, 33')
  const [delay, setDelay] = useState(20)
  const [delayVehicle, setDelayVehicle] = useState(0)
  const [completed, setCompleted] = useState(1)
  const [changeBudget, setChangeBudget] = useState('')
  const [mobileControls, setMobileControls] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [jsonBusy, setJsonBusy] = useState(false)
  const submissionLock = useRef(false)
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!jsonOpen) return
    const previous = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    dialog?.querySelector<HTMLTextAreaElement>('textarea')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !jsonBusy) {
        event.preventDefault()
        setJsonOpen(false)
      }
      if (event.key !== 'Tab' || !dialog) return
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), textarea, input, select, [tabindex="0"]',
        ),
      )
      const first = controls[0],
        last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('keydown', keydown)
      previous?.focus()
    }
  }, [jsonOpen, jsonBusy])

  const experiment = job?.result?.kind === 'experiment' ? (job.result as Experiment) : null
  const result = trial?.result || (!experiment ? (job?.result as Result | null) : null)
  const isRunning = !!job && ACTIVE.includes(job.status)
  const scenario = result?.scenario || job?.request?.scenario || (jobId ? null : draft)
  const stale = !!draft && !!scenario && JSON.stringify(draft) !== JSON.stringify(scenario)
  const trace = result?.trace || []
  const checkpoint = traceIndex === null ? null : trace[traceIndex]
  const routes = checkpoint?.routes || result?.routes || job?.progress?.routes || []
  const selectedNode = scenario?.nodes.find((node) => node.id === selected)
  const draftCustomers = draft?.nodes.filter((node) => node.id !== draft.depot_id).length ?? 0
  const comparisonReady =
    !!draft &&
    draft.nodes.some((node) => node.id === draft.depot_id) &&
    draftCustomers > 0 &&
    (draft.travel_model !== 'road' ||
      !!draft.matrix ||
      (roadConfig.configured && draftCustomers <= (roadConfig.max_customers ?? 25)))

  const refreshLists = useCallback(async () => {
    const [history, scenarios] = await Promise.all([
      request<Job[]>('/runs'),
      request<{ id: string; name: string; created: number }[]>('/scenarios'),
    ])
    setJobs(history)
    setSaved(scenarios)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      request<{ presets: Preset[] }>('/presets', undefined, controller.signal),
      request<{ algorithms: Algorithm[] }>('/capabilities', undefined, controller.signal),
      request<MapConfiguration>('/road-status', undefined, controller.signal)
        .then((road) => {
          setRoadConfig(road)
          return road
        })
        .catch((err) => {
          if (err.name === 'AbortError') throw err
          setError(`Map services: ${err.message}`)
          return { configured: false } as MapConfiguration
        }),
    ])
      .then(async ([data, capabilities]) => {
        setPresets(data.presets)
        setAvailable(capabilities.algorithms)
        setConnected(true)
        await refreshLists()
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError('Unable to connect to the route service. Please try again in a moment.')
          setConnected(false)
        }
      })
    return () => controller.abort()
  }, [refreshLists])

  useEffect(() => {
    if (draft) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      } catch {
        /* Server snapshots remain available when browser storage is full. */
      }
    }
  }, [draft])

  useEffect(() => {
    if (!jobId) return
    let stopped = false
    const controller = new AbortController()
    let loading = false
    let finished = false
    const update = async () => {
      if (loading || stopped || finished) return
      loading = true
      try {
        const data = await request<Job>(`/runs/${jobId}`, undefined, controller.signal)
        if (!stopped) {
          setJob(data)
          setConnected(true)
        }
        if (!ACTIVE.includes(data.status) && !stopped) {
          finished = true
          events.close()
          window.clearInterval(polling)
          await refreshLists()
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError' && !stopped) {
          setError((err as Error).message)
          if ((err as Error & { status?: number }).status === 404) {
            history.replaceState(null, '', `${location.pathname}${location.search}`)
            setJobId(null)
            setJob(null)
          }
        }
      } finally {
        loading = false
      }
    }
    update()
    const events = new EventSource(`${API}/runs/${jobId}/events`)
    events.addEventListener('progress', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data)
        if (!stopped && !finished && data.id === jobId)
          setJob((current) =>
            current?.id === jobId && ACTIVE.includes(current.status)
              ? { ...current, ...data }
              : current,
          )
      } catch {
        /* Polling repairs malformed or interrupted streams. */
      }
    })
    events.addEventListener('finished', () => {
      events.close()
      update()
    })
    const polling = window.setInterval(update, 2500)
    return () => {
      stopped = true
      controller.abort()
      events.close()
      window.clearInterval(polling)
    }
  }, [jobId, refreshLists])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(
      () =>
        setTraceIndex((index) => {
          const next = (index ?? -1) + 1
          return next >= trace.length ? 0 : next
        }),
      800,
    )
    return () => clearInterval(timer)
  }, [playing, trace.length])

  const showJob = useCallback((identity: string | null) => {
    setJobId(identity)
    setJob(null)
    setTrial(null)
    setTraceIndex(null)
    setPlaying(false)
    setFocused(null)
    setSelected(null)
  }, [])

  useEffect(() => {
    const onHash = () => {
      const next = jobFromHash(location.hash)
      if (next !== jobId) showJob(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [jobId, showJob])

  function openJob(identity: string, targetPage: 'workspace' | 'experiments' = 'workspace') {
    if (identity === jobId) {
      setPage(targetPage)
      setTrial(null)
      setTraceIndex(null)
      setPlaying(false)
      return
    }
    history.replaceState(null, '', `${location.pathname}${location.search}#run=${identity}`)
    showJob(identity)
    setPage(targetPage)
    setDelayVehicle(0)
    setCompleted(1)
  }

  function editDraft() {
    history.replaceState(null, '', `${location.pathname}${location.search}`)
    showJob(null)
  }

  function replaceDraft(next: Scenario) {
    setUndoDraft(null)
    setDraft(next)
    editDraft()
    setMapRevision((v) => v + 1)
  }

  async function loadPreset(key: string) {
    const sequence = ++loadSequence.current
    setError('')
    try {
      const next = await request<Scenario>(`/presets/${key}`)
      if (sequence !== loadSequence.current) return
      replaceDraft(next)
      setWorkflowStep('places')
      setNotice('Sample route loaded.')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function launch(kind: 'run' | 'experiment' | 'replan') {
    if ((!draft && kind !== 'replan') || submissionLock.current) return
    submissionLock.current = true
    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      const experimentSeeds = kind === 'experiment' ? parseSeeds(seeds) : undefined
      let frozenScenario = draft
      if (kind !== 'replan' && draft?.travel_model === 'road' && !draft.matrix) {
        setPreparingRoads(true)
        frozenScenario = await request<Scenario>('/matrices/road', draft)
        const snapshot = frozenScenario
        setDraft((current) => (current === draft ? snapshot : current))
        setPreparingRoads(false)
      }
      let path = '/runs',
        body: unknown = { scenario: frozenScenario, options }
      if (kind === 'experiment') {
        path = '/experiments'
        body = {
          scenario: frozenScenario,
          algorithms: experimentAlgos,
          seeds: experimentSeeds,
          time_limit_seconds: Math.min(10, options.time_limit_seconds),
          iterations: options.iterations,
          removal_fraction: options.removal_fraction,
          adaptive: options.adaptive,
          local_improvement: options.local_improvement,
        }
      } else if (kind === 'replan') {
        path = '/replans'
        body = {
          parent_job_id: jobId,
          vehicle_index: delayVehicle,
          completed_stops: completed,
          delay_minutes: delay,
          change_budget: changeBudget === '' ? null : Number(changeBudget),
          options,
        }
      }
      const created = await request<{ id: string }>(path, body)
      openJob(created.id, kind === 'experiment' ? 'experiments' : 'workspace')
      setMobileControls(false)
      await refreshLists()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      submissionLock.current = false
      setSubmitting(false)
      setPreparingRoads(false)
    }
  }

  function updateFleet(key: string, value: number | null) {
    setDraft((current) =>
      current ? { ...current, fleet: { ...current.fleet, [key]: value } } : null,
    )
  }

  async function save() {
    if (!draft) return
    try {
      await request('/scenarios', draft)
      await refreshLists()
      setNotice('Route saved.')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function importScenario(file?: File) {
    if (!file) return
    const sequence = ++loadSequence.current
    setSubmitting(true)
    try {
      const next = await upload(file)
      if (sequence !== loadSequence.current) {
        setNotice('Import ignored because the draft changed while loading.')
        return
      }
      replaceDraft(next)
      setNotice('Route imported. Review your fleet before solving.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function applyJSON() {
    const sequence = ++loadSequence.current
    setJsonBusy(true)
    setJsonError('')
    try {
      const next = JSON.parse(jsonText) as Scenario
      const validated = await upload(
        new File([JSON.stringify(next)], 'scenario.json', { type: 'application/json' }),
      )
      if (sequence !== loadSequence.current)
        throw new Error(
          'Draft changed while validating. Reopen the editor to avoid overwriting it.',
        )
      replaceDraft(validated)
      setJsonOpen(false)
      setNotice('Scenario validated and updated.')
    } catch (err) {
      setJsonError((err as Error).message)
    } finally {
      setJsonBusy(false)
    }
  }

  function updateNode(id: string, key: keyof Stop, value: number | string) {
    setDraft((current) =>
      current
        ? {
            ...current,
            matrix: ['latitude', 'longitude', 'x', 'y'].includes(key) ? null : current.matrix,
            nodes: current.nodes.map((node) => (node.id === id ? { ...node, [key]: value } : node)),
          }
        : null,
    )
  }

  function addStop() {
    if (!draft || draft.matrix || draft.nodes.length >= 101) return
    const depot = draft.nodes.find((node) => node.id === draft.depot_id)!
    const id = `s-${crypto.randomUUID().slice(0, 8)}`
    const node: Stop = {
      id,
      name: `Stop ${draft.nodes.length}`,
      x: Math.min(10000, depot.x + 1),
      y: depot.y,
      latitude: depot.latitude,
      longitude: depot.longitude == null ? null : Math.min(180, depot.longitude + 0.01),
      demand: 1,
      service_minutes: 5,
      window_start: draft.fleet.start_time,
      window_end: draft.fleet.end_time,
    }
    setUndoDraft(draft)
    setDraft({ ...draft, nodes: [...draft.nodes, node] })
    editDraft()
    setSelected(id)
    setNotice('Stop added.')
  }

  function removeStop(id: string) {
    if (
      !draft ||
      draft.matrix ||
      id === draft.depot_id ||
      (draft.coordinate_mode !== 'geographic' && draft.nodes.length <= 2)
    )
      return
    setUndoDraft(draft)
    setDraft({ ...draft, nodes: draft.nodes.filter((node) => node.id !== id) })
    setSelected(null)
    setNotice('Stop removed. Use Undo to restore it.')
  }

  async function loadSaved(id: string) {
    const sequence = ++loadSequence.current
    try {
      const snapshot = await request<Scenario>(`/scenarios/${id}`)
      if (sequence !== loadSequence.current) return
      replaceDraft(snapshot)
      setWorkflowStep('places')
    } catch (err) {
      if (sequence === loadSequence.current) setError((err as Error).message)
    }
  }

  function placeLocation(place: Place, kind: 'depot' | 'delivery') {
    if (!draft || jobId) return
    if (draft.matrix) {
      setError('Choose “Edit locations” in Places to unlock the map.')
      return
    }
    if (
      kind === 'delivery' &&
      draft.nodes.filter((n) => n.id !== draft.depot_id).length >= (roadConfig.max_customers ?? 25)
    ) {
      setError(
        'Delivery limit reached for this road service. Configure a local OSRM service for larger scenarios.',
      )
      return
    }
    if (kind === 'delivery' && !draft.nodes.some((n) => n.id === draft.depot_id)) {
      setError('Set your depot first, then add deliveries.')
      return
    }
    setUndoDraft(draft)
    setDraft(changePlace(draft, place, kind))
    setError('')
  }

  function moveLocation(id: string, latitude: number, longitude: number) {
    if (!draft || jobId || draft.matrix || Math.abs(latitude) > 85) return
    const lon = ((((longitude + 180) % 360) + 360) % 360) - 180
    setUndoDraft(draft)
    setDraft({
      ...draft,
      matrix: null,
      nodes: draft.nodes.map((n) => (n.id === id ? { ...n, latitude, longitude: lon } : n)),
    })
  }

  const heroTitle =
    page === 'history'
      ? 'History'
      : page === 'experiments'
        ? 'Compare algorithms'
        : scenario?.name || 'Plan a route'
  return (
    <div className="lab-app">
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault()
            setPage('workspace')
          }}
          aria-label="RouteLab home"
        >
          <span className="brand-mark" aria-hidden="true">
            <Icon name="route" />
          </span>
          <span>
            RouteLab<span className="brand-period">.</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {Object.entries(PAGES).map(([key, { icon, label }]) => (
            <button
              key={key}
              className={page === key ? 'nav-item active' : 'nav-item'}
              aria-label={label}
              aria-current={page === key ? 'page' : undefined}
              onClick={() => {
                setPage(key as Page)
                if (key === 'experiments') {
                  setTrial(null)
                  setTraceIndex(null)
                  setPlaying(false)
                }
              }}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="header-status">
          <span className={connected ? 'connection good' : 'connection'} role="status">
            <i />
            {connected ? 'Connected' : 'Offline'}
          </span>
        </div>
      </header>
      <main className="main-shell">
        <div
          className={`page-content ${scenario?.coordinate_mode === 'geographic' ? 'geographic-page' : ''}`}
        >
          <section className="page-heading">
            <div>
              <h1>{heroTitle}</h1>
              {page === 'workspace' && scenario && (
                <div className="route-summary">
                  <span>{Math.max(0, scenario.nodes.length - 1)} deliveries</span>
                  <span>
                    {scenario.fleet.count} {scenario.fleet.count === 1 ? 'vehicle' : 'vehicles'}
                  </span>
                  {scenario.travel_model !== 'road' && (
                    <span className="sample-badge">Sample route</span>
                  )}
                </div>
              )}
              {page === 'experiments' && draft && (
                <div className="route-summary">
                  <span>{draft.name}</span>
                </div>
              )}
            </div>
            {page !== 'history' && (
              <button
                className="secondary mobile-controls-toggle"
                aria-expanded={mobileControls}
                aria-controls="scenario-controls"
                onClick={() => setMobileControls((v) => !v)}
              >
                {mobileControls ? 'Hide settings' : 'Route settings'}
              </button>
            )}
          </section>
          {error && (
            <div role="alert" className="banner error">
              <span>{error}</span>
              <button onClick={() => setError('')} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="banner success">
              <span>{notice}</span>
              <button onClick={() => setNotice('')} aria-label="Dismiss notice">
                ×
              </button>
            </div>
          )}
          {page === 'history' ? (
            <section className="panel notebook">
              <div className="section-heading">
                <span className="count-badge">
                  {jobs.length} {jobs.length === 1 ? 'run' : 'runs'}
                </span>
                <button
                  className="secondary"
                  onClick={() => refreshLists().catch((err) => setError(err.message))}
                >
                  Refresh
                </button>
              </div>
              {jobs.length === 0 ? (
                <div className="empty-state">
                  <Icon name="clock" />
                  <h3>No runs yet</h3>
                  <p>Your solved routes and comparisons will appear here.</p>
                  <button className="primary" onClick={() => setPage('workspace')}>
                    Plan a route
                  </button>
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Route</th>
                        <th>Algorithm</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.name}</strong>
                          </td>
                          <td>
                            {item.kind === 'replan'
                              ? LABELS.onboard_repair
                              : LABELS[item.algorithm || ''] ||
                                (item.kind === 'experiment' ? 'Comparison' : item.kind)}
                          </td>
                          <td>
                            <span className={`status-pill ${item.status}`}>{item.status}</span>
                          </td>
                          <td>
                            {new Date(item.created * 1000).toLocaleString(undefined, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() =>
                                openJob(
                                  item.id,
                                  item.kind === 'experiment' ? 'experiments' : 'workspace',
                                )
                              }
                            >
                              Open ↗
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : (
            <div className="workbench">
              <WorkflowControls
                draft={draft}
                step={workflowStep}
                onStep={setWorkflowStep}
                mobileOpen={mobileControls}
                busy={submitting}
                preparing={preparingRoads}
                road={roadConfig}
                onNew={() => {
                  replaceDraft(newRoadScenario())
                  setUndoDraft(draft)
                  setWorkflowStep('places')
                }}
                onName={(name) => setDraft((s) => (s ? { ...s, name } : s))}
                onFleet={updateFleet}
                onSpeed={(speed_kph) => setDraft((s) => (s ? { ...s, speed_kph } : s))}
                selected={selected}
                onSelect={(id) => {
                  if (jobId) editDraft()
                  setSelected(id)
                }}
                onUpdateNode={updateNode}
                onRemove={removeStop}
                onAdd={addStop}
                onSave={save}
                onExport={() => draft && download('routelab-scenario.json', draft)}
                onJSON={() => {
                  setJsonText(JSON.stringify(draft, null, 2))
                  setJsonError('')
                  setJsonOpen(true)
                }}
                onImport={importScenario}
                fileRef={fileRef}
                presets={presets}
                onPreset={loadPreset}
                saved={saved}
                onSaved={loadSaved}
                options={options}
                onOptions={setOptions}
                available={available}
                onRun={() => launch('run')}
                stale={!!jobId}
                onEdit={editDraft}
                onDetach={() => {
                  if (!draft) return
                  setUndoDraft(draft)
                  setDraft({ ...draft, matrix: null })
                  editDraft()
                  setNotice(
                    draft.travel_model === 'road'
                      ? 'Locations unlocked. Road data will be rebuilt before the next solve.'
                      : 'Matrix detached. This benchmark now uses straight-line travel.',
                  )
                }}
                undo={!!undoDraft}
                onUndo={() => {
                  setDraft(undoDraft)
                  setUndoDraft(null)
                  editDraft()
                }}
              />
              <div className="workspace-content">
                {page === 'experiments' && (
                  <section className="panel experiment-config">
                    <div className="section-heading">
                      <div>
                        <h3>Choose algorithms</h3>
                      </div>
                      <span className="count-badge">
                        {experimentAlgos.length *
                          seeds.split(',').filter((seed) => seed.trim()).length}{' '}
                        trials
                      </span>
                    </div>
                    <div className="algorithm-chips">
                      {available.map((a) => (
                        <label
                          key={a}
                          className={experimentAlgos.includes(a) ? 'chip selected' : 'chip'}
                        >
                          <input
                            type="checkbox"
                            checked={experimentAlgos.includes(a)}
                            disabled={
                              a === 'exact' && !experimentAlgos.includes(a) && draftCustomers > 8
                            }
                            onChange={(e) =>
                              setExperimentAlgos((current) =>
                                e.target.checked ? [...current, a] : current.filter((x) => x !== a),
                              )
                            }
                          />
                          {LABELS[a]}
                        </label>
                      ))}
                    </div>
                    <div className="experiment-actions">
                      <label>
                        Seeds (comma-separated)
                        <input value={seeds} onChange={(e) => setSeeds(e.target.value)} />
                      </label>
                      <span className="subtle">
                        {Math.min(10, options.time_limit_seconds)}s cap / trial · max 120s total
                        budget
                      </span>
                      <button
                        className="primary"
                        disabled={
                          !comparisonReady ||
                          submitting ||
                          !experimentAlgos.length ||
                          (experimentAlgos.includes('exact') && draftCustomers > 8)
                        }
                        onClick={() => launch('experiment')}
                      >
                        <Icon name="flask" />
                        Compare routes
                      </button>
                    </div>
                    {experimentAlgos.includes('exact') && draftCustomers > 8 && (
                      <p role="status" className="footnote">
                        Exact reference supports up to 8 deliveries. Load a smaller route or remove
                        it from the comparison.
                      </p>
                    )}
                  </section>
                )}
                {isRunning && (
                  <section className="panel running-panel" role="status">
                    <div className="running-icon">
                      <Icon name="route" />
                    </div>
                    <div>
                      <strong>
                        {job?.status === 'queued'
                          ? 'Waiting to start'
                          : job?.kind === 'experiment'
                            ? `Trial ${(job.progress?.trial_index ?? 0) + 1} of ${job.progress?.trial_count ?? '…'}`
                            : 'Finding the best route…'}
                      </strong>
                      <p>
                        {job?.progress
                          ? `${job.progress.iteration || 0} iterations · ${number((job.progress.elapsed_ms || 0) / 1000)}s · ${job.progress.feasible ? `${job.progress.vehicles_used} vehicles / ${number(job.progress.distance_km)} km` : 'Checking delivery constraints…'}`
                          : 'Preparing your route…'}
                      </p>
                    </div>
                    <button
                      className="secondary"
                      onClick={async () => {
                        try {
                          await request(`/runs/${jobId}/cancel`, {})
                          setNotice('Cancellation requested.')
                        } catch (err) {
                          setError((err as Error).message)
                        }
                      }}
                    >
                      Cancel
                    </button>
                  </section>
                )}
                {job?.error && (
                  <div className="banner error" role="alert">
                    {job.error}
                  </div>
                )}
                {job?.status === 'cancelled' && (
                  <div className="banner neutral">
                    Run cancelled. The best route found so far is shown below.
                  </div>
                )}
                {stale && (
                  <div className="banner neutral">
                    <span>This saved run differs from your current draft.</span>
                    <button className="text-button" onClick={editDraft}>
                      Return to draft ↗
                    </button>
                  </div>
                )}
                {experiment && page === 'experiments' && !trial && (
                  <section className="panel">
                    <ExperimentView
                      experiment={experiment}
                      onTrial={(r, index) => {
                        setTrial({ result: r, index })
                        setPage('workspace')
                        setTraceIndex(null)
                        setSelected(null)
                        setFocused(null)
                      }}
                    />
                    <div className="export-strip">
                      <a href={`${API}/runs/${jobId}/export`}>Export JSON ↗</a>
                      <a href={`${API}/runs/${jobId}/export?format=csv`}>Export CSV ↗</a>
                    </div>
                  </section>
                )}
                {scenario && !(experiment && page === 'experiments' && !trial) && (
                  <>
                    {result && <Metrics result={result} />}
                    <section className="panel canvas-panel">
                      <div className="canvas-title">
                        <div>
                          <h2>
                            {scenario.coordinate_mode === 'geographic' ? 'Map' : 'Route layout'}
                          </h2>
                          {result && (
                            <span>
                              {LABELS[result.algorithm]}
                              {trial ? ` · trial ${trial.index + 1}` : ''}
                            </span>
                          )}
                        </div>
                        {result && (
                          <div className="canvas-actions">
                            <button
                              className="quiet"
                              onClick={() => {
                                replaceDraft({ ...result.scenario, execution: [] })
                                setNotice('Route copied to your draft.')
                              }}
                            >
                              Use as draft
                            </button>
                            <a className="quiet" href={`${API}/runs/${jobId}/export`}>
                              Export ↗
                            </a>
                          </div>
                        )}
                      </div>
                      {scenario.coordinate_mode === 'geographic' ? (
                        <Suspense
                          fallback={<div className="map-loading">Loading delivery map…</div>}
                        >
                          <GeographicMap
                            key={`${jobId || 'draft'}-${mapRevision}`}
                            scenario={scenario}
                            routes={routes}
                            selected={selected}
                            focused={focused}
                            onFocus={setFocused}
                            onSelect={(id) => {
                              setSelected(id)
                              if (!jobId) {
                                setWorkflowStep('constraints')
                                setMobileControls(true)
                              }
                            }}
                            configuration={roadConfig}
                            editable={!jobId && !scenario.matrix}
                            onPlace={placeLocation}
                            onMove={moveLocation}
                            replay={!!checkpoint}
                            geometryEnabled={!!result}
                          />
                        </Suspense>
                      ) : (
                        <RouteCanvas
                          scenario={scenario}
                          routes={routes}
                          selected={selected}
                          onSelect={setSelected}
                          focusedVehicle={focused}
                          onFocus={setFocused}
                          removed={checkpoint?.removed}
                        />
                      )}
                      {result && trace.length > 0 && (
                        <div className="replay-bar">
                          <button
                            className="replay-play"
                            onClick={() => {
                              setPlaying((p) => !p)
                              if (traceIndex === null) setTraceIndex(0)
                            }}
                            aria-label={playing ? 'Pause search replay' : 'Play search replay'}
                          >
                            {playing ? 'Ⅱ' : '▶'}
                          </button>
                          <div>
                            <span className="eyebrow">SEARCH REPLAY</span>
                            <small>
                              {checkpoint
                                ? `${checkpoint.operation} · ${number(checkpoint.elapsed_ms / 1000)}s${checkpoint.feasible ? '' : ' · partial candidate'}`
                                : 'Final validated result'}
                            </small>
                          </div>
                          <input
                            aria-label="Search checkpoint"
                            type="range"
                            min="0"
                            max={Math.max(0, trace.length - 1)}
                            value={traceIndex ?? trace.length - 1}
                            onChange={(e) => {
                              setTraceIndex(+e.target.value)
                              setPlaying(false)
                            }}
                          />
                          <span className="mono">
                            {(traceIndex ?? trace.length - 1) + 1}/{trace.length}
                          </span>
                          <button
                            className="text-button"
                            onClick={() => {
                              setTraceIndex(null)
                              setPlaying(false)
                            }}
                          >
                            Final
                          </button>
                        </div>
                      )}
                      {checkpoint && (
                        <div className="replay-note">
                          Replaying search. Metrics and schedules show the final result.
                        </div>
                      )}
                    </section>
                    {selectedNode && jobId && (
                      <section className="panel stop-inspector">
                        <div className="section-heading">
                          <div>
                            <span className="eyebrow">SELECTED STOP / {selectedNode.id}</span>
                            <h3>{selectedNode.name}</h3>
                            <p>
                              {selectedNode.demand} demand · {selectedNode.service_minutes}m service
                              · window {selectedNode.window_start}–{selectedNode.window_end}m
                            </p>
                          </div>
                          <button
                            className="quiet"
                            onClick={() => setSelected(null)}
                            aria-label="Close stop inspector"
                          >
                            ×
                          </button>
                        </div>
                        {result && (
                          <MoveInspector
                            key={`${jobId}-${trial?.index}-${selected}`}
                            result={result}
                            selected={selected}
                          />
                        )}
                      </section>
                    )}
                    {result && (
                      <section className="panel analysis-panel">
                        <div className="analysis-tabs">
                          {[
                            ['schedule', 'Schedule'],
                            ['search', 'Search'],
                            ['provenance', 'Run details'],
                            ['replan', 'Replan'],
                          ].map(([key, label]) => (
                            <button
                              key={key}
                              className={view === key ? 'active' : ''}
                              aria-pressed={view === key}
                              onClick={() => setView(key as typeof view)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {view === 'schedule' && (
                          <Schedule
                            result={result}
                            selected={selected}
                            onSelect={setSelected}
                            focused={focused}
                          />
                        )}
                        {view === 'search' && (
                          <div className="search-view">
                            <div className="section-heading">
                              <div>
                                <h3>Route improvement</h3>
                                <p>Best valid routes over time. Hover to see vehicles used.</p>
                              </div>
                            </div>
                            <Convergence history={result.history} />
                            {Object.keys(result.operator_stats).length > 0 && (
                              <div className="operator-grid">
                                {Object.entries(result.operator_stats).map(
                                  ([name, stats], index) => (
                                    <div key={name} className="operator-card">
                                      <span>
                                        <i style={{ background: color(index) }} />
                                        {name} removal
                                      </span>
                                      <strong>
                                        {stats.improvements}
                                        <small> new bests</small>
                                      </strong>
                                      <p>
                                        {stats.uses} uses · {stats.accepted} accepted · weight{' '}
                                        {number(stats.weight)}
                                      </p>
                                      <div className="operator-bar">
                                        <span
                                          style={{
                                            width: `${stats.uses ? (stats.accepted / stats.uses) * 100 : 0}%`,
                                            background: color(index),
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            )}
                            <details className="result-details">
                              <summary>How routes are ranked</summary>
                              <p>
                                Valid routes come first, followed by fewer vehicles and shorter
                                distance. The search may try worse routes to find a better result.
                              </p>
                            </details>
                          </div>
                        )}
                        {view === 'provenance' && <Provenance result={result} />}
                        {view === 'replan' && (
                          <div className="replan-view">
                            <div className="section-heading">
                              <div>
                                <h3>Simulate a delay</h3>
                                <p>
                                  Adjust remaining stops while keeping completed deliveries fixed.
                                </p>
                              </div>
                            </div>
                            {result.disruption ? (
                              <>
                                <div className="disruption-comparison">
                                  <div>
                                    <span>CONTINUE EXISTING PLAN</span>
                                    <strong
                                      className={
                                        result.disruption.continued.feasible ? 'teal' : 'red'
                                      }
                                    >
                                      {result.disruption.continued.feasible
                                        ? 'Feasible'
                                        : `${result.disruption.continued.violations.length} violations`}
                                    </strong>
                                    <p>{number(result.disruption.continued.distance_km)} km</p>
                                  </div>
                                  <Icon name="arrow" />
                                  <div>
                                    <span>REPAIR REMAINING SEQUENCE</span>
                                    <strong className={result.evaluation.feasible ? 'teal' : 'red'}>
                                      {result.evaluation.feasible
                                        ? 'Feasible'
                                        : `${result.evaluation.violations.length} violations`}
                                    </strong>
                                    <p>
                                      {number(result.evaluation.distance_km)} km ·{' '}
                                      {result.disruption.changed_successors} changed successors
                                    </p>
                                  </div>
                                </div>
                                <p className="method-note">{result.disruption.semantics}</p>
                              </>
                            ) : (
                              <>
                                <div className="node-editor">
                                  <label>
                                    Delayed vehicle
                                    <select
                                      value={delayVehicle}
                                      onChange={(e) => setDelayVehicle(+e.target.value)}
                                    >
                                      {result.routes.map((_, i) => (
                                        <option key={i} value={i}>
                                          Vehicle {i + 1}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label>
                                    Completed stops
                                    <input
                                      type="number"
                                      min="0"
                                      max={result.routes[delayVehicle]?.length || 0}
                                      value={completed}
                                      onChange={(e) => setCompleted(+e.target.value)}
                                    />
                                  </label>
                                  <label>
                                    Delay (minutes)
                                    <input
                                      type="number"
                                      min="0"
                                      max="480"
                                      value={delay}
                                      onChange={(e) => setDelay(+e.target.value)}
                                    />
                                  </label>
                                  <label>
                                    Changed-edge cap
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="Unlimited"
                                      value={changeBudget}
                                      onChange={(e) => setChangeBudget(e.target.value)}
                                    />
                                  </label>
                                </div>
                                <details className="result-details">
                                  <summary>Simulation rules</summary>
                                  <p>
                                    The delay begins after the selected stop. Vehicles finish their
                                    current leg before replanning. Deliveries stay on their assigned
                                    vehicle. Live traffic is excluded.
                                  </p>
                                </details>
                                <button
                                  className="primary"
                                  onClick={() => launch('replan')}
                                  disabled={
                                    submitting ||
                                    !result.evaluation.feasible ||
                                    !!trial ||
                                    job?.kind !== 'run'
                                  }
                                >
                                  Replan route <Icon name="arrow" />
                                </button>
                                {trial && (
                                  <p className="footnote">
                                    Run this scenario as a single saved run to create a disruption
                                    experiment.
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </section>
                    )}
                  </>
                )}
                {!scenario && (
                  <div className="panel empty-state">
                    <Icon name="route" />
                    <h3>{jobId ? 'Loading route…' : 'Connecting…'}</h3>
                    <p>
                      {jobId
                        ? 'Retrieving the saved route and results.'
                        : 'Start the backend and reconnect.'}
                    </p>
                    <button className="secondary" onClick={() => location.reload()}>
                      Reconnect
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      {jsonOpen && (
        <div className="modal-backdrop" onClick={() => !jsonBusy && setJsonOpen(false)}>
          <section
            className="json-modal"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="json-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <h3 id="json-title">Edit route JSON</h3>
              </div>
              <button
                className="quiet"
                aria-label="Close editor"
                disabled={jsonBusy}
                onClick={() => setJsonOpen(false)}
              >
                ×
              </button>
            </div>
            <textarea
              aria-label="Scenario JSON"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
            />
            {jsonError && (
              <p role="alert" className="red">
                {jsonError}
              </p>
            )}
            <div className="button-row">
              <button className="secondary" disabled={jsonBusy} onClick={() => setJsonOpen(false)}>
                Cancel
              </button>
              <button className="primary" disabled={jsonBusy} onClick={applyJSON}>
                {jsonBusy ? 'Validating…' : 'Validate & apply'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
