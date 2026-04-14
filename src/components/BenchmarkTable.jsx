

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

const ALGO_COLORS = {
  'ACO':              '#3b82f6',
  'GA':               '#10b981',
  'PSO':              '#f59e0b',
  'Nearest Neighbor': '#8b5cf6',
  'Random':           '#ef4444',
}

function getColor(algoName) {
  return ALGO_COLORS[algoName] || '#64748b'
}


function exportCSV(results) {
  const header = ['Rank', 'Algorithm', 'Cost (km)', 'Time (ms)', 'Violations', 'vs Random (%)']
  const rows = results.map((r, i) => [
    i + 1,
    r.algorithm,
    r.cost?.toFixed(4),
    r.time_ms?.toFixed(1),
    r.violations,
    r.improvement_vs_random ?? 'N/A',
  ])
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'benchmark_results.csv'
  a.click()
  URL.revokeObjectURL(url)
}


function BarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold mb-1" style={{ color: d.fill }}>{d.payload.algorithm}</p>
      <p className="text-slate-300">Cost: <span className="font-mono font-bold text-white">{Number(d.value).toFixed(2)} km</span></p>
    </div>
  )
}

export default function BenchmarkTable({ data }) {
  if (!data || !data.results?.length) {
    return (
      <div className="card flex flex-col items-center justify-center text-center p-8 text-slate-500">
        <div className="text-4xl mb-3">🏆</div>
        <p className="text-sm">Run a benchmark to see the comparison table.</p>
      </div>
    )
  }

  const { results, summary } = data
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 640

  const barData = results.map((r) => ({
    algorithm: r.algorithm,
    cost: r.cost,
  }))

  const best = results[0]

  return (
    <div className="space-y-4 animate-fade-in">

      {}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <div className="card text-center">
          <div className="text-xs text-slate-400 mb-1">Best Algorithm</div>
          <div className="text-sm font-bold text-blue-400">{summary.best_algorithm}</div>
          <div className="text-xs text-slate-500 font-mono">{summary.best_cost?.toFixed(2)} km</div>
        </div>
        <div className="card text-center">
          <div className="text-xs text-slate-400 mb-1">Worst Algorithm</div>
          <div className="text-sm font-bold text-red-400">{summary.worst_algorithm}</div>
          <div className="text-xs text-slate-500 font-mono">{summary.worst_cost?.toFixed(2)} km</div>
        </div>
        <div className="card text-center">
          <div className="text-xs text-slate-400 mb-1">Cost Range</div>
          <div className="text-xl font-bold text-white font-mono">{summary.cost_range?.toFixed(2)}</div>
          <div className="text-xs text-slate-500">km spread</div>
        </div>
        <div className="card text-center">
          <div className="text-xs text-slate-400 mb-1">Total Time</div>
          <div className="text-xl font-bold text-white font-mono">{summary.total_time_ms?.toFixed(0)}</div>
          <div className="text-xs text-slate-500">ms</div>
        </div>
      </div>

      {}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">Cost Comparison</h3>
          <button
            onClick={() => exportCSV(results)}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            ⬇ Export CSV
          </button>
        </div>
        <ResponsiveContainer width="100%" height={isMobileView ? 140 : 180}>
          <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="algorithm"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              tickFormatter={(v) => v.toFixed(0)}
            />
            <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={getColor(entry.algorithm)} opacity={i === 0 ? 1 : 0.75} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {}
      <div className="card overflow-x-auto">
        <h3 className="text-sm font-bold text-white mb-3">Ranked Results</h3>
        <table className="w-full text-xs min-w-[520px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-700">
              <th className="pb-2 pr-3 font-semibold">#</th>
              <th className="pb-2 pr-3 font-semibold">Algorithm</th>
              <th className="pb-2 pr-3 font-semibold text-right">Distance</th>
              <th className="pb-2 pr-3 font-semibold text-right">Time</th>
              <th className="pb-2 pr-3 font-semibold text-right">Violations</th>
              <th className="pb-2 font-semibold text-right">vs Random</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => {
              const color = getColor(r.algorithm)
              const isBest = i === 0
              return (
                <tr
                  key={r.algorithm}
                  className={`border-b border-slate-800 last:border-0 ${isBest ? 'bg-blue-950/30' : ''}`}
                >
                  <td className="py-2 pr-3">
                    <span className={`font-bold ${isBest ? 'text-yellow-400' : 'text-slate-500'}`}>
                      {isBest ? '🥇' : i + 1}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-medium text-slate-200">{r.algorithm}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono font-semibold text-white">
                    {r.cost?.toFixed(3)} km
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-slate-400">
                    {r.time_ms?.toFixed(1)} ms
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {r.violations > 0 ? (
                      <span className="text-red-400">⚠ {r.violations}</span>
                    ) : (
                      <span className="text-green-500">✓</span>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {r.improvement_vs_random != null ? (
                      <span className={r.improvement_vs_random >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {r.improvement_vs_random >= 0 ? '+' : ''}{r.improvement_vs_random}%
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
