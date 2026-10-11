import { useEffect, useRef, type RefObject } from 'react'
import type { Algorithm, MapConfiguration, Options, Preset, Scenario, Stop } from './types'
import { LABELS } from './ResultViews'
import StopEditor from './StopEditor'
import TimeField from './TimeField'

export type WorkflowStep = 'places' | 'fleet' | 'constraints' | 'solve'
const steps: WorkflowStep[] = ['places', 'fleet', 'constraints', 'solve']
type Props = {
  draft: Scenario | null
  step: WorkflowStep
  onStep: (step: WorkflowStep) => void
  onNew: () => void
  onName: (name: string) => void
  onFleet: (key: string, value: number | null) => void
  onSpeed: (speed: number) => void
  onSelect: (id: string) => void
  selected: string | null
  onUpdateNode: (id: string, key: keyof Stop, value: number | string) => void
  onRemove: (id: string) => void
  onAdd: () => void
  onSave: () => void
  onExport: () => void
  onJSON: () => void
  onImport: (file?: File) => void
  fileRef: RefObject<HTMLInputElement | null>
  presets: Preset[]
  onPreset: (id: string) => void
  saved: { id: string; name: string; created?: number }[]
  onSaved: (id: string) => void
  options: Options
  onOptions: (options: Options) => void
  available: Algorithm[]
  busy: boolean
  onRun: () => void
  road: MapConfiguration
  mobileOpen: boolean
  onDetach: () => void
  undo: boolean
  onUndo: () => void
  preparing: boolean
  stale: boolean
  onEdit: () => void
}

export default function WorkflowControls(p: Props) {
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0
  }, [p.step])
  const s = p.draft
  const road = s?.travel_model === 'road'
  const depot = s?.nodes.find((n) => n.id === s.depot_id)
  const customers = s?.nodes.filter((n) => n.id !== s.depot_id) ?? []
  const node = s?.nodes.find((n) => n.id === p.selected)
  const maxCustomers = road && !s?.matrix ? (p.road.max_customers ?? 25) : 100
  const ready = !!depot && customers.length > 0 && customers.length <= maxCustomers
  const algorithmReady =
    p.available.includes(p.options.algorithm) &&
    (p.options.algorithm !== 'exact' || customers.length <= 8)
  const setOption = <K extends keyof Options>(key: K, value: Options[K]) =>
    p.onOptions({ ...p.options, [key]: value })
  const field = (
    key: 'count' | 'capacity' | 'max_distance_km',
    label: string,
    min: number,
    max: number,
  ) => (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={s?.fleet[key] ?? ''}
        placeholder={key === 'max_distance_km' ? 'No limit' : undefined}
        onChange={(e) =>
          p.onFleet(
            key,
            e.target.value === '' && key === 'max_distance_km' ? null : +e.target.value,
          )
        }
      />
    </label>
  )
  return (
    <aside
      id="scenario-controls"
      aria-label="Route setup"
      className={`controls panel workflow-controls ${p.mobileOpen ? 'mobile-open' : ''}`}
    >
      <div className="workflow-title">
        <span className="eyebrow">ROUTE SETUP</span>
        <button className="text-button" aria-label="New route" onClick={p.onNew}>
          + New
        </button>
      </div>
      <nav className="workflow-steps" aria-label="Route setup">
        {steps.map((step, index) => (
          <button
            key={step}
            className={step === p.step ? 'active' : ''}
            aria-current={step === p.step ? 'step' : undefined}
            onClick={() => p.onStep(step)}
          >
            <span>0{index + 1}</span>
            {step[0].toUpperCase() + step.slice(1)}
          </button>
        ))}
      </nav>
      <div className="control-body" ref={body}>
        {p.stale && (
          <div className="draft-context">
            <p>Viewing a saved run.</p>
            <button className="text-button" onClick={p.onEdit}>
              Return to draft →
            </button>
          </div>
        )}
        {s && p.step === 'places' && (
          <>
            <div className="control-section">
              <label>
                Route name
                <input value={s.name} maxLength={120} onChange={(e) => p.onName(e.target.value)} />
              </label>
              {s.coordinate_mode === 'geographic' && !customers.length && (
                <p className="workflow-help">
                  {depot
                    ? 'Add your first delivery on the map.'
                    : 'Search or click the map to add a depot.'}
                </p>
              )}
              <div className="places-summary">
                <span>{depot ? 'Depot ready' : 'Depot needed'}</span>
                <span>
                  {customers.length} {customers.length === 1 ? 'delivery' : 'deliveries'}
                </span>
              </div>
              {s.coordinate_mode === 'cartesian' && (
                <button
                  className="secondary"
                  disabled={!!s.matrix || customers.length >= 100}
                  onClick={p.onAdd}
                >
                  + Add stop
                </button>
              )}
              <div className="stop-list">
                {s.nodes.map((stop) => (
                  <button
                    key={stop.id}
                    className={p.selected === stop.id ? 'stop-list-row selected' : 'stop-list-row'}
                    onClick={() => {
                      p.onSelect(stop.id)
                      p.onStep('constraints')
                    }}
                  >
                    <span className={stop.id === s.depot_id ? 'stop-number depot' : 'stop-number'}>
                      {stop.id === s.depot_id
                        ? 'D'
                        : customers.findIndex((n) => n.id === stop.id) + 1}
                    </span>
                    <span>
                      {stop.name}
                      <small>
                        {stop.id === s.depot_id
                          ? 'Start & return'
                          : `${stop.demand} units · ${stop.service_minutes} min`}
                      </small>
                    </span>
                    <span>›</span>
                  </button>
                ))}
              </div>
              {customers.length > maxCustomers && (
                <p role="alert" className="red">
                  Limit: {maxCustomers} deliveries. Remove stops or use a local road service.
                </p>
              )}
            </div>
            {!!s.matrix && (
              <div className="control-section">
                <span className="eyebrow">SAVED TRAVEL DATA</span>
                <p className="footnote">Locations are locked to this travel snapshot.</p>
                <button className="secondary" onClick={p.onDetach}>
                  Edit locations
                </button>
              </div>
            )}
            {p.undo && (
              <button className="text-button" onClick={p.onUndo}>
                Undo location edit
              </button>
            )}
          </>
        )}
        {s && p.step === 'fleet' && (
          <div className="control-section">
            <h3>Vehicles</h3>
            {field('count', 'Vehicle count', 1, 25)}
            {field('capacity', 'Capacity each (units)', 0.01, 100000)}
            <div className="fleet-summary">
              <strong>{customers.reduce((sum, n) => sum + n.demand, 0)} units to deliver</strong>
              <p>{s.fleet.count * s.fleet.capacity} units available</p>
            </div>
          </div>
        )}
        {s && p.step === 'constraints' && (
          <>
            <div className="control-section">
              <h3>Shift</h3>
              <div className="field-pair">
                <TimeField
                  label="Shift start"
                  value={s.fleet.start_time}
                  onChange={(minutes) => p.onFleet('start_time', minutes)}
                />
                <TimeField
                  label="Shift end"
                  value={s.fleet.end_time}
                  onChange={(minutes) => p.onFleet('end_time', minutes)}
                />
              </div>
              {field('max_distance_km', 'Distance limit per vehicle (km)', 0.01, 100000)}
            </div>
            <div className="control-section">
              <label>
                Stop details
                <select value={node?.id ?? ''} onChange={(e) => p.onSelect(e.target.value)}>
                  <option value="">Select a stop…</option>
                  {s.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </label>
              {node && (
                <StopEditor
                  scenario={s}
                  node={node}
                  onUpdate={p.onUpdateNode}
                  onRemove={p.onRemove}
                />
              )}
            </div>
          </>
        )}
        {s && p.step === 'solve' && (
          <>
            <div className="control-section">
              <label>
                Algorithm
                <select
                  value={p.options.algorithm}
                  onChange={(e) => setOption('algorithm', e.target.value as Algorithm)}
                >
                  {p.available.map((a) => (
                    <option key={a} value={a} disabled={a === 'exact' && customers.length > 8}>
                      {LABELS[a]}
                      {a === 'exact' ? ' · up to 8 deliveries' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Time limit (seconds)
                <input
                  type="number"
                  min="0.05"
                  max="30"
                  step="0.5"
                  value={p.options.time_limit_seconds}
                  onChange={(e) => setOption('time_limit_seconds', +e.target.value)}
                />
              </label>
              <details className="advanced-settings">
                <summary>Advanced settings</summary>
                <label>
                  Random seed
                  <input
                    type="number"
                    min="0"
                    value={p.options.seed}
                    onChange={(e) => setOption('seed', +e.target.value)}
                  />
                </label>
                {p.options.algorithm === 'alns' && (
                  <>
                    <label>
                      Max iterations
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={p.options.iterations}
                        onChange={(e) => setOption('iterations', +e.target.value)}
                      />
                    </label>
                    <label>
                      Stops removed per iteration · {Math.round(p.options.removal_fraction * 100)}%
                      <input
                        type="range"
                        min="0.05"
                        max="0.6"
                        step="0.05"
                        value={p.options.removal_fraction}
                        onChange={(e) => setOption('removal_fraction', +e.target.value)}
                      />
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={p.options.adaptive}
                        onChange={(e) => setOption('adaptive', e.target.checked)}
                      />
                      Adaptive operator weights
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={p.options.local_improvement}
                        onChange={(e) => setOption('local_improvement', e.target.checked)}
                      />
                      Local improvement
                    </label>
                  </>
                )}
              </details>
              <details className="advanced-settings road-readiness">
                <summary>Travel data</summary>
                <strong>
                  {s.matrix
                    ? road
                      ? 'Saved road network'
                      : 'Imported travel matrix'
                    : road
                      ? 'Road network'
                      : 'Straight-line distances'}
                </strong>
                {!road && (
                  <p>{s.matrix ? `Source: ${s.matrix.source}` : 'Uses a constant travel speed.'}</p>
                )}
                {!road && !s.matrix && (
                  <label>
                    Speed (km/h)
                    <input
                      type="number"
                      min="0.01"
                      max="200"
                      value={s.speed_kph}
                      onChange={(e) => p.onSpeed(+e.target.value)}
                    />
                  </label>
                )}
              </details>
              {road && !s.matrix && !p.road.configured && (
                <p role="alert" className="red">
                  Road service unavailable. Check the API connection.
                </p>
              )}
            </div>
          </>
        )}
        {s && (
          <details className="scenario-library">
            <summary>Files & samples</summary>
            <label>
              Sample routes
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) p.onPreset(e.target.value)
                  e.target.value = ''
                }}
              >
                <option value="">Load a sample…</option>
                {p.presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} · {preset.customers} stops
                  </option>
                ))}
              </select>
            </label>
            <label>
              Saved routes
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) p.onSaved(e.target.value)
                  e.target.value = ''
                }}
              >
                <option value="">Open a saved route…</option>
                {p.saved.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ·{' '}
                    {item.created != null
                      ? new Date(item.created * 1000).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : item.id.slice(0, 6)}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button className="secondary" disabled={!ready} onClick={p.onSave}>
                Save route
              </button>
              <button className="quiet" onClick={p.onExport}>
                Export
              </button>
            </div>
            <input
              hidden
              ref={p.fileRef}
              type="file"
              accept=".json,.csv,.txt"
              onChange={(e) => p.onImport(e.target.files?.[0])}
            />
            <div className="button-row">
              <button className="secondary" onClick={() => p.fileRef.current?.click()}>
                Import file
              </button>
              <button className="quiet" onClick={p.onJSON}>
                Edit JSON
              </button>
            </div>
            <p className="footnote">Import a JSON or CSV file.</p>
          </details>
        )}
      </div>
      <div className="run-controls">
        {p.step !== 'solve' ? (
          <button className="primary" onClick={() => p.onStep(steps[steps.indexOf(p.step) + 1])}>
            Next: {steps[steps.indexOf(p.step) + 1]} →
          </button>
        ) : (
          <button
            className="primary"
            disabled={
              !ready || !algorithmReady || p.busy || (road && !s?.matrix && !p.road.configured)
            }
            onClick={p.onRun}
          >
            {p.preparing ? 'Preparing roads…' : p.busy ? 'Submitting…' : 'Plan routes →'}
          </button>
        )}
        {!ready && p.step === 'solve' && (
          <small role="status">
            {customers.length > maxCustomers
              ? `Remove ${customers.length - maxCustomers} stops to continue.`
              : 'Add a depot and at least one delivery.'}
          </small>
        )}
        {ready && !algorithmReady && p.step === 'solve' && (
          <small role="status">
            {p.options.algorithm === 'exact' && customers.length > 8
              ? 'Exact reference supports up to 8 deliveries. Choose another algorithm.'
              : 'Choose an available algorithm.'}
          </small>
        )}
      </div>
    </aside>
  )
}
