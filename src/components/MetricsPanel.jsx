

function MetricCard({ icon, label, value, sub, highlight }) {
  return (
    <div className={`card flex flex-col gap-1 ${highlight ? 'border-blue-600' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white font-mono">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

export default function MetricsPanel({ result, randomCost }) {
  if (!result) {
    return (
      <div className="card flex flex-col items-center justify-center text-center p-8 text-slate-500">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-sm">Run an optimization to see metrics here.</p>
      </div>
    )
  }

  const improvement = randomCost && randomCost > 0
    ? (((randomCost - result.cost) / randomCost) * 100).toFixed(1)
    : null

  const iterOrGen = result.history?.length || '-'

  return (
    <div className="space-y-3 animate-fade-in">
      {}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">{result.algorithm}</h3>
        {result.violations > 0 && (
          <span className="badge bg-red-900/60 text-red-400 border border-red-700">
            ⚠ {result.violations} violation{result.violations !== 1 ? 's' : ''}
          </span>
        )}
        {result.violations === 0 && result.cost && (
          <span className="badge bg-green-900/60 text-green-400 border border-green-700">
            ✓ Feasible
          </span>
        )}
      </div>

      {}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon="📏"
          label="Total Distance"
          value={`${result.cost?.toFixed(2)}`}
          sub="kilometres"
          highlight
        />
        <MetricCard
          icon="⏱️"
          label="Run Time"
          value={result.time_ms < 1000 ? `${result.time_ms?.toFixed(0)}ms` : `${(result.time_ms / 1000).toFixed(2)}s`}
          sub="wall-clock"
        />
        <MetricCard
          icon="🔁"
          label="Iterations"
          value={iterOrGen}
          sub="convergence steps"
        />
        {improvement !== null ? (
          <MetricCard
            icon="📈"
            label="vs Random"
            value={`${improvement > 0 ? '+' : ''}${improvement}%`}
            sub="distance improvement"
          />
        ) : (
          <MetricCard
            icon="📍"
            label="Nodes"
            value={result.route?.length || '-'}
            sub="delivery stops"
          />
        )}
      </div>

      {}
      <div className="card">
        <div className="label">Route sequence</div>
        <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto">
          {result.route_names?.map((name, i) => (
            <span key={i} className="flex items-center gap-0.5">
              {i > 0 && <span className="text-slate-600 text-xs">→</span>}
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  i === 0
                    ? 'bg-amber-900/60 text-amber-300 border border-amber-700'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {name}
              </span>
            </span>
          ))}
          {}
          {result.route_names?.length > 0 && (
            <>
              <span className="text-slate-600 text-xs">→</span>
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-900/60 text-amber-300 border border-amber-700">
                {result.route_names[0]}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
