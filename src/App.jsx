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
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
        <path d="M0 11a1 1 0 011-1h2a1 1 0 011 1v3a1 1 0 01-1 1H1a1 1 0 01-1-1v-3zm5-4a1 1 0 011-1h2a1 1 0 011 1v7a1 1 0 01-1 1H6a1 1 0 01-1-1V7zm5-5a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V2z" />
      </svg>
    ),
  },
  {
    key: 'convergence', label: 'Convergence',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
        <path fillRule="evenodd" d="M1.5 1a.5.5 0 00-.5.5v3a.5.5 0 001 0V2h2.5a.5.5 0 000-1H1.5zm11 0h-2.5a.5.5 0 000 1H13v2.5a.5.5 0 001 0v-3a.5.5 0 00-.5-.5zM1 11.5a.5.5 0 001 0V13h2.5a.5.5 0 000-1H1.5A.5.5 0 001 12.5v-1zm12 0v1a.5.5 0 01-.5.5H10a.5.5 0 000 1h2.5a1.5 1.5 0 001.5-1.5v-1a.5.5 0 00-1 0z" clipRule="evenodd" />
        <path d="M1.5 6a.5.5 0 000 1H3v3H1.5a.5.5 0 000 1h12a.5.5 0 000-1H12V7h1.5a.5.5 0 000-1h-12z" />
      </svg>
    ),
  },
  {
    key: 'benchmark', label: 'Benchmark',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
        <path d="M9.669.864L8 0 6.331.864l-1.858.282-.842 1.68-1.337 1.32L2.6 6l-.306 1.854 1.337 1.32.842 1.68 1.858.282L8 12l1.669-.864 1.858-.282.842-1.68 1.337-1.32L13.4 6l.306-1.854-1.337-1.32-.842-1.68L9.669.864zm1.196 1.193l.684 1.365 1.086 1.072L12.387 6l.248 1.506-1.086 1.072-.684 1.365-1.51.229L8 10.874l-1.355-.702-1.51-.229-.684-1.365-1.086-1.072L3.613 6l-.248-1.506 1.086-1.072.684-1.365 1.51-.229L8 1.126l1.355.702 1.51.229z" />
        <path d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1 4 11.794z" />
      </svg>
    ),
  },
]

const SIDEBAR_MIN     = 240
const SIDEBAR_MAX     = 480
const SIDEBAR_DEFAULT = 280
const SIDEBAR_COLLAPSED_WIDTH = 48
const BOTTOM_MIN      = 150
const BOTTOM_MAX      = 600
const BOTTOM_DEFAULT  = 272
const BOTTOM_COLLAPSED_HEIGHT = 44

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

  // ── Responsive state ─────────────────────────────────────────────────────
  const [isMobile,       setIsMobile]       = useState(() => window.innerWidth < 768)
  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const [bottomExpanded, setBottomExpanded] = useState(false)

  // ── Desktop collapse state ────────────────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [bottomCollapsed,  setBottomCollapsed]  = useState(false)

  // ── UI state ──────────────────────────────────────────────────────────────
  const [overlayAll,     setOverlayAll]     = useState(false)
  const [bottomTab,      setBottomTab]      = useState('metrics')
  const [dismissedError, setDismissedError] = useState(false)

  // ── Desktop resize state ──────────────────────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [bottomHeight, setBottomHeight] = useState(BOTTOM_DEFAULT)

  const isDraggingSidebar = useRef(false)
  const isDraggingBottom  = useRef(false)
  const startX            = useRef(0)
  const startY            = useRef(0)
  const startWidth        = useRef(SIDEBAR_DEFAULT)
  const startHeight       = useRef(BOTTOM_DEFAULT)

  // ── Bottom sheet touch refs ───────────────────────────────────────────────
  const touchStartY = useRef(null)

  // ── Window resize listener ────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Close mobile sidebar when switching to desktop
  useEffect(() => {
    if (!isMobile) setSidebarOpen(false)
  }, [isMobile])

  // Re-show error banner when a new error arrives
  useEffect(() => {
    if (error) setDismissedError(false)
  }, [error])

  // ── Desktop drag-to-resize ────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e) => {
      if (isDraggingSidebar.current) {
        const delta = e.clientX - startX.current
        setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth.current + delta)))
      }
      if (isDraggingBottom.current) {
        const delta = startY.current - e.clientY
        setBottomHeight(Math.min(BOTTOM_MAX, Math.max(BOTTOM_MIN, startHeight.current + delta)))
      }
    }
    const onUp = () => {
      isDraggingSidebar.current = false
      isDraggingBottom.current  = false
      document.body.style.cursor    = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  const handleSidebarMouseDown = useCallback((e) => {
    e.preventDefault()
    isDraggingSidebar.current = true
    startX.current            = e.clientX
    startWidth.current        = sidebarWidth
    document.body.style.cursor    = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [sidebarWidth])

  const handleBottomMouseDown = useCallback((e) => {
    e.preventDefault()
    isDraggingBottom.current = true
    startY.current           = e.clientY
    startHeight.current      = bottomHeight
    document.body.style.cursor    = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [bottomHeight])

  // ── Bottom sheet swipe gesture ────────────────────────────────────────────
  const handleBottomTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleBottomTouchEnd = useCallback((e) => {
    if (touchStartY.current === null) return
    const delta = touchStartY.current - e.changedTouches[0].clientY
    if (Math.abs(delta) > 40) setBottomExpanded(delta > 0)
    touchStartY.current = null
  }, [])

  // ── Map click handler ─────────────────────────────────────────────────────
  const handleMapClick = useCallback(({ latitude, longitude }) => {
    const isFirst = points.length === 0
    addPoint({
      latitude,
      longitude,
      name:   isFirst ? 'Depot' : `Delivery Point ${points.length}`,
      demand: isFirst ? 0 : 10,
    })
    if (isMobile) setSidebarOpen(false)
  }, [points, addPoint, isMobile])

  const activeResult = activeRoute ? results[activeRoute] : null
  const randomResult = results['random'] || results['Random'] || null
  const showError    = error && !dismissedError

  // ── Computed sidebar width for desktop ────────────────────────────────────
  const desktopSidebarW = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth
  const desktopBottomH  = bottomCollapsed  ? BOTTOM_COLLAPSED_HEIGHT : bottomHeight

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-[#0f172a]">

      {/* ── Mobile backdrop ──────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-[2px] md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div
        className={[
          'flex flex-col h-full overflow-hidden',
          isMobile
            ? 'fixed inset-y-0 left-0 z-50 shadow-2xl transition-transform duration-300 ease-in-out'
            : 'shrink-0 sidebar-transition',
          isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0',
        ].join(' ')}
        style={{ width: isMobile ? 'min(300px, 85vw)' : desktopSidebarW }}
      >
        {/* Desktop collapsed state — icon strip */}
        {!isMobile && sidebarCollapsed ? (
          <div className="sidebar-collapsed-strip">
            {/* Expand button */}
            <button
              onClick={() => setSidebarCollapsed(false)}
              title="Expand sidebar"
              className="active"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd"
                  d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
                  clipRule="evenodd" />
                <path fillRule="evenodd"
                  d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z"
                  clipRule="evenodd" />
              </svg>
            </button>

            {/* App icon */}
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 20 20" fill="white" className="w-3.5 h-3.5">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4zm0 2a1 1 0 00-1 1v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7a1 1 0 00-1-1z" />
              </svg>
            </div>
          </div>
        ) : (
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
            onClose={() => setSidebarOpen(false)}
          />
        )}
      </div>

      {/* ── Sidebar resize handle + collapse toggle (desktop only) ────────── */}
      {!isMobile && !sidebarCollapsed && (
        <div className="relative shrink-0 flex">
          <div
            className="sidebar-resize-handle"
            onMouseDown={handleSidebarMouseDown}
            title="Drag to resize"
          >
            <div className="sidebar-resize-indicator" />
          </div>

          {/* Collapse button — sits on the edge of the sidebar */}
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="panel-toggle-btn absolute -right-3 top-1/2 -translate-y-1/2"
            title="Collapse sidebar"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
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
          <div className="bg-red-950/80 border-b border-red-800 px-4 py-2
                          flex items-center gap-2 shrink-0">
            <svg viewBox="0 0 20 20" fill="currentColor"
                 className="w-4 h-4 text-red-400 shrink-0">
              <path fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd" />
            </svg>
            <span className="text-red-300 text-sm flex-1 min-w-0 truncate">{error}</span>
            <button
              onClick={() => setDismissedError(true)}
              className="text-red-500 hover:text-red-300 transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Map area ───────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 relative">

          {/* Mobile hamburger button */}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute top-3 left-3 z-[500]
                         bg-slate-900/92 backdrop-blur-sm border border-slate-700
                         rounded-xl p-2.5 shadow-lg touch-manipulation"
              aria-label="Open menu"
            >
              <svg viewBox="0 0 20 20" fill="currentColor"
                   className="w-5 h-5 text-slate-300">
                <path fillRule="evenodd"
                  d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z"
                  clipRule="evenodd" />
              </svg>
            </button>
          )}

          {/* Loading overlay */}
          {(loading || benchmarkLoading) && (
            <div className="absolute inset-0 z-[1000] bg-slate-900/70 backdrop-blur-sm
                            flex flex-col items-center justify-center">
              <div className="bg-[#1e293b] border border-slate-600 rounded-2xl
                              px-8 py-7 flex flex-col items-center gap-4 shadow-2xl mx-4">
                <svg className="w-12 h-12 animate-spin text-blue-500"
                     viewBox="0 0 24 24" fill="none">
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
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500"
                         style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
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

        {/* ── Bottom panel resize handle + collapse toggle (desktop only) ── */}
        {!isMobile && (
          <div className="relative shrink-0">
            {!bottomCollapsed && (
              <div
                className="bottom-resize-handle"
                onMouseDown={handleBottomMouseDown}
                title="Drag to resize"
              >
                <div className="bottom-resize-indicator" />
              </div>
            )}

            {/* Collapse/expand toggle — centred above the bottom panel */}
            <button
              onClick={() => setBottomCollapsed(v => !v)}
              className="panel-toggle-btn absolute left-1/2 -translate-x-1/2 -top-3"
              title={bottomCollapsed ? 'Expand panel' : 'Collapse panel'}
            >
              <svg viewBox="0 0 20 20" fill="currentColor"
                   className={`w-4 h-4 transition-transform duration-300 ${bottomCollapsed ? 'rotate-180' : ''}`}>
                <path fillRule="evenodd"
                  d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z"
                  clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Bottom analytics panel ────────────────────────────────────── */}
        <div
          className={[
            'border-t border-slate-700 flex flex-col shrink-0',
            isMobile ? 'transition-[height] duration-300 ease-in-out' : 'bottom-transition',
          ].join(' ')}
          style={{
            height: isMobile
              ? (bottomExpanded ? '55vh' : '44px')
              : desktopBottomH
          }}
          onTouchStart={isMobile ? handleBottomTouchStart : undefined}
          onTouchEnd={isMobile   ? handleBottomTouchEnd   : undefined}
        >
          {/* Mobile grab handle */}
          {isMobile && (
            <div
              className="flex items-center justify-center py-1.5 shrink-0 cursor-grab active:cursor-grabbing"
              onClick={() => setBottomExpanded(v => !v)}
            >
              <div className="bottom-grab-handle" />
            </div>
          )}

          {/* Tab bar */}
          <div className="flex items-stretch border-b border-slate-700 bg-[#1e293b] shrink-0 min-h-[44px]">

            {/* Mobile expand / collapse toggle */}
            {isMobile && (
              <button
                onClick={() => setBottomExpanded(v => !v)}
                className="flex items-center justify-center px-3 border-r border-slate-800
                           text-slate-500 hover:text-slate-300 transition-colors touch-manipulation"
                aria-label={bottomExpanded ? 'Collapse panel' : 'Expand panel'}
              >
                <svg viewBox="0 0 20 20" fill="currentColor"
                     className={`w-4 h-4 transition-transform duration-300 ${bottomExpanded ? '' : 'rotate-180'}`}>
                  <path fillRule="evenodd"
                    d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z"
                    clipRule="evenodd" />
                </svg>
              </button>
            )}

            {/* Tabs */}
            {BOTTOM_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => {
                  setBottomTab(t.key)
                  if (isMobile) setBottomExpanded(true)
                  if (!isMobile && bottomCollapsed) setBottomCollapsed(false)
                }}
                className={[
                  'flex items-center gap-1.5 px-3 sm:px-5 py-2.5',
                  'text-xs font-semibold transition-colors border-b-2 -mb-px touch-manipulation',
                  bottomTab === t.key
                    ? 'text-blue-400 border-blue-400'
                    : 'text-slate-500 border-transparent hover:text-slate-300',
                ].join(' ')}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}

            {/* Status row (right side) */}
            <div className="ml-auto flex items-center gap-2 sm:gap-3 px-3 sm:px-4">
              {points.length > 0 && (
                <span className="text-[11px] text-slate-500 font-mono">
                  {points.length} nodes
                </span>
              )}
              {activeResult && (
                <span className="text-[11px] text-blue-400 font-mono font-semibold whitespace-nowrap">
                  {activeResult.cost?.toFixed(2)} km
                </span>
              )}
            </div>
          </div>

          {/* Panel content — hidden when collapsed */}
          {(isMobile ? bottomExpanded : !bottomCollapsed) && (
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
              {bottomTab === 'metrics'     && (
                <MetricsPanel result={activeResult} randomCost={randomResult?.cost} />
              )}
              {bottomTab === 'convergence' && <ConvergenceChart results={results} />}
              {bottomTab === 'benchmark'   && <BenchmarkTable data={benchmarkData} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
