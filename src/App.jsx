import { useState, useCallback, useRef, useEffect } from 'react'
import { useOptimizer } from './hooks/useOptimizer'
import ControlPanel     from './components/ControlPanel'
import MapView          from './components/MapView'
import RouteToggle      from './components/RouteToggle'
import MetricsPanel     from './components/MetricsPanel'
import ConvergenceChart from './components/ConvergenceChart'
import BenchmarkTable   from './components/BenchmarkTable'

const BOTTOM_TABS = [
  {
    key: 'metrics', label: 'Metrics',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
        <path d="M0 11a1 1 0 011-1h2a1 1 0 011 1v3a1 1 0 01-1 1H1a1 1 0 01-1-1v-3zm5-4a1 1 0 011-1h2a1 1 0 011 1v7a1 1 0 01-1 1H6a1 1 0 01-1-1V7zm5-5a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V2z" />
      </svg>
    ),
  },
  {
    key: 'convergence', label: 'Convergence',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
        <path fillRule="evenodd" d="M1.5 1a.5.5 0 00-.5.5v3a.5.5 0 001 0V2h2.5a.5.5 0 000-1H1.5zm11 0h-2.5a.5.5 0 000 1H13v2.5a.5.5 0 001 0v-3a.5.5 0 00-.5-.5zM1 11.5a.5.5 0 001 0V13h2.5a.5.5 0 000-1H1.5A.5.5 0 001 12.5v-1zm12 0v1a.5.5 0 01-.5.5H10a.5.5 0 000 1h2.5a1.5 1.5 0 001.5-1.5v-1a.5.5 0 00-1 0z" clipRule="evenodd" />
        <path d="M1.5 6a.5.5 0 000 1H3v3H1.5a.5.5 0 000 1h12a.5.5 0 000-1H12V7h1.5a.5.5 0 000-1h-12z" />
      </svg>
    ),
  },
  {
    key: 'benchmark', label: 'Benchmark',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
        <path d="M9.669.864L8 0 6.331.864l-1.858.282-.842 1.68-1.337 1.32L2.6 6l-.306 1.854 1.337 1.32.842 1.68 1.858.282L8 12l1.669-.864 1.858-.282.842-1.68 1.337-1.32L13.4 6l.306-1.854-1.337-1.32-.842-1.68L9.669.864zm1.196 1.193l.684 1.365 1.086 1.072L12.387 6l.248 1.506-1.086 1.072-.684 1.365-1.51.229L8 10.874l-1.355-.702-1.51-.229-.684-1.365-1.086-1.072L3.613 6l-.248-1.506 1.086-1.072.684-1.365 1.51-.229L8 1.126l1.355.702 1.51.229z" />
        <path d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1 4 11.794z" />
      </svg>
    ),
  },
]

const SIDEBAR_MIN     = 240
const SIDEBAR_MAX     = 480
const SIDEBAR_DEFAULT = 280
const BOTTOM_MIN      = 150
const BOTTOM_MAX      = 600
const BOTTOM_DEFAULT  = 272

export default function App() {
  const {
    points, selectedAlgorithm, params, constraints,
    results, benchmarkData, activeRoute,
    loading, benchmarkLoading, error,
    addPoint, removePoint, clearPoints,
    loadPresetPoints, loadCSVPoints,
    setSelectedAlgorithm, updateParam, updateConstraint,
    runOptimize, runBenchmark,
    setActiveRoute,
  } = useOptimizer()

  const [overlayAll,      setOverlayAll]      = useState(false)
  const [bottomTab,       setBottomTab]       = useState('metrics')
  const [dismissedError,  setDismissedError]  = useState(false)
  const [sidebarWidth,    setSidebarWidth]    = useState(SIDEBAR_DEFAULT)
  const [bottomHeight,    setBottomHeight]    = useState(BOTTOM_DEFAULT)

  const isDragging       = useRef(false)
  const isDraggingBottom = useRef(false)
  const startX           = useRef(0)
  const startY           = useRef(0)
  const startWidth       = useRef(SIDEBAR_DEFAULT)
  const startHeight      = useRef(BOTTOM_DEFAULT)

  useEffect(() => {
    if (error) setDismissedError(false)
  }, [error])

  useEffect(() => {
    const onMove = (e) => {
      if (isDragging.current) {
        const delta = e.clientX - startX.current
        setSidebarWidth(w => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth.current + delta)))
      }
      if (isDraggingBottom.current) {
        const delta = startY.current - e.clientY
        setBottomHeight(h => Math.min(BOTTOM_MAX, Math.max(BOTTOM_MIN, startHeight.current + delta)))
      }
    }
    const onUp = () => {
      isDragging.current = false
      isDraggingBottom.current = false
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

  const handleSidebarMouseDown = useCallback((e) => {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [sidebarWidth])

  const handleBottomMouseDown = useCallback((e) => {
    e.preventDefault()
    isDraggingBottom.current = true
    startY.current = e.clientY
    startHeight.current = bottomHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [bottomHeight])

  const handleMapClick = useCallback(({ latitude, longitude }) => {
    const isFirst = points.length === 0
    addPoint({
      latitude,
      longitude,
      name:   isFirst ? 'Depot' : `Delivery Point ${points.length}`,
      demand: isFirst ? 0 : 10,
    })
  }, [points, addPoint])

  const activeResult = activeRoute ? results[activeRoute] : null
  const randomResult = results['random'] || results['Random'] || null
  const showError    = error && !dismissedError

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f172a]">

      {/* Sidebar */}
      <div
        className="shrink-0 flex flex-col h-full overflow-hidden relative"
        style={{ width: sidebarWidth }}
      >
        <ControlPanel
          points={points}
          selectedAlgorithm={selectedAlgorithm}
          params={params}
          constraints={constraints}
          loading={loading}
          benchmarkLoading={benchmarkLoading}
          onLoadPreset={loadPresetPoints}
          onLoadCSV={loadCSVPoints}
          onAddPoint={addPoint}
          onRemovePoint={removePoint}
          onClear={clearPoints}
          onAlgorithmChange={setSelectedAlgorithm}
          onParamChange={updateParam}
          onConstraintChange={updateConstraint}
          onRunOptimize={runOptimize}
          onRunBenchmark={runBenchmark}
        />
      </div>

      {/* Sidebar resize handle */}
      <div
        className="sidebar-resize-handle"
        onMouseDown={handleSidebarMouseDown}
        title="Drag to resize"
      >
        <div className="sidebar-resize-indicator" />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Route toggle bar */}
        {Object.keys(results).length > 0 && (
          <RouteToggle
            results={results}
            activeRoute={activeRoute}
            overlayAll={overlayAll}
            onSelect={(key) => { setActiveRoute(key); setOverlayAll(false) }}
            onToggleOverlay={() => setOverlayAll(v => !v)}
          />
        )}

        {/* Error banner */}
        {showError && (
          <div className="bg-red-950/80 border-b border-red-800 px-4 py-2 flex items-center gap-2 shrink-0">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-400 shrink-0">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span className="text-red-300 text-sm flex-1">{error}</span>
            <button
              onClick={() => setDismissedError(true)}
              className="text-red-500 hover:text-red-300 transition-colors"
              aria-label="Dismiss"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
              </svg>
            </button>
          </div>
        )}

        {/* Map area */}
        <div className="flex-1 min-h-0 relative">

          {/* Loading overlay */}
          {(loading || benchmarkLoading) && (
            <div className="absolute inset-0 z-[1000] bg-slate-900/70 backdrop-blur-sm
                            flex flex-col items-center justify-center">
              <div className="bg-[#1e293b] border border-slate-600 rounded-2xl
                              px-10 py-8 flex flex-col items-center gap-4 shadow-2xl">
                <svg className="w-12 h-12 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-20" cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-90" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <div className="text-center">
                  <p className="text-white font-semibold text-base leading-tight">
                    {benchmarkLoading ? 'Running Benchmark' : `Running ${selectedAlgorithm.toUpperCase()}`}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">Computing optimal routes…</p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-blue-500"
                      style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <MapView
            points={points}
            results={results}
            activeRoute={activeRoute}
            onMapClick={handleMapClick}
            overlayAll={overlayAll}
            onAddPoint={addPoint}
          />
        </div>

        {/* Bottom panel resize handle */}
        <div
          className="bottom-resize-handle"
          onMouseDown={handleBottomMouseDown}
          title="Drag to resize"
        >
          <div className="bottom-resize-indicator" />
        </div>

        {/* Bottom analytics panel */}
        <div
          className="border-t border-slate-700 flex flex-col shrink-0"
          style={{ height: bottomHeight }}
        >
          {/* Tab bar */}
          <div className="flex border-b border-slate-700 bg-[#1e293b] shrink-0">
            {BOTTOM_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setBottomTab(t.key)}
                className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold
                            transition-colors border-b-2 -mb-px
                  ${bottomTab === t.key
                    ? 'text-blue-400 border-blue-400'
                    : 'text-slate-500 border-transparent hover:text-slate-300'}`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}

            {/* Status info */}
            <div className="ml-auto flex items-center gap-3 px-4">
              {points.length > 0 && (
                <span className="text-xs text-slate-500 font-mono">
                  {points.length} nodes
                </span>
              )}
              {activeResult && (
                <span className="text-xs text-blue-400 font-mono font-semibold">
                  {activeResult.cost?.toFixed(2)} km
                </span>
              )}
            </div>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {bottomTab === 'metrics'     && <MetricsPanel result={activeResult} randomCost={randomResult?.cost} />}
            {bottomTab === 'convergence' && <ConvergenceChart results={results} />}
            {bottomTab === 'benchmark'   && <BenchmarkTable data={benchmarkData} />}
          </div>
        </div>
      </div>
    </div>
  )
}
