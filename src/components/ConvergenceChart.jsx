

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const ALGO_COLORS = {
  aco:              '#3b82f6',
  ga:               '#10b981',
  pso:              '#f59e0b',
  nearest_neighbor: '#8b5cf6',
  'nearest neighbor': '#8b5cf6',
  random:           '#ef4444',
}

function getColor(algoKey) {
  const key = algoKey?.toLowerCase().replace(/ /g, '_') || ''
  return ALGO_COLORS[key] || '#64748b'
}


function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1.5">Iteration {label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-300">{entry.name}:</span>
          <span className="font-mono font-semibold" style={{ color: entry.color }}>
            {Number(entry.value).toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function ConvergenceChart({ results }) {
  const entries = Object.entries(results || {}).filter(([, r]) => r?.history?.length > 1)

  if (entries.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center text-center h-full min-h-48 text-slate-500">
        <div className="text-3xl mb-2">📉</div>
        <p className="text-sm">Run an algorithm to see the convergence curve.</p>
      </div>
    )
  }

  
  
  const maxLen = Math.max(...entries.map(([, r]) => r.history.length))

  const chartData = Array.from({ length: maxLen }, (_, i) => {
    const row = { iteration: i + 1 }
    entries.forEach(([key, result]) => {
      const algoLabel = result.algorithm || key
      
      row[algoLabel] = result.history[i] ?? result.history.at(-1)
    })
    return row
  })

  
  const displayData = chartData.length > 200
    ? chartData.filter((_, i) => i % Math.ceil(chartData.length / 200) === 0)
    : chartData

  const algoKeys = entries.map(([, r]) => r.algorithm || 'unknown')

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">Convergence</h3>
        <span className="text-xs text-slate-500">Best cost per iteration</span>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="iteration"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              label={{ value: 'Iteration', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: 10 }}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              tickFormatter={(v) => v.toFixed(0)}
              label={{ value: 'Cost (km)', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
            />
            {algoKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={getColor(key)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
