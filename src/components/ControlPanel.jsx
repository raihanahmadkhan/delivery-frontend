

import { useState, useRef, useEffect } from 'react'
import FileUpload from './FileUpload'





const PARAM_DEFS = {
  aco: [
    { key: 'n_ants', label: 'Ants', min: 5, max: 100, step: 5, type: 'int' },
    { key: 'n_iterations', label: 'Iterations', min: 10, max: 500, step: 10, type: 'int' },
    { key: 'alpha', label: 'α  pheromone', min: 0.1, max: 5.0, step: 0.1, type: 'float' },
    { key: 'beta', label: 'β  heuristic', min: 0.1, max: 10.0, step: 0.1, type: 'float' },
    { key: 'rho', label: 'ρ  evaporation', min: 0.1, max: 0.9, step: 0.05, type: 'float' },
    { key: 'q', label: 'Q  deposit', min: 10, max: 500, step: 10, type: 'float' },
    { key: 'elitist_weight', label: 'Elitist weight', min: 0, max: 5.0, step: 0.5, type: 'float' },
  ],
  ga: [
    { key: 'population_size', label: 'Population', min: 10, max: 200, step: 10, type: 'int' },
    { key: 'n_generations', label: 'Generations', min: 10, max: 500, step: 10, type: 'int' },
    { key: 'crossover_rate', label: 'Crossover', min: 0.1, max: 1.0, step: 0.05, type: 'float' },
    { key: 'mutation_rate', label: 'Mutation', min: 0.0, max: 0.5, step: 0.05, type: 'float' },
    { key: 'tournament_size', label: 'Tournament k', min: 2, max: 10, step: 1, type: 'int' },
    { key: 'elitism_count', label: 'Elite count', min: 0, max: 10, step: 1, type: 'int' },
  ],
  pso: [
    { key: 'n_particles', label: 'Particles', min: 5, max: 100, step: 5, type: 'int' },
    { key: 'n_iterations', label: 'Iterations', min: 10, max: 500, step: 10, type: 'int' },
    { key: 'inertia_weight', label: 'Inertia ω', min: 0.1, max: 1.0, step: 0.05, type: 'float' },
    { key: 'c1', label: 'Cognitive c₁', min: 0.1, max: 4.0, step: 0.1, type: 'float' },
    { key: 'c2', label: 'Social c₂', min: 0.1, max: 4.0, step: 0.1, type: 'float' },
    { key: 'max_velocity', label: 'Max velocity', min: 1, max: 10, step: 1, type: 'int' },
  ],
  nearest_neighbor: [],
  random: [
    { key: 'n_trials', label: 'Trials', min: 1, max: 100, step: 1, type: 'int' },
  ],
}

const ALGORITHMS = [
  { key: 'aco', abbr: 'ACO', label: 'Ant Colony', desc: 'Pheromone trail optimisation', accent: 'blue' },
  { key: 'ga', abbr: 'GA', label: 'Genetic', desc: 'Evolutionary crossover & mutate', accent: 'emerald' },
  { key: 'pso', abbr: 'PSO', label: 'Particle Swarm', desc: 'Swarm velocity optimisation', accent: 'amber' },
  { key: 'nearest_neighbor', abbr: 'NN', label: 'Nearest Nbr.', desc: 'Greedy closest-node heuristic', accent: 'violet' },
  { key: 'random', abbr: 'RND', label: 'Random', desc: 'Shuffled baseline (best of N)', accent: 'rose' },
]

const ALGO_MAP = Object.fromEntries(ALGORITHMS.map(a => [a.key, a]))

const ACCENT = {
  blue: { card: 'border-blue-500 bg-blue-500/10', abbr: 'bg-blue-500 text-white', btn: 'bg-blue-600 hover:bg-blue-500', dot: 'bg-blue-400', check: 'bg-blue-500' },
  emerald: { card: 'border-emerald-500 bg-emerald-500/10', abbr: 'bg-emerald-500 text-white', btn: 'bg-emerald-600 hover:bg-emerald-500', dot: 'bg-emerald-400', check: 'bg-emerald-500' },
  amber: { card: 'border-amber-500 bg-amber-500/10', abbr: 'bg-amber-500 text-white', btn: 'bg-amber-600 hover:bg-amber-500', dot: 'bg-amber-400', check: 'bg-amber-500' },
  violet: { card: 'border-violet-500 bg-violet-500/10', abbr: 'bg-violet-500 text-white', btn: 'bg-violet-600 hover:bg-violet-500', dot: 'bg-violet-400', check: 'bg-violet-500' },
  rose: { card: 'border-rose-500 bg-rose-500/10', abbr: 'bg-rose-500 text-white', btn: 'bg-rose-600 hover:bg-rose-500', dot: 'bg-rose-400', check: 'bg-rose-500' },
}

const ALGO_INFO = {
  aco: { color: 'text-blue-400', formula: 'P(i→j) = τᵢⱼᵅ · ηᵢⱼᵝ / Σ τᵢₖᵅ · ηᵢₖᵝ', note: 'Elitist variant reinforces the global best tour each iteration.' },
  ga: { color: 'text-emerald-400', formula: null, note: 'Order Crossover (OX) preserves relative node order. Tournament selection pressure is adjustable.' },
  pso: { color: 'text-amber-400', formula: 'v = ω·v + c₁r₁(pbest−x) + c₂r₂(gbest−x)', note: 'Velocity encoded as swap sequences applied to route permutation.' },
  nearest_neighbor: { color: 'text-violet-400', formula: null, note: 'Deterministic - always produces the same result. Use as a quality benchmark.' },
  random: { color: 'text-rose-400', formula: null, note: 'Best of N random shuffles. Useful as a worst-case baseline for comparison.' },
}

const PRESETS = [
  { name: 'random5', label: '5 Nodes', sub: 'Quick test' },
  { name: 'random20', label: '20 Nodes', sub: 'Major Indian cities' },
  { name: 'random50', label: '50 Nodes', sub: 'Pan-India cities' },
  { name: 'clustered', label: 'Clustered', sub: 'N / W / S regions' },
]






function ChevronIcon({ expanded }) {
  return (
    <svg
      viewBox="0 0 20 20" fill="currentColor"
      className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
    >
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  )
}


function CollapsibleSection({ title, expanded, onToggle, action, children, defaultPadding = true }) {
  return (
    <div className="border-b border-slate-800/60 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/30 transition-colors"
      >
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {action}
          <ChevronIcon expanded={expanded} />
        </div>
      </button>
      <div
        className={`collapsible-content ${expanded ? 'collapsible-open' : 'collapsible-closed'}`}
      >
        <div className={defaultPadding ? 'px-4 pb-3' : ''}>
          {children}
        </div>
      </div>
    </div>
  )
}

function ParamSlider({ def, value, onChange }) {
  const display = def.type === 'float' ? Number(value).toFixed(2) : value
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5">
      <label className="text-xs text-slate-400 col-span-1">{def.label}</label>
      <span className="text-xs font-mono text-blue-400 font-semibold tabular-nums text-right">
        {display}
      </span>
      <input
        type="range"
        min={def.min} max={def.max} step={def.step}
        value={value}
        onChange={e => onChange(def.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value))}
        className="col-span-2 w-full"
      />
    </div>
  )
}





export default function ControlPanel({
  points, selectedAlgorithm, params, constraints,
  loading, benchmarkLoading,
  onLoadPreset, onLoadCSV, onAddPoint, onRemovePoint, onClear,
  onAlgorithmChange, onParamChange, onConstraintChange,
  onRunOptimize, onRunBenchmark,
  onClose,
}) {
  const [actionPanelHeight, setActionPanelHeight] = useState(250)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(250)

  useEffect(() => {
    const onMove = (e) => {
      if (isDragging.current) {
        const delta = startY.current - e.clientY
        setActionPanelHeight(h => Math.min(800, Math.max(120, startHeight.current + delta)))
      }
    }
    const onUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const handleMouseDown = (e) => {
    e.preventDefault()
    isDragging.current = true
    startY.current = e.clientY
    startHeight.current = actionPanelHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }

  const [tab, setTab] = useState('data')
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  const [manualName, setManualName] = useState('')
  const [benchmarkAlgos, setBenchmarkAlgos] = useState(['aco', 'ga', 'pso', 'nearest_neighbor', 'random'])


  const [presetsOpen, setPresetsOpen] = useState(true)
  const [csvOpen, setCsvOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [nodesOpen, setNodesOpen] = useState(true)


  const [algoSelectOpen, setAlgoSelectOpen] = useState(true)
  const [paramsOpen, setParamsOpen] = useState(true)
  const [infoOpen, setInfoOpen] = useState(false)


  const [routingOpen, setRoutingOpen] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)

  const isBusy = loading || benchmarkLoading
  const currentAlgo = ALGO_MAP[selectedAlgorithm]
  const currentAccent = ACCENT[currentAlgo?.accent ?? 'blue']
  const paramDefs = PARAM_DEFS[selectedAlgorithm] ?? []
  const algoInfo = ALGO_INFO[selectedAlgorithm]

  const handleAddManual = () => {
    const lat = parseFloat(manualLat)
    const lng = parseFloat(manualLng)
    if (isNaN(lat) || isNaN(lng)) return
    onAddPoint({ latitude: lat, longitude: lng, name: manualName || undefined, demand: 0 })
    setManualLat(''); setManualLng(''); setManualName('')
  }

  const toggleBenchmarkAlgo = algo =>
    setBenchmarkAlgos(prev => prev.includes(algo) ? prev.filter(a => a !== algo) : [...prev, algo])

  const TABS = [
    {
      key: 'data', label: 'Data', icon: (
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
          <path d="M8 1a2.5 2.5 0 00-2.5 2.5v.382a5.5 5.5 0 00-2.088 1.165l-.331-.192A2.5 2.5 0 00.288 7.108l.5.866A2.5 2.5 0 003.5 9.227v.546a5.5 5.5 0 000 .454v.546a2.5 2.5 0 00-2.712 1.253l-.5.866a2.5 2.5 0 002.793 2.253l.331-.192a5.5 5.5 0 002.088 1.165v.382A2.5 2.5 0 008 19a2.5 2.5 0 002.5-2.5v-.382a5.5 5.5 0 002.088-1.165l.331.192a2.5 2.5 0 002.793-2.253l-.5-.866A2.5 2.5 0 0012.5 10.773v-.546a5.5 5.5 0 000-.454v-.546A2.5 2.5 0 0015.212 7.974l.5-.866a2.5 2.5 0 00-2.793-2.253l-.331.192A5.5 5.5 0 0010.5 3.882V3.5A2.5 2.5 0 008 1z" />
        </svg>
      )
    },
    {
      key: 'algo', label: 'Algorithm', icon: (
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
          <path d="M3.75 0a.75.75 0 01.75.75V2h7V.75a.75.75 0 011.5 0V2h.25A2.75 2.75 0 0116 4.75v8.5A2.75 2.75 0 0113.25 16H2.75A2.75 2.75 0 010 13.25v-8.5A2.75 2.75 0 012.75 2H3V.75A.75.75 0 013.75 0z" />
        </svg>
      )
    },
    {
      key: 'constraints', label: 'Constraints', icon: (
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
          <path fillRule="evenodd" d="M6.5 1.75a.75.75 0 00-1.5 0V3H3.75A2.75 2.75 0 001 5.75v7.5A2.75 2.75 0 003.75 16h8.5A2.75 2.75 0 0015 13.25v-7.5A2.75 2.75 0 0012.25 3H11V1.75a.75.75 0 00-1.5 0V3h-3V1.75z" clipRule="evenodd" />
        </svg>
      )
    },
  ]

  return (
    <div className="flex flex-col h-full bg-[#161f2e] border-r border-slate-800">

      { }
      <div className="px-4 pt-6 pb-5 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-center">
          <h1 className="text-lg font-black tracking-widest text-white uppercase text-center">Route Optimizer</h1>
        </div>
      </div>

      { }
      <div className="flex px-1.5 pt-1.5 gap-0.5 border-b border-slate-800 shrink-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold rounded-t transition-colors
              ${tab === t.key
                ? 'text-white bg-slate-800 border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      { }
      <div className="flex-1 overflow-y-auto min-h-0 sidebar-scroll">

        { }
        {tab === 'data' && (
          <div>
            { }
            <CollapsibleSection title="Quick Load" expanded={presetsOpen} onToggle={() => setPresetsOpen(v => !v)}>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.name}
                    onClick={() => onLoadPreset(p.name)}
                    disabled={isBusy}
                    className="flex flex-col items-start px-2.5 py-2 rounded-lg bg-slate-800
                      hover:bg-slate-700 border border-slate-700/50 hover:border-slate-600
                      transition-all disabled:opacity-40 text-left group"
                  >
                    <span className="text-[11px] font-semibold text-slate-200 group-hover:text-white">{p.label}</span>
                    <span className="text-[9px] text-slate-500 mt-0.5">{p.sub}</span>
                  </button>
                ))}
              </div>
            </CollapsibleSection>

            { }
            <CollapsibleSection title="Import CSV" expanded={csvOpen} onToggle={() => setCsvOpen(v => !v)}>
              <FileUpload onFile={onLoadCSV} disabled={isBusy} />
            </CollapsibleSection>

            { }
            <CollapsibleSection title="Add Manually" expanded={manualOpen} onToggle={() => setManualOpen(v => !v)}>
              <div className="space-y-1.5">
                <input
                  className="input text-xs"
                  placeholder="Name  (optional)"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddManual()}
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <input className="input text-xs" placeholder="Latitude" type="number" step="any"
                    value={manualLat} onChange={e => setManualLat(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddManual()}
                  />
                  <input className="input text-xs" placeholder="Longitude" type="number" step="any"
                    value={manualLng} onChange={e => setManualLng(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddManual()}
                  />
                </div>
                <button
                  onClick={handleAddManual}
                  disabled={isBusy || !manualLat || !manualLng}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold
                    bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600
                    disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  + Add Point
                </button>
                <p className="text-[9px] text-slate-600 text-center">
                  or search a city / click the map
                </p>
              </div>
            </CollapsibleSection>

            { }
            <CollapsibleSection
              title={`Nodes (${points.length})`}
              expanded={nodesOpen}
              onToggle={() => setNodesOpen(v => !v)}
              action={
                points.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onClear() }}
                    className="text-[9px] text-rose-500 hover:text-rose-400 transition-colors px-1.5 py-0.5 rounded hover:bg-rose-500/10"
                  >
                    Clear
                  </button>
                )
              }
            >
              {points.length === 0 ? (
                <div className="flex flex-col items-center py-4 text-center">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center mb-1.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                      className="w-4 h-4 text-slate-600">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                  <p className="text-[11px] text-slate-500">No nodes yet</p>
                  <p className="text-[9px] text-slate-600 mt-0.5">Load a preset, search a city, or click the map</p>
                </div>
              ) : (
                <ul className="space-y-0.5 max-h-44 overflow-y-auto">
                  {points.map((pt, i) => (
                    <li key={pt.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px]
                        ${i === 0 ? 'bg-amber-950/40 border border-amber-800/30' : 'bg-slate-800/50 border border-transparent'}`}
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 text-[8px] font-bold
                        ${i === 0 ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                        {i === 0 ? 'D' : i}
                      </span>
                      <span className={`flex-1 truncate font-medium ${i === 0 ? 'text-amber-300' : 'text-slate-300'}`}>
                        {pt.name || `Node ${pt.id}`}
                      </span>
                      <button
                        onClick={() => onRemovePoint(pt.id)}
                        className="shrink-0 w-4 h-4 flex items-center justify-center rounded
                          text-slate-600 hover:text-rose-400 hover:bg-slate-700 transition-colors text-[10px]"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CollapsibleSection>
          </div>
        )}

        { }
        {tab === 'algo' && (
          <div>
            { }
            <CollapsibleSection title="Select Algorithm" expanded={algoSelectOpen} onToggle={() => setAlgoSelectOpen(v => !v)}>
              <div className="space-y-1">
                {ALGORITHMS.map(algo => {
                  const ac = ACCENT[algo.accent]
                  const active = selectedAlgorithm === algo.key
                  return (
                    <button
                      key={algo.key}
                      onClick={() => onAlgorithmChange(algo.key)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border
                        text-left transition-all duration-150
                        ${active
                          ? `${ac.card} border-opacity-100`
                          : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-700'
                        }`}
                    >
                      <span className={`w-7 h-7 rounded-md flex items-center justify-center
                        shrink-0 text-[9px] font-black tracking-tight
                        ${active ? ac.abbr : 'bg-slate-700 text-slate-400'}`}>
                        {algo.abbr}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] font-semibold leading-tight
                          ${active ? 'text-white' : 'text-slate-400'}`}>
                          {algo.label}
                        </div>
                        <div className="text-[9px] text-slate-600 mt-0.5 truncate">{algo.desc}</div>
                      </div>
                      {active && (
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ac.dot}`} />
                      )}
                    </button>
                  )
                })}
              </div>
            </CollapsibleSection>

            { }
            {paramDefs.length > 0 && (
              <CollapsibleSection title="Parameters" expanded={paramsOpen} onToggle={() => setParamsOpen(v => !v)}>
                <div className="space-y-3">
                  {paramDefs.map(def => (
                    <ParamSlider
                      key={def.key}
                      def={def}
                      value={params[selectedAlgorithm]?.[def.key] ?? def.min}
                      onChange={v => onParamChange(selectedAlgorithm, def.key, v)}
                    />
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {selectedAlgorithm === 'nearest_neighbor' && (
              <div className="px-4 py-3 border-b border-slate-800/60">
                <p className="text-[11px] text-slate-500 text-center">
                  Deterministic - no parameters to tune.
                </p>
              </div>
            )}

            { }
            {algoInfo && (
              <CollapsibleSection title="Info" expanded={infoOpen} onToggle={() => setInfoOpen(v => !v)}>
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 space-y-1.5">
                  <p className={`text-[11px] font-semibold ${algoInfo.color}`}>
                    {currentAlgo?.label}
                  </p>
                  {algoInfo.formula && (
                    <p className="text-[9px] font-mono text-slate-500 bg-slate-800 rounded px-2 py-1 leading-relaxed">
                      {algoInfo.formula}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    {algoInfo.note}
                  </p>
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        { }
        {tab === 'constraints' && (
          <div>
            <CollapsibleSection title="Vehicle Routing" expanded={routingOpen} onToggle={() => setRoutingOpen(v => !v)}>
              <div className="rounded-lg border border-slate-800 bg-slate-800/40 divide-y divide-slate-800">


                { }
                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-slate-300">Capacity</label>
                    <span className="text-[9px] text-slate-600">per vehicle</span>
                  </div>
                  <input
                    type="number" min={0}
                    className="input text-xs"
                    value={constraints.vehicle_capacity >= 1e8 ? '' : constraints.vehicle_capacity}
                    placeholder="Unlimited"
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      onConstraintChange('vehicle_capacity', isNaN(v) ? 1e9 : v)
                    }}
                  />
                </div>

                { }
                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-slate-300">Max Distance</label>
                    <span className="text-[9px] text-slate-600">km per route</span>
                  </div>
                  <input
                    type="number" min={0}
                    className="input text-xs"
                    value={constraints.max_distance >= 1e8 ? '' : constraints.max_distance}
                    placeholder="Unlimited"
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      onConstraintChange('max_distance', isNaN(v) ? 1e9 : v)
                    }}
                  />
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="How It Works" expanded={helpOpen} onToggle={() => setHelpOpen(v => !v)}>
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5 space-y-1.5">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Violations add a weighted penalty to route fitness. The algorithm still finds a solution - infeasible routes are penalised, not rejected.
                </p>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Time windows are set per node via CSV upload.
                </p>
              </div>
            </CollapsibleSection>
          </div>
        )}
      </div>

      { }
      <div className="relative shrink-0" style={{ height: 6, zIndex: 70 }}>
        <div
          className="bottom-resize-handle"
          onMouseDown={handleMouseDown}
          title="Drag to resize action panel"
        >
          <div className="bottom-resize-indicator" />
        </div>
      </div>
      <div 
        className="shrink-0 border-t border-slate-800 bg-[#131c2b] overflow-y-auto sidebar-scroll"
        style={{ height: actionPanelHeight }}
      >

        { }
        <div className="px-3.5 pt-3 pb-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
              Single Run
            </span>
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${points.length < 2
              ? 'bg-rose-950/60 text-rose-500'
              : 'bg-emerald-950/60 text-emerald-500'
              }`}>
              {points.length} node{points.length !== 1 ? 's' : ''}
            </span>
          </div>

          <button
            onClick={onRunOptimize}
            disabled={isBusy || points.length < 2}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg
              font-semibold text-[13px] text-white transition-all duration-150
              disabled:opacity-35 disabled:cursor-not-allowed
              ${currentAccent.btn}`}
          >
            {loading
              ? <><LoadingSpinner /> Running…</>
              : <>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                Run {currentAlgo?.abbr} - {currentAlgo?.label}
              </>
            }
          </button>
        </div>

        { }
        <div className="border-t border-slate-800/80" />

        { }
        <div className="px-3.5 pt-2.5 pb-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
              Compare
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setBenchmarkAlgos(ALGORITHMS.map(a => a.key))}
                className="text-[9px] text-blue-500 hover:text-blue-400 transition-colors">
                All
              </button>
              <span className="text-slate-700 text-[9px]">·</span>
              <button onClick={() => setBenchmarkAlgos([])}
                className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors">
                None
              </button>
            </div>
          </div>

          { }
          <div className="space-y-0.5">
            {ALGORITHMS.map(algo => {
              const checked = benchmarkAlgos.includes(algo.key)
              const ac = ACCENT[algo.accent]
              return (
                <button
                  key={algo.key}
                  onClick={() => toggleBenchmarkAlgo(algo.key)}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded-md
                    text-[11px] transition-all text-left
                    ${checked ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}
                >
                  <span className={`w-3 h-3 rounded flex items-center justify-center
                    shrink-0 border transition-all
                    ${checked ? `${ac.check} border-transparent` : 'border-slate-700 bg-transparent'}`}>
                    {checked && (
                      <svg viewBox="0 0 12 12" fill="white" className="w-2 h-2">
                        <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    )}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ac.dot}`} />
                  <span className={`font-medium flex-1 ${checked ? 'text-slate-200' : 'text-slate-500'}`}>
                    {algo.label}
                  </span>
                  <span className="text-[9px] font-mono text-slate-700">{algo.abbr}</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => onRunBenchmark(benchmarkAlgos)}
            disabled={isBusy || points.length < 2 || benchmarkAlgos.length < 2}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
              font-semibold text-[13px] bg-slate-700 hover:bg-slate-600 text-slate-200
              border border-slate-600/60 hover:border-slate-500
              transition-all disabled:opacity-35 disabled:cursor-not-allowed"
          >
            {benchmarkLoading
              ? <><LoadingSpinner /> Comparing…</>
              : <>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"
                  className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                Compare {benchmarkAlgos.length} Algorithm{benchmarkAlgos.length !== 1 ? 's' : ''}
              </>
            }
          </button>

          {benchmarkAlgos.length < 2 && !benchmarkLoading && (
            <p className="text-[9px] text-amber-600/80 text-center">
              Select at least 2 algorithms to compare
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
