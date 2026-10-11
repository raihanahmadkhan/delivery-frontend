import type { Scenario, Stop } from './types'
import TimeField from './TimeField'

export default function StopEditor({
  scenario,
  node,
  onUpdate,
  onRemove,
}: {
  scenario: Scenario
  node: Stop
  onUpdate: (id: string, key: keyof Stop, value: number | string) => void
  onRemove: (id: string) => void
}) {
  const depot = node.id === scenario.depot_id
  const numeric = (key: keyof Stop, label: string, min: number, max: number, disabled = false) => (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step="any"
        disabled={disabled}
        value={node[key] ?? 0}
        onChange={(e) => onUpdate(node.id, key, +e.target.value)}
      />
    </label>
  )
  return (
    <>
      <div className="node-editor">
        <label className="stop-editor-name">
          Name
          <input
            value={node.name}
            maxLength={120}
            onChange={(e) => onUpdate(node.id, 'name', e.target.value)}
          />
        </label>
        {!depot && numeric('demand', 'Load (units)', 0, 100000)}
        {!depot && numeric('service_minutes', 'Service (min)', 0, 1440)}
        <TimeField
          label="Window start"
          value={node.window_start}
          onChange={(minutes) => onUpdate(node.id, 'window_start', minutes)}
        />
        <TimeField
          label="Window end"
          value={node.window_end}
          onChange={(minutes) => onUpdate(node.id, 'window_end', minutes)}
        />
      </div>
      {!depot && (
        <p className="footnote">Service starts within the delivery window. Early arrivals wait.</p>
      )}
      <details className="advanced-settings">
        <summary>Coordinates</summary>
        <div className="field-pair">
          {scenario.coordinate_mode === 'geographic' ? (
            <>
              {numeric('latitude', 'Latitude', -90, 90, !!scenario.matrix)}
              {numeric('longitude', 'Longitude', -180, 180, !!scenario.matrix)}
            </>
          ) : (
            <>
              {numeric('x', 'X (km)', -10000, 10000, !!scenario.matrix)}
              {numeric('y', 'Y (km)', -10000, 10000, !!scenario.matrix)}
            </>
          )}
        </div>
      </details>
      {!depot && (
        <button
          className="quiet red"
          disabled={
            !!scenario.matrix ||
            (scenario.coordinate_mode !== 'geographic' && scenario.nodes.length <= 2)
          }
          onClick={() => onRemove(node.id)}
        >
          Remove stop
        </button>
      )}
      {!!scenario.matrix && (
        <p className="footnote">
          Locations are locked. Use “Edit locations” in Places to change them.
        </p>
      )}
    </>
  )
}
