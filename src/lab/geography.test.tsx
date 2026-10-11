import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import GeographicMap from './GeographicMap'
import { changePlace, newRoadScenario } from './state'

beforeEach(() => {
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
  it('searches only on submission and renders place labels as text', async () => {
    const place = { name: '<img src=x onerror=alert(1)>', latitude: 18.52, longitude: 73.85 }
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([place])))
    vi.stubGlobal('fetch', fetch)
    const p = props()
    const { container } = render(<GeographicMap {...p} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search cities, places, or addresses' }), {
      target: { value: 'Pune' },
    })
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    fireEvent.click(await screen.findByRole('button', { name: /<img src=x/ }))
    expect(container.querySelector('img')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Use as depot' }))
    expect(p.onPlace).toHaveBeenCalledWith(place, 'depot')
  })

  it('aborts old searches when the query changes', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn(
      (...args: [string, RequestInit]) =>
        new Promise<Response>((resolve) => {
          expect(args[1].signal).toBeTruthy()
          finish = resolve
        }),
    )
    vi.stubGlobal('fetch', fetch)
    render(<GeographicMap {...props()} />)
    const input = screen.getByRole('textbox', { name: 'Search cities, places, or addresses' })
    fireEvent.change(input, { target: { value: 'Pune' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    fireEvent.change(input, { target: { value: 'Mumbai' } })
    expect(fetch.mock.calls[0][1].signal?.aborted).toBe(true)
    finish(
      new Response(JSON.stringify([{ name: 'Old result', latitude: 18.52, longitude: 73.85 }])),
    )
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Search' }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    )
    expect(screen.queryByText('Old result')).toBeNull()
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
})
