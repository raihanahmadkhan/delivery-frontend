import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { request } from './api'
import { color } from './RouteCanvas'
import type { MapConfiguration, Place, Scenario } from './types'

type Shape = { type: 'LineString'; coordinates: [number, number][] }
type Props = {
  scenario: Scenario
  routes: string[][]
  selected: string | null
  focused: number | null
  onSelect: (id: string) => void
  onFocus: (index: number | null) => void
  onPlace: (place: Place, kind: 'depot' | 'delivery') => void
  onMove: (id: string, latitude: number, longitude: number) => void
  editable: boolean
  configuration: MapConfiguration
  replay: boolean
  geometryEnabled: boolean
}

function fitStops(map: L.Map, nodes: Scenario['nodes'], padding: number) {
  map.fitBounds(L.latLngBounds(nodes.map((n) => [n.latitude!, n.longitude!])), {
    padding: [padding, padding],
    maxZoom: 15,
    animate: false,
  })
}

export default function GeographicMap(props: Props) {
  const { scenario, routes, focused, selected, configuration, editable, replay } = props
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layers = useRef<L.LayerGroup | null>(null)
  const fitted = useRef(false)
  const current = useRef(props)
  const [mode, setMode] = useState<'explore' | 'depot' | 'delivery'>('explore')
  const modeRef = useRef(mode)
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [candidate, setCandidate] = useState<Place | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [tileError, setTileError] = useState(false)
  const [shapes, setShapes] = useState<{
    key: string
    values: Record<number, Shape>
    errors: string[]
    busy: boolean
  }>({ key: '', values: {}, errors: [], busy: false })
  const searchAbort = useRef<AbortController | null>(null)
  const geometryKey = JSON.stringify([
    scenario.matrix,
    scenario.nodes.map((n) => [n.id, n.latitude, n.longitude]),
    routes,
  ])
  useEffect(() => {
    current.current = props
    modeRef.current = mode
  })

  useEffect(() => {
    if (!host.current) return
    const instance = L.map(host.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView([18.5204, 73.8567], 12)
    map.current = instance
    layers.current = L.layerGroup().addTo(instance)
    L.control.zoom({ position: 'topright' }).addTo(instance)
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(instance)
    instance.attributionControl.setPrefix(false)
    instance.on('click', (event: L.LeafletMouseEvent) => {
      const p = current.current
      if (!p.editable) return
      const place = {
        name: `Delivery ${p.scenario.nodes.filter((n) => n.id !== p.scenario.depot_id).length + 1}`,
        latitude: event.latlng.lat,
        longitude: ((((event.latlng.lng + 180) % 360) + 360) % 360) - 180,
      }
      if (Math.abs(place.latitude) > 85) return
      if (modeRef.current === 'explore') setCandidate(place)
      else
        p.onPlace(
          { ...place, name: modeRef.current === 'depot' ? 'Depot' : place.name },
          modeRef.current,
        )
    })
    const observer = new ResizeObserver(() => instance.invalidateSize())
    observer.observe(host.current)
    return () => {
      observer.disconnect()
      instance.remove()
      map.current = null
      fitted.current = false
      searchAbort.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!map.current || !configuration.tile_url) return
    const tile = L.tileLayer(configuration.tile_url, {
      maxZoom: 19,
      minZoom: 2,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      updateWhenIdle: true,
      keepBuffer: 1,
    })
    tile.on('tileerror', () => setTileError(true))
    tile.on('tileload', () => setTileError(false))
    tile.addTo(map.current)
    return () => {
      tile.remove()
    }
  }, [configuration.tile_url])

  // Fit a loaded scenario once; editing or focusing a stop should not fight the camera.
  useEffect(() => {
    if (fitted.current || !scenario.nodes.length || !map.current) return
    fitStops(map.current, scenario.nodes, 45)
    fitted.current = true
  }, [scenario.nodes])

  useEffect(() => {
    if (!scenario.matrix?.road || !routes.length || replay || !props.geometryEnabled) return
    const controller = new AbortController()
    const key = geometryKey
    const values: Record<number, Shape> = {}
    const errors: string[] = []
    async function load() {
      setShapes({ key, values: {}, errors: [], busy: true })
      // Sequential requests respect community service limits and allow partial geometry.
      for (let i = 0; i < routes.length; i++) {
        if (controller.signal.aborted) return
        if (!routes[i].length) continue
        try {
          const response = await request<{ geometry: Shape }>(
            '/road/geometry',
            { scenario, route: routes[i] },
            controller.signal,
          )
          values[i] = response.geometry
        } catch (error) {
          if (controller.signal.aborted) return
          errors.push(`Vehicle ${i + 1}: ${(error as Error).message}`)
        }
        if (!controller.signal.aborted)
          setShapes({ key, values: { ...values }, errors: [...errors], busy: true })
      }
      if (!controller.signal.aborted) setShapes({ key, values: { ...values }, errors, busy: false })
    }
    void load()
    return () => controller.abort()
    // The key contains all geometry inputs; display-only settings must not refetch roads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometryKey, replay, props.geometryEnabled])

  useEffect(() => {
    const layer = layers.current
    if (!layer) return
    layer.clearLayers()
    if (!replay && shapes.key === geometryKey) {
      for (const [index, shape] of Object.entries(shapes.values)) {
        L.polyline(
          shape.coordinates.map(([lon, lat]) => [lat, lon]),
          {
            color: color(+index),
            weight: focused === null || focused === +index ? 4 : 2,
            opacity: focused === null || focused === +index ? 0.9 : 0.2,
          },
        ).addTo(layer)
      }
    }
    if (replay)
      for (const [index, route] of routes.entries()) {
        const ids = [scenario.depot_id, ...route, scenario.depot_id]
        const points = ids.map((id) => scenario.nodes.find((n) => n.id === id)).filter((n) => !!n)
        L.polyline(
          points.map((n) => [n.latitude!, n.longitude!]),
          { color: color(index), dashArray: '4 8', weight: 2 },
        ).addTo(layer)
      }
    const deliveries = scenario.nodes.filter((node) => node.id !== scenario.depot_id)
    scenario.nodes.forEach((node) => {
      const depot = node.id === scenario.depot_id
      const vehicle = routes.findIndex((route) => route.includes(node.id))
      const dot = document.createElement('span')
      dot.className = `map-pin${depot ? ' depot' : ''}${selected === node.id ? ' selected' : ''}`
      const deliveryNumber = deliveries.findIndex((delivery) => delivery.id === node.id) + 1
      dot.textContent = depot ? 'D' : String(deliveryNumber)
      dot.style.backgroundColor = vehicle < 0 ? '#19191b' : color(vehicle)
      const marker = L.marker([node.latitude!, node.longitude!], {
        icon: L.divIcon({
          html: dot,
          className: 'map-pin-container',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        draggable: editable && !scenario.matrix,
        keyboard: true,
        title: node.name,
        alt: node.name,
        opacity: depot || focused === null || vehicle === focused ? 1 : 0.35,
      })
      const label = document.createElement('span')
      label.textContent = node.name
      marker.bindTooltip(label, { direction: 'top' })
      marker.on('click', () => current.current.onSelect(node.id))
      marker.on('dragend', () => {
        const point = marker.getLatLng()
        current.current.onMove(node.id, Math.max(-85, Math.min(85, point.lat)), point.wrap().lng)
      })
      marker.addTo(layer)
      // Leaflet's `alt` only labels image icons, not the DOM-backed pins used here.
      marker
        .getElement()
        ?.setAttribute('aria-label', node.name || (depot ? 'Depot' : `Delivery ${deliveryNumber}`))
    })
    if (candidate)
      L.circleMarker([candidate.latitude, candidate.longitude], {
        radius: 12,
        color: '#6650d8',
        weight: 2,
        fillOpacity: 0.15,
      }).addTo(layer)
  }, [scenario, routes, selected, focused, editable, shapes, geometryKey, candidate, replay])

  async function search(event: React.FormEvent) {
    event.preventDefault()
    if (query.trim().length < 2) return
    searchAbort.current?.abort()
    const controller = new AbortController()
    searchAbort.current = controller
    setSearching(true)
    setSearchError('')
    setPlaces([])
    try {
      const data = await request<Place[]>(
        `/places?q=${encodeURIComponent(query.trim())}`,
        undefined,
        controller.signal,
      )
      if (!controller.signal.aborted) {
        setPlaces(data)
        if (!data.length)
          setSearchError('No places found. Try a city, landmark, or a more specific address.')
      }
    } catch (error) {
      if (!controller.signal.aborted) setSearchError((error as Error).message)
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }

  function addCandidate(kind: 'depot' | 'delivery') {
    if (!candidate) return
    props.onPlace(
      {
        ...candidate,
        name: kind === 'depot' && candidate.name.startsWith('Delivery ') ? 'Depot' : candidate.name,
      },
      kind,
    )
    setCandidate(null)
  }

  return (
    <div className="geographic-view">
      <div className="map-toolbar">
        <form onSubmit={search} className="place-search" role="search">
          <label className="sr-only" htmlFor="place-query">
            Search cities, places, or addresses
          </label>
          <input
            id="place-query"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPlaces([])
              searchAbort.current?.abort()
              setSearching(false)
            }}
            placeholder="Search an address or place"
            maxLength={160}
          />
          <button className="secondary" disabled={searching || query.trim().length < 2}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        <button
          className="quiet"
          onClick={() => {
            if (map.current && scenario.nodes.length) fitStops(map.current, scenario.nodes, 40)
          }}
        >
          Fit stops
        </button>
      </div>
      {searchError && (
        <p className="map-message" role="status">
          {searchError}
        </p>
      )}
      {!!places.length && (
        <div className="place-results" aria-label="Place search results">
          {places.map((place, i) => (
            <button
              key={i}
              onClick={() => {
                setCandidate(place)
                setPlaces([])
                map.current?.setView([place.latitude, place.longitude], 15)
              }}
            >
              <strong>{place.name}</strong>
              <small>
                {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)} ↗
              </small>
            </button>
          ))}
        </div>
      )}
      {editable && (
        <div className="map-mode-bar">
          <span>Map tools</span>
          {(['explore', 'depot', 'delivery'] as const).map((value) => (
            <button
              key={value}
              aria-pressed={mode === value}
              className={mode === value ? 'active' : ''}
              onClick={() => {
                setMode(value)
                setCandidate(null)
              }}
            >
              {value === 'explore' ? 'Explore' : value === 'depot' ? 'Set depot' : 'Add deliveries'}
            </button>
          ))}
        </div>
      )}
      <div
        className="road-map"
        ref={host}
        aria-label="Interactive delivery map. Search for a place or use map placement controls."
      />
      {editable && candidate && (
        <div className="place-confirm" role="region" aria-label="Selected map place">
          <div>
            <strong>{candidate.name}</strong>
            <small>
              {candidate.latitude.toFixed(5)}, {candidate.longitude.toFixed(5)}
            </small>
          </div>
          <button className="secondary" onClick={() => addCandidate('depot')}>
            Use as depot
          </button>
          <button className="primary" onClick={() => addCandidate('delivery')}>
            Add delivery
          </button>
          <button
            className="quiet"
            aria-label="Dismiss selected place"
            onClick={() => setCandidate(null)}
          >
            ×
          </button>
        </div>
      )}
      {editable && (
        <button
          className="text-button map-center-action"
          onClick={() => {
            const p = map.current?.getCenter()
            if (p && Math.abs(p.lat) <= 85)
              setCandidate({ name: 'Selected location', latitude: p.lat, longitude: p.wrap().lng })
          }}
        >
          Select map center
        </button>
      )}
      {(replay || scenario.matrix) && (
        <div className="map-caption">
          <span>
            {replay
              ? 'Replay: dashed lines show stop order'
              : scenario.matrix?.road
                ? `Road data saved ${new Date(scenario.matrix.road.captured_at).toLocaleDateString()} · no live traffic`
                : scenario.matrix
                  ? 'Imported travel data · road shapes unavailable'
                  : ''}
          </span>
        </div>
      )}
      <details className="map-sources">
        <summary>Map info &amp; privacy</summary>
        <p>
          Tiles: OpenStreetMap. Place search: Photon{' '}
          {configuration.search_public ? 'community service' : 'local service'}. Roads: OSRM{' '}
          {configuration.public ? 'community service' : 'local service'}.
        </p>
        <p>
          Search text is sent to the configured search service; delivery coordinates are sent to the
          road service when you solve. Your browser requests visible map tiles. All three services
          can be self-hosted. Community services support light use and may be unavailable.
        </p>
      </details>
      {tileError && (
        <p className="map-message" role="status">
          Map tiles unavailable. Locations and routes are saved. Try again later.
        </p>
      )}
      {shapes.key === geometryKey && shapes.busy && (
        <p className="map-message" role="status">
          Loading road geometry…
        </p>
      )}
      {shapes.key === geometryKey && !!shapes.errors.length && (
        <details className="map-message">
          <summary>Some road shapes are unavailable. Route totals are saved.</summary>
          {shapes.errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </details>
      )}
      {!!routes.length && (
        <div className="route-legend">
          <button
            className={focused === null ? 'active' : ''}
            aria-pressed={focused === null}
            onClick={() => props.onFocus(null)}
          >
            All vehicles
          </button>
          {routes.map((r, i) => (
            <button
              key={i}
              className={focused === i ? 'active' : ''}
              aria-pressed={focused === i}
              onClick={() => props.onFocus(focused === i ? null : i)}
            >
              <i style={{ background: color(i) }} />
              Vehicle {i + 1}
              <small>{r.length} stops</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
