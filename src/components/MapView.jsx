import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import LocationSearchBar from './LocationSearchBar'


delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})


const ALGO_COLORS = {
  aco:              '#3b82f6',
  ga:               '#10b981',
  pso:              '#f59e0b',
  nearest_neighbor: '#8b5cf6',
  'nearest neighbor': '#8b5cf6',
  random:           '#ef4444',
}

function getAlgoColor(algo) {
  if (!algo) return '#3b82f6'
  const key = algo.toLowerCase().replace(/ /g, '_')
  return ALGO_COLORS[key] || '#64748b'
}


function makeCircleIcon(color, label = '', size = 22) {
  const s = size + 4
  const fontSize = size <= 22 ? 10 : 12
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
      <circle cx="${s / 2}" cy="${s / 2}" r="${size / 2}"
              fill="${color}" stroke="#fff" stroke-width="2" opacity="0.95"/>
      <text x="${s / 2}" y="${s / 2 + fontSize * 0.35}" text-anchor="middle"
            font-size="${fontSize}" fill="white" font-weight="bold" font-family="system-ui, sans-serif">${label}</text>
    </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    popupAnchor: [0, -(size / 2 + 6)],
  })
}

function makeDepotIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="38" viewBox="0 0 32 38">
      <path d="M16 0 C7.163 0 0 7.163 0 16 C0 28 16 38 16 38 C16 38 32 28 32 16 C32 7.163 24.837 0 16 0Z"
            fill="#f59e0b" stroke="#fff" stroke-width="2"/>
      <text x="16" y="21" text-anchor="middle" font-size="12" fill="white" font-weight="bold">D</text>
    </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 38],
    iconAnchor: [16, 38],
    popupAnchor: [0, -38],
  })
}

// India geographic centre — good default view showing the whole country
const INDIA_CENTER = [20.5937, 78.9629]
const INDIA_ZOOM   = 5


export default function MapView({ points, results, activeRoute, onMapClick, overlayAll, onAddPoint }) {
  const mapContainerRef = useRef(null)
  const mapRef          = useRef(null)
  const markersLayerRef = useRef(null)
  const routeLayersRef  = useRef({})

  // ── Initialise map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: INDIA_CENTER,
      zoom:   INDIA_ZOOM,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    markersLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ── Map-click → add point ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const handler = (e) => onMapClick?.({ latitude: e.latlng.lat, longitude: e.latlng.lng })
    map.on('click', handler)
    return () => map.off('click', handler)
  }, [onMapClick])

  // ── Render markers ────────────────────────────────────────────────────────
  useEffect(() => {
    const map   = mapRef.current
    const layer = markersLayerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    if (points.length === 0) return

    points.forEach((pt, idx) => {
      const isDepot = idx === 0
      const icon    = isDepot ? makeDepotIcon() : makeCircleIcon('#3b82f6', String(idx))
      const marker  = L.marker([pt.latitude, pt.longitude], { icon })

      const popupHtml = `
        <div style="min-width:160px">
          <div style="font-weight:600;font-size:14px;margin-bottom:6px;color:#f1f5f9">
            ${isDepot ? '🏭 ' : '📦 '}${pt.name || `Node ${pt.id}`}
          </div>
          <div style="font-size:12px;color:#94a3b8;line-height:1.6">
            <div>ID: <span style="color:#e2e8f0">${pt.id}</span></div>
            <div>Lat: <span style="color:#e2e8f0">${pt.latitude.toFixed(5)}</span></div>
            <div>Lng: <span style="color:#e2e8f0">${pt.longitude.toFixed(5)}</span></div>
            ${pt.demand != null && pt.demand > 0
              ? `<div>Demand: <span style="color:#e2e8f0">${pt.demand}</span></div>`
              : ''}
            ${pt.time_window_start != null
              ? `<div>Window: <span style="color:#e2e8f0">${pt.time_window_start}–${pt.time_window_end} min</span></div>`
              : ''}
          </div>
        </div>`

      marker.bindPopup(popupHtml, { maxWidth: 220 })

      // Permanent label beneath marker with name
      const displayName = pt.name || (isDepot ? 'Depot' : `Point ${idx}`)
      const labelHtml = isDepot ? `<b>Depot</b> – ${pt.name || ''}` : `<b>${idx}</b> ${displayName}`
      marker.bindTooltip(labelHtml, {
        permanent: true,
        direction: 'bottom',
        offset: [0, isDepot ? 4 : 8],
        className: 'map-node-label',
      })

      layer.addLayer(marker)
    })

    // Fit map to new point set
    if (points.length >= 2) {
      map.fitBounds(
        L.latLngBounds(points.map(p => [p.latitude, p.longitude])),
        { padding: [48, 48], maxZoom: 12 }
      )
    } else if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 11)
    }
  }, [points])

  // ── Render route polylines ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    Object.values(routeLayersRef.current).forEach(l => map.removeLayer(l))
    routeLayersRef.current = {}

    if (!results || points.length < 2) return

    const toDraw = overlayAll
      ? Object.entries(results)
      : activeRoute && results[activeRoute]
        ? [[activeRoute, results[activeRoute]]]
        : []

    toDraw.forEach(([algo, result]) => {
      if (!result?.route) return

      const routePts = result.route.map(i => points[i]).filter(Boolean)
      if (routePts.length < 2) return

      const latLngs = [...routePts, routePts[0]].map(p => [p.latitude, p.longitude])
      const color   = getAlgoColor(result.algorithm || algo)

      const poly = L.polyline(latLngs, {
        color,
        weight:    overlayAll ? 3 : 4,
        opacity:   overlayAll ? 0.7 : 0.9,
        dashArray: overlayAll && algo !== activeRoute ? '8 4' : null,
        lineJoin:  'round',
        lineCap:   'round',
      })

      poly.bindTooltip(
        `<span style="color:${color};font-weight:600">${result.algorithm || algo}</span><br>
         Distance: <strong>${result.cost?.toFixed(2)} km</strong>`,
        { sticky: true, opacity: 0.92 }
      )

      poly.addTo(map)
      routeLayersRef.current[algo] = poly
    })
  }, [results, activeRoute, overlayAll, points])

  // ── Search-bar city selection ─────────────────────────────────────────────
  const handleSearchSelect = useCallback(({ name, lat, lon }) => {
    if (!onAddPoint) return

    const isDepot = points.length === 0
    onAddPoint({
      name:      isDepot ? `Depot – ${name}` : name,
      latitude:  lat,
      longitude: lon,
      demand:    isDepot ? 0 : 10,
    })

    // Fly the map to the selected city
    mapRef.current?.flyTo([lat, lon], 11, { duration: 1.2 })
  }, [onAddPoint, points])

  return (
    <div className="relative w-full h-full">
      {/* Leaflet map */}
      <div ref={mapContainerRef} className="w-full h-full rounded-xl" />

      {/* Search bar overlay */}
      <LocationSearchBar onSelect={handleSearchSelect} />

      {/* Empty-state hint */}
      {points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-600
                          rounded-xl px-6 py-4 text-center">
            <div className="text-3xl mb-2">🗺️</div>
            <p className="text-slate-300 text-sm font-medium">Search a city above or click the map</p>
            <p className="text-slate-500 text-xs mt-1">to add delivery points</p>
          </div>
        </div>
      )}

      {/* Route legend */}
      {Object.keys(results).length > 0 && (
        <div className="absolute bottom-4 right-4 sm:right-auto sm:left-4
                        bg-slate-900/90 backdrop-blur-sm border border-slate-700
                        rounded-lg p-2 sm:p-3 text-xs space-y-1 sm:space-y-1.5 z-[500]
                        max-w-[180px] sm:max-w-none">
          <div className="text-slate-400 font-semibold mb-1.5 sm:mb-2 uppercase tracking-wide text-[10px]">
            Routes
          </div>
          {Object.entries(results).map(([key, res]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="w-5 sm:w-6 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: getAlgoColor(res.algorithm || key) }}
              />
              <span className="text-slate-300 truncate">{res.algorithm || key}</span>
              <span className="text-slate-500 whitespace-nowrap">{res.cost?.toFixed(1)} km</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
