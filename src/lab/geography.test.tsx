import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import GeographicMap from './GeographicMap'
import L from 'leaflet'
import { changePlace, newRoadScenario } from './state'

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

function props() {
  return {
    scenario: newRoadScenario(),
    routes: [],
    selected: null,
    focused: null,
    onSelect: vi.fn(),
    onFocus: vi.fn(),
    onPlace: vi.fn(),
    onMove: vi.fn(),
    editable: true,
    configuration: { configured: true },
    replay: false,
    geometryEnabled: false,
  }
}

describe('geographic map interactions', () => {
  it('loads default map tiles even when the route service is unavailable', () => {
    const tiles = vi.spyOn(L, 'tileLayer')
    render(<GeographicMap {...props()} configuration={{ configured: false }} />)
    expect(tiles).toHaveBeenCalledWith(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.any(Object),
    )
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy()
  })

  it('replaces default tiles with the configured provider when it arrives', () => {
    const tiles = vi.spyOn(L, 'tileLayer')
    const p = props()
    const { rerender } = render(<GeographicMap {...p} />)
    const previousLayer = tiles.mock.results[0].value as L.TileLayer
    const remove = vi.spyOn(previousLayer, 'remove')
    const tile_url = 'https://maps.example.com/{z}/{x}/{y}.png'
    rerender(<GeographicMap {...p} configuration={{ configured: true, tile_url }} />)
    expect(remove).toHaveBeenCalled()
    expect(tiles).toHaveBeenLastCalledWith(tile_url, expect.any(Object))
  })

  it('zooms in and out with the wheel and consumes scrolling only inside the map', async () => {
    const createMap = vi.spyOn(L, 'map')
    const { container, unmount } = render(<GeographicMap {...props()} />)
    const instance = createMap.mock.results[0].value as L.Map
    const host = container.querySelector('.road-map')!
    const wheel = (deltaY: number) =>
      new WheelEvent('wheel', {
        deltaY,
        clientX: 100,
        clientY: 100,
        bubbles: true,
        cancelable: true,
      })
    const initialZoom = instance.getZoom()
    const up = wheel(-120)
    fireEvent(host, up)
    expect(up.defaultPrevented).toBe(true)
    await waitFor(() => expect(instance.getZoom()).toBeGreaterThan(initialZoom))
    const zoomedIn = instance.getZoom()
    const down = wheel(120)
    fireEvent(host, down)
    expect(down.defaultPrevented).toBe(true)
    await waitFor(() => expect(instance.getZoom()).toBeLessThan(zoomedIn))

    for (const [zoom, delta] of [
      [19, -120],
      [2, 120],
    ]) {
      instance.setZoom(zoom)
      const atLimit = wheel(delta)
      fireEvent(host, atLimit)
      expect(atLimit.defaultPrevented).toBe(true)
      await new Promise((resolve) => setTimeout(resolve, 60))
      expect(instance.getZoom()).toBe(zoom)
    }
    const outside = wheel(120)
    fireEvent(document.body, outside)
    expect(outside.defaultPrevented).toBe(false)

    unmount()
    const afterUnmount = wheel(120)
    fireEvent(host, afterUnmount)
    expect(afterUnmount.defaultPrevented).toBe(false)
  })

  it('shows search suggestions safely and keeps depot placement explicit', async () => {
    const place = { name: '<img src=x onerror=alert(1)>', latitude: 18.52, longitude: 73.85 }
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([place])))
    vi.stubGlobal('fetch', fetch)
    const p = props()
    const { container } = render(<GeographicMap {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Set depot' }))
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Search cities, places, or addresses' }),
      {
        target: { value: 'Pune' },
      },
    )
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('option', { name: /<img src=x/ }))
    expect(container.querySelector('img[src="x"]')).toBeNull()
    expect(p.onPlace).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Use as depot' }).className).toBe('primary')
    fireEvent.click(screen.getByRole('button', { name: 'Use as depot' }))
    expect(p.onPlace).toHaveBeenCalledWith(place, 'depot')
  })

  it('smoothly centers the map on selection and supplies map-center search bias', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    const fly = vi.spyOn(L.Map.prototype, 'flyTo').mockReturnThis()
    const place = { name: 'Mumbai, Maharashtra, India', latitude: 19.07, longitude: 72.88 }
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([place])))
    vi.stubGlobal('fetch', fetch)
    render(<GeographicMap {...props()} />)
    const input = screen.getByRole('combobox', { name: 'Search cities, places, or addresses' })
    fireEvent.change(input, { target: { value: 'Mumbai' } })
    fireEvent.click(await screen.findByRole('option', { name: place.name }))
    expect(fly).toHaveBeenCalledWith([place.latitude, place.longitude], 15, { duration: 0.8 })
    const url = new URL(fetch.mock.calls[0][0], 'http://localhost')
    expect(url.searchParams.get('latitude')).toBe('18.5204')
    expect(Number(url.searchParams.get('longitude'))).toBeCloseTo(73.8567, 6)
    expect(screen.getByRole('region', { name: 'Selected map place' }).textContent).toContain(
      place.name,
    )
  })

  it('honors reduced motion and never offers placement on an immutable map', async () => {
    const view = vi.spyOn(L.Map.prototype, 'setView')
    const fly = vi.spyOn(L.Map.prototype, 'flyTo')
    const place = { name: 'Pune, Maharashtra, India', latitude: 18.52, longitude: 73.85 }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([place]))))
    const p = props()
    render(<GeographicMap {...p} editable={false} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Pune' } })
    fireEvent.click(await screen.findByRole('option', { name: place.name }))
    await waitFor(() => expect(view).toHaveBeenCalledWith([place.latitude, place.longitude], 15))
    expect(fly).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Use as depot' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add delivery' })).toBeNull()
    expect(p.onPlace).not.toHaveBeenCalled()
  })

  it('does not request geometry for live search progress', () => {
    const p = props()
    const draft = changePlace(
      changePlace(newRoadScenario(), { name: 'Depot', latitude: 18.52, longitude: 73.85 }, 'depot'),
      { name: 'Stop', latitude: 18.53, longitude: 73.86 },
      'delivery',
    )
    p.scenario = {
      ...draft,
      matrix: {
        distances_km: [
          [0, 1],
          [2, 0],
        ],
        durations_minutes: [
          [0, 3],
          [4, 0],
        ],
        source: 'test',
        profile: 'driving',
        data_version: 'test',
        road: {
          engine: 'a'.repeat(64),
          coordinates_hash: 'b'.repeat(64),
          captured_at: '2026-09-23T00:00:00Z',
          hints: ['', ''],
          snapped: [
            [73.85, 18.52],
            [73.86, 18.53],
          ],
        },
      },
    }
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(<GeographicMap {...p} routes={[[draft.nodes[1].id]]} geometryEnabled={false} />)
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy()
  })

  it('shows final stop order for geographic straight-line routes without calling road services', () => {
    const p = props()
    const draft = changePlace(
      changePlace(newRoadScenario(), { name: 'Depot', latitude: 18.52, longitude: 73.85 }, 'depot'),
      { name: 'Stop', latitude: 18.53, longitude: 73.86 },
      'delivery',
    )
    const route = [draft.nodes[1].id]
    const lines = vi.spyOn(L, 'polyline')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(
      <GeographicMap
        {...p}
        scenario={{ ...draft, travel_model: 'straight_line' }}
        routes={[route]}
        geometryEnabled
      />,
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(lines).toHaveBeenCalledWith(
      [
        [18.52, 73.85],
        [18.53, 73.86],
        [18.52, 73.85],
      ],
      expect.objectContaining({ dashArray: '4 8' }),
    )
    expect(screen.getByText('Straight-line travel · dashed lines show stop order')).toBeTruthy()
  })
})
