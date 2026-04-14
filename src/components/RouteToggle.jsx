

const ALGO_COLORS = {
  aco:              'bg-blue-600 border-blue-500',
  ga:               'bg-emerald-600 border-emerald-500',
  pso:              'bg-amber-600 border-amber-500',
  nearest_neighbor: 'bg-violet-600 border-violet-500',
  'nearest neighbor': 'bg-violet-600 border-violet-500',
  random:           'bg-red-600 border-red-500',
}

const ALGO_DOT = {
  aco:              'bg-blue-400',
  ga:               'bg-emerald-400',
  pso:              'bg-amber-400',
  nearest_neighbor: 'bg-violet-400',
  'nearest neighbor': 'bg-violet-400',
  random:           'bg-red-400',
}

function normalizeKey(key) {
  return key?.toLowerCase().replace(/ /g, '_') || key
}

export default function RouteToggle({ results, activeRoute, overlayAll, onSelect, onToggleOverlay }) {
  const entries = Object.entries(results)
  if (entries.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-[#1e293b] border-b border-slate-700">
      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide shrink-0">View:</span>

      {entries.map(([key, res]) => {
        const normKey = normalizeKey(key)
        const algoName = res.algorithm || key
        const normAlgo = normalizeKey(algoName)
        const isActive = !overlayAll && activeRoute === key
        const dotClass = ALGO_DOT[normAlgo] || 'bg-slate-400'
        const activeBg = ALGO_COLORS[normAlgo] || 'bg-slate-600 border-slate-500'

        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
              border transition-all duration-150
              ${isActive
                ? `${activeBg} text-white`
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
          >
            <span className={`w-2 h-2 rounded-full ${dotClass}`} />
            {algoName}
            <span className={`ml-0.5 font-mono ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
              {res.cost?.toFixed(1)}
            </span>
          </button>
        )
      })}

      {}
      <button
        onClick={onToggleOverlay}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ml-auto
          ${overlayAll
            ? 'bg-slate-500 border-slate-400 text-white'
            : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
          }`}
      >
        {overlayAll ? '🗂️ Overlay ON' : '🗂️ Overlay'}
      </button>
    </div>
  )
}
