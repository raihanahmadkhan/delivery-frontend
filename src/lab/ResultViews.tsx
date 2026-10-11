import { useState } from 'react'
import type { Result, Experiment, Checkpoint } from './types'
import { color } from './RouteCanvas'
import { request } from './api'

export const number = (value: number | null | undefined, digits = 2) =>
  value == null
    ? 'N/A'
    : value.toLocaleString(undefined, {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      })
const clock = (value: number) =>
  `${value >= 1440 ? `Day ${Math.floor(value / 1440) + 1} ` : ''}${Math.floor((value % 1440) / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(value % 60)
    .toString()
    .padStart(2, '0')}`
export const LABELS: Record<string, string> = {
  greedy: 'Cheapest insertion',
  local_search: 'Insertion + local search',
  alns: 'Adaptive neighborhood search',
  exact: 'Exact reference',
  ortools: 'OR-Tools reference',
  onboard_repair: 'Onboard sequence repair',
}

export function Metrics({ result }: { result: Result }) {
  const ev = result.evaluation
  return (
    <div className="metric-grid">
      <div className="metric">
        <span>Status</span>
        <strong className={ev.feasible ? 'teal' : 'amber'}>
          {ev.feasible ? (result.proven_optimal ? 'Proven optimal' : 'Feasible') : 'Not feasible'}
        </strong>
        <small>
          {ev.feasible ? 'Schedule checked' : `${ev.violations.length} constraint issues`}
        </small>
      </div>
      <div className="metric">
        <span>Vehicles</span>
        <strong>
          {ev.vehicles_used}
          <em> / {result.scenario.fleet.count}</em>
        </strong>
      </div>
      <div className="metric">
        <span>Distance</span>
        <strong>
          {number(ev.distance_km)}
          <em> km</em>
        </strong>
      </div>
      <div className="metric">
        <span>Run time</span>
        <strong>
          {number(result.solver_time_ms / 1000)}
          <em> s</em>
        </strong>
        <small>{result.evaluations.toLocaleString()} checks</small>
      </div>
    </div>
  )
}

export function Schedule({
  result,
  selected,
  onSelect,
  focused,
}: {
  result: Result
  selected: string | null
  onSelect: (id: string) => void
  focused: number | null
}) {
  const scenario = result.scenario
  const nodes = new Map(scenario.nodes.map((node) => [node.id, node]))
  const vehicles = result.evaluation.vehicles.filter(
    (vehicle) => focused === null || vehicle.vehicle_index === focused,
  )
  const horizon = Math.max(1, scenario.fleet.end_time, ...vehicles.map((v) => v.return_time))
  return (
    <div className="schedule-view">
      <div className="section-heading">
        <div>
          <h3>Schedule</h3>
        </div>
        <div className="timeline-key">
          <span>
            <i className="travel-key" />
            Travel
          </span>
          <span>
            <i className="service-key" />
            Service
          </span>
          <span>
            <i className="wait-key" />
            Wait
          </span>
        </div>
      </div>
      {result.evaluation.violations.length > 0 && (
        <div className="validation-box" role="status">
          <h4>Constraint issues</h4>
          {result.evaluation.violations.map((v, i) => (
            <p key={i}>
              <b>{v.vehicle_index == null ? 'Scenario' : `V${v.vehicle_index + 1}`}</b> {v.message}
              {v.amount > 0 ? ` (${number(v.amount)})` : ''}
            </p>
          ))}
        </div>
      )}
      {!vehicles.length && <p className="empty-small">No routes to show.</p>}
      {vehicles.map((vehicle) => (
        <div key={vehicle.vehicle_index} className="vehicle-schedule">
          <div className="vehicle-title">
            <span>
              <i style={{ background: color(vehicle.vehicle_index) }} />
              Vehicle {vehicle.vehicle_index + 1}
            </span>
            <span className="subtle">
              {number(vehicle.distance_km)} km · {number(vehicle.initial_load, 0)}/
              {number(vehicle.capacity, 0)} load · back {clock(vehicle.return_time)}
            </span>
          </div>
          <div className="timeline" aria-label={`Vehicle ${vehicle.vehicle_index + 1} schedule`}>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <span key={t} className="time-grid" style={{ left: `${t * 100}%` }}>
                <small>{clock(t * horizon)}</small>
              </span>
            ))}
            {vehicle.schedule.map((stop, i) => (
              <div key={i}>
                <span
                  className="time-segment travel"
                  style={{
                    left: `${((stop.arrival - stop.travel_minutes) / horizon) * 100}%`,
                    width: `${(stop.travel_minutes / horizon) * 100}%`,
                    background: color(vehicle.vehicle_index),
                  }}
                  title={`${number(stop.travel_minutes)} min travel`}
                />
                {stop.waiting > 0 && (
                  <span
                    className="time-segment waiting"
                    style={{
                      left: `${(stop.arrival / horizon) * 100}%`,
                      width: `${(stop.waiting / horizon) * 100}%`,
                    }}
                    title={`${number(stop.waiting)} min waiting`}
                  />
                )}
                {stop.service_minutes > 0 && (
                  <button
                    className={`time-segment service ${selected === stop.node_id ? 'selected' : ''}`}
                    style={{
                      left: `${(stop.service_start / horizon) * 100}%`,
                      width: `${Math.max(0.4, (stop.service_minutes / horizon) * 100)}%`,
                      background: color(vehicle.vehicle_index),
                    }}
                    onClick={() => onSelect(stop.node_id)}
                    aria-label={`Inspect ${nodes.get(stop.node_id)?.name}`}
                    title={`${nodes.get(stop.node_id)?.name}: ${clock(stop.service_start)}`}
                  />
                )}
                {stop.disruption_minutes > 0 && (
                  <span
                    className="time-segment waiting"
                    style={{
                      left: `${((stop.departure - stop.disruption_minutes) / horizon) * 100}%`,
                      width: `${(stop.disruption_minutes / horizon) * 100}%`,
                    }}
                    title="Disruption delay"
                  />
                )}
              </div>
            ))}
          </div>
          <details className="result-details">
            <summary>Stop details · {vehicle.customers.length} deliveries</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Stop</th>
                    <th>Arrival</th>
                    <th>Window</th>
                    <th>Service</th>
                    <th>Departure</th>
                    <th title="Time left before the delivery deadline">Slack</th>
                    <th>Load left</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicle.schedule.map((stop, index) => (
                    <tr key={index} className={selected === stop.node_id ? 'selected-row' : ''}>
                      <td>
                        <button className="text-button" onClick={() => onSelect(stop.node_id)}>
                          {index === 0
                            ? '↗ '
                            : index === vehicle.schedule.length - 1
                              ? '↙ '
                              : `${index}. `}
                          {nodes.get(stop.node_id)?.name}
                        </button>
                      </td>
                      <td>{clock(stop.arrival)}</td>
                      <td>
                        {clock(nodes.get(stop.node_id)!.window_start)}–
                        {clock(nodes.get(stop.node_id)!.window_end)}
                      </td>
                      <td>{number(stop.service_minutes, 0)}m</td>
                      <td>{clock(stop.departure)}</td>
                      <td className={stop.slack < 0 ? 'red' : ''}>{number(stop.slack, 1)}m</td>
                      <td>{number(stop.load_remaining, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      ))}
    </div>
  )
}

export function Convergence({ history }: { history: Checkpoint[] }) {
  const points = history.filter((point) => point.feasible)
  if (!points.length) return <div className="empty-small">No feasible route found yet.</div>
  const maxTime = Math.max(1, ...points.map((p) => p.elapsed_ms))
  const distances = points.map((p) => p.distance_km)
  const low = Math.min(...distances) * 0.97,
    high = Math.max(...distances) * 1.03 + 0.01
  const x = (p: Checkpoint) => 55 + (p.elapsed_ms / maxTime) * 690
  const y = (p: Checkpoint) => 155 - ((p.distance_km - low) / (high - low)) * 120
  const path = points
    .map((p, i) => (i === 0 ? `M ${x(p)} ${y(p)}` : `H ${x(p)} V ${y(p)}`))
    .join(' ')
  return (
    <div className="convergence">
      <svg
        viewBox="0 0 800 200"
        role="img"
        aria-label="Distance of feasible incumbents over elapsed time"
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="55"
              y1={155 - t * 120}
              x2="745"
              y2={155 - t * 120}
              stroke="currentColor"
              opacity="0.15"
            />
            <text x="45" y={159 - t * 120} textAnchor="end" fill="currentColor" fontSize="11">
              {number(low + t * (high - low), 1)}
            </text>
          </g>
        ))}
        <path d={path} stroke={color(0)} strokeWidth="3" fill="none" />
        {points.map((p, i) => (
          <circle key={i} cx={x(p)} cy={y(p)} r="3" fill={color(0)}>
            <title>
              {number(p.elapsed_ms / 1000)}s · {p.vehicles_used} vehicles · {number(p.distance_km)}{' '}
              km
            </title>
          </circle>
        ))}
        <text x="55" y="185" fill="currentColor" fontSize="11">
          0s
        </text>
        <text x="745" y="185" textAnchor="end" fill="currentColor" fontSize="11">
          {number(maxTime / 1000)}s elapsed
        </text>
        <text x="56" y="17" fill="currentColor" fontSize="10">
          DISTANCE (km) · VEHICLE COUNT MAY CHANGE
        </text>
      </svg>
    </div>
  )
}

export function ExperimentView({
  experiment,
  onTrial,
}: {
  experiment: Experiment
  onTrial: (result: Result, index: number) => void
}) {
  return (
    <div className="experiment-view">
      <div className="section-heading">
        <div>
          <h3>Comparison</h3>
          <p>
            {experiment.completed_trials} / {experiment.planned_trials} trials ·{' '}
            {number(experiment.total_time_ms / 1000)}s total
          </p>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Algorithm</th>
              <th>Feasible</th>
              <th>Vehicles</th>
              <th>Median km¹</th>
              <th>Range km¹</th>
              <th title="Sample standard deviation">Spread km¹</th>
              <th>Median time</th>
            </tr>
          </thead>
          <tbody>
            {experiment.summary.map((row) => (
              <tr key={row.algorithm}>
                <td>{LABELS[row.algorithm]}</td>
                <td>
                  {row.feasible_runs}/{row.runs}
                </td>
                <td>
                  {row.min_vehicles ?? 'N/A'}–{row.max_vehicles ?? 'N/A'}
                </td>
                <td>{number(row.median_distance_at_min_vehicles)}</td>
                <td>
                  {number(row.min_distance_at_min_vehicles)}–
                  {number(row.max_distance_at_min_vehicles)}
                </td>
                <td>{number(row.distance_stdev_at_min_vehicles)}</td>
                <td>
                  {row.median_solver_ms == null ? 'N/A' : `${number(row.median_solver_ms / 1000)}s`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="result-details">
        <summary>How to read the comparison</summary>
        <p className="footnote">
          ¹ Distance uses feasible trials at each algorithm’s lowest vehicle count. Compare distance
          only when vehicle counts match. Spread is sample standard deviation.
        </p>
        <p className="method-note">{experiment.methodology}</p>
      </details>
      {!!experiment.paired_comparisons?.length && (
        <details className="result-details">
          <summary>Matched seed comparison</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Algorithms</th>
                  <th>Wins</th>
                  <th>Ties</th>
                  <th>Losses</th>
                  <th>Both infeasible</th>
                  <th>Errors / missing</th>
                </tr>
              </thead>
              <tbody>
                {experiment.paired_comparisons.map((row) => (
                  <tr key={row.algorithm}>
                    <td>
                      {LABELS[row.algorithm]} vs {LABELS[row.baseline]}
                    </td>
                    <td>{row.wins}</td>
                    <td>{row.ties}</td>
                    <td>{row.losses}</td>
                    <td>{row.both_infeasible}</td>
                    <td>{row.missing_or_error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="footnote">
              Trials share a seed. Results are ranked by feasibility, vehicles, then distance.
              Counts do not establish statistical significance.
            </p>
          </div>
        </details>
      )}
      <h4>Trials</h4>
      <div className="trial-grid">
        {experiment.trials.map((trial, index) => (
          <button
            className="trial-card"
            key={index}
            onClick={() => trial.evaluation && onTrial(trial, index)}
            disabled={!trial.evaluation}
            aria-label={`Open ${LABELS[trial.algorithm] ?? trial.algorithm} trial, seed ${trial.options.seed}`}
          >
            <span>{LABELS[trial.algorithm] ?? trial.algorithm}</span>
            <small>Seed {trial.options.seed}</small>
            <strong>
              {trial.evaluation
                ? `${trial.evaluation.vehicles_used} ${trial.evaluation.vehicles_used === 1 ? 'vehicle' : 'vehicles'} / ${number(trial.evaluation.distance_km)} km`
                : trial.error}
            </strong>
            <span className={`trial-status ${trial.evaluation?.feasible ? 'teal' : 'red'}`}>
              {trial.evaluation
                ? trial.evaluation.feasible
                  ? trial.proven_optimal
                    ? 'Proven optimal →'
                    : 'Feasible →'
                  : 'Not feasible →'
                : trial.status.replaceAll('_', ' ')}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function MoveInspector({ result, selected }: { result: Result; selected: string | null }) {
  const [target, setTarget] = useState(0)
  const [position, setPosition] = useState(1)
  const [report, setReport] = useState<{
    evaluation?: Result['evaluation']
    error?: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  async function inspect() {
    if (!selected || selected === result.scenario.depot_id) return
    setBusy(true)
    try {
      const routes = result.routes.map((route) => route.filter((id) => id !== selected))
      while (routes.length <= target) routes.push([])
      routes[target].splice(Math.min(Math.max(0, position - 1), routes[target].length), 0, selected)
      const response = await request<{ evaluation: Result['evaluation'] }>('/evaluate', {
        scenario: result.scenario,
        routes,
      })
      setReport(response)
    } catch (error) {
      setReport({ error: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="move-inspector">
      <h4>Try a move</h4>
      <div className="inline-controls">
        <label>
          Vehicle
          <select
            value={target}
            disabled={busy}
            onChange={(e) => {
              setTarget(+e.target.value)
              setReport(null)
            }}
          >
            {Array.from({ length: result.scenario.fleet.count }, (_, i) => (
              <option key={i} value={i}>
                Vehicle {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          Position
          <input
            type="number"
            min="1"
            max="101"
            value={position}
            disabled={busy}
            onChange={(e) => {
              setPosition(+e.target.value)
              setReport(null)
            }}
          />
        </label>
        <button
          className="secondary"
          onClick={inspect}
          disabled={busy || !selected || selected === result.scenario.depot_id}
        >
          {busy ? 'Checking…' : 'Check move'}
        </button>
      </div>
      {report?.error && <p className="red">{report.error}</p>}
      {report?.evaluation && (
        <div className="move-report">
          <strong className={report.evaluation.feasible ? 'teal' : 'red'}>
            {report.evaluation.feasible ? 'Feasible move' : 'Constraint issues'}
          </strong>
          <p>
            {report.evaluation.vehicles_used} vehicles · {number(report.evaluation.distance_km)} km
            · Δ {number(report.evaluation.distance_km - result.evaluation.distance_km)} km
          </p>
          {report.evaluation.violations.map((v, i) => (
            <p key={i}>{v.message}</p>
          ))}
        </div>
      )}
    </div>
  )
}

export function Provenance({ result }: { result: Result }) {
  const searchStatus: Record<string, string> = {
    completed: 'Completed',
    time_limit: 'Time limit reached',
    iteration_limit: 'Search limit reached',
    cancelled: 'Cancelled',
    no_unlocked_moves: 'Remaining stops cannot be reordered',
  }
  const planQuality = result.evaluation.feasible
    ? result.proven_optimal
      ? 'Optimal plan confirmed'
      : 'Valid plan · optimality not verified'
    : result.status === 'proven_infeasible'
      ? 'No valid plan is possible with these constraints'
      : 'No valid plan found'

  return (
    <div className="provenance">
      <h3>Run details</h3>
      <dl>
        <dt>Method</dt>
        <dd>{LABELS[result.algorithm] ?? 'Route optimization'}</dd>
        <dt>Search status</dt>
        <dd>{searchStatus[result.termination_reason] ?? 'Finished'}</dd>
        <dt>Plan quality</dt>
        <dd>{planQuality}</dd>
      </dl>
    </div>
  )
}
