import { useId, useMemo } from 'react'
import type { Scenario } from './types'

export const COLORS = [
  '#5947b1',
  '#246143',
  '#a33b30',
  '#274d8a',
  '#745117',
  '#73518a',
  '#8c405e',
  '#276568',
]
export const color = (index: number) => COLORS[index % COLORS.length]

export default function RouteCanvas({
  scenario,
  routes,
  selected,
  onSelect,
  focusedVehicle,
  onFocus,
  removed = [],
}: {
  scenario: Scenario
  routes: string[][]
  selected: string | null
  onSelect: (id: string) => void
  focusedVehicle: number | null
  onFocus: (index: number | null) => void
  removed?: string[]
}) {
  const uid = useId().replace(/:/g, '')
  const projected = useMemo(() => {
    const xs = scenario.nodes.map((n) => n.x),
      ys = scenario.nodes.map((n) => n.y)
    const minX = Math.min(...xs),
      minY = Math.min(...ys)
    const width = Math.max(...xs) - minX,
      height = Math.max(...ys) - minY
    const scale = Math.min(680 / Math.max(width, 1), 360 / Math.max(height, 1))
    return scenario.nodes.map((node) => ({
      ...node,
      sx: 60 + (680 - width * scale) / 2 + (node.x - minX) * scale,
      sy: 420 - (360 - height * scale) / 2 - (node.y - minY) * scale,
    }))
  }, [scenario])
  const nodeMap = new Map(projected.map((node) => [node.id, node]))
  const deliveries = projected.filter((node) => node.id !== scenario.depot_id)
  const membership = new Map(
    routes.flatMap((route, index) =>
      route.map((id, position) => [id, { index, position }] as const),
    ),
  )
  return (
    <div className="canvas-wrap">
      <div className="canvas-heading">
        <span className="eyebrow">SCHEMATIC · KM</span>
        <span className="subtle">
          {scenario.matrix ? 'Imported travel data' : 'Straight-line distances'}
        </span>
      </div>
      <svg
        className="route-canvas"
        viewBox="0 0 800 480"
        role="group"
        aria-label="Delivery routes. Select a customer to inspect its schedule."
      >
        <defs>
          <pattern id={`${uid}-grid`} width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#d6d6d0" strokeWidth="0.6" />
          </pattern>
          {COLORS.map((c, i) => (
            <marker
              key={c}
              id={`${uid}-arrow-${i}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
            </marker>
          ))}
        </defs>
        <rect width="800" height="480" fill="#f3f3ee" />
        <rect width="800" height="480" fill={`url(#${uid}-grid)`} />
        <text x="22" y="455" className="canvas-axis">
          N ↑
        </text>
        <text x="740" y="455" className="canvas-axis">
          E →
        </text>
        {routes.map((route, index) => {
          const points = [scenario.depot_id, ...route, scenario.depot_id]
            .map((id) => nodeMap.get(id))
            .filter(Boolean)
          return (
            <g
              key={index}
              opacity={focusedVehicle === null || focusedVehicle === index ? 0.82 : 0.12}
            >
              {points.slice(0, -1).map((from, i) => {
                const to = points[i + 1]!
                return (
                  <line
                    key={i}
                    x1={from!.sx}
                    y1={from!.sy}
                    x2={to.sx}
                    y2={to.sy}
                    stroke={color(index)}
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                    markerEnd={`url(#${uid}-arrow-${index % COLORS.length})`}
                  />
                )
              })}
            </g>
          )
        })}
        {projected.map((node) => {
          const depot = node.id === scenario.depot_id
          const member = membership.get(node.id)
          const c = depot ? '#19191b' : member ? color(member.index) : '#666666'
          const isSelected = selected === node.id
          return (
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={`${node.name}, ${depot ? 'depot' : `demand ${node.demand}`}`}
              onClick={() => onSelect(node.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(node.id)
                }
              }}
              className="map-node"
              style={{
                opacity:
                  focusedVehicle === null || depot || member?.index === focusedVehicle ? 1 : 0.3,
              }}
            >
              <title>
                {node.name} ·{' '}
                {depot
                  ? 'Depot'
                  : `${node.demand} units · ${node.window_start}–${node.window_end} min`}
              </title>
              <circle className="node-hit" cx={node.sx} cy={node.sy} r="24" fill="transparent" />
              {(isSelected || removed.includes(node.id)) && (
                <circle
                  cx={node.sx}
                  cy={node.sy}
                  r="21"
                  fill={removed.includes(node.id) ? '#b18a3f' : c}
                  opacity="0.16"
                />
              )}
              {depot ? (
                <rect
                  x={node.sx - 15}
                  y={node.sy - 15}
                  width="30"
                  height="30"
                  fill={c}
                  stroke="#fcfaf6"
                  strokeWidth="3"
                />
              ) : (
                <circle
                  className="node-dot"
                  cx={node.sx}
                  cy={node.sy}
                  r={isSelected ? 13 : 10}
                  fill={member ? c : '#fcfaf6'}
                  stroke={c}
                  strokeWidth="1.5"
                />
              )}
              <text
                x={node.sx}
                y={node.sy}
                textAnchor="middle"
                dominantBaseline="central"
                fill={depot || member ? '#fcfaf6' : '#52614e'}
                className="node-number"
                fontSize="12"
                fontWeight="700"
                pointerEvents="none"
              >
                {depot ? 'D' : deliveries.findIndex((delivery) => delivery.id === node.id) + 1}
              </text>
              {(depot || isSelected) && (
                <text x={node.sx} y={node.sy + 32} textAnchor="middle" className="canvas-label">
                  {depot ? 'DEPOT' : node.name}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="canvas-legend">
        <button
          className={focusedVehicle === null ? 'legend-pill active' : 'legend-pill'}
          aria-pressed={focusedVehicle === null}
          onClick={() => onFocus(null)}
        >
          All vehicles
        </button>
        {routes.map(
          (route, index) =>
            route.length > 0 && (
              <button
                key={index}
                className={focusedVehicle === index ? 'legend-pill active' : 'legend-pill'}
                aria-pressed={focusedVehicle === index}
                onClick={() => onFocus(focusedVehicle === index ? null : index)}
              >
                <i style={{ background: color(index) }} />
                Vehicle {index + 1}
                <span>{route.length} stops</span>
              </button>
            ),
        )}
        {routes.length === 0 && <span className="subtle">Your routes will appear here</span>}
      </div>
    </div>
  )
}
