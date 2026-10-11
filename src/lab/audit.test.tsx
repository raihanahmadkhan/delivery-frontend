import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RouteCanvas, { COLORS } from './RouteCanvas'
import RouteLab from './RouteLab'
import StopEditor from './StopEditor'
import { changePlace, isDraft, newRoadScenario, parseSeeds, jobFromHash } from './state'
import { request, upload } from './api'
import type { Scenario } from './types'

vi.mock('./GeographicMap', () => ({
  default: ({ scenario: s }: { scenario: Scenario }) => (
    <div aria-label="Geographic workspace">{s.nodes.length} map places</div>
  ),
}))

const scenario: Scenario = {
  name: 'Audit scenario',
  description: 'Test fixture',
  depot_id: 'd',
  coordinate_mode: 'cartesian',
  speed_kph: 30,
  fleet: { count: 2, capacity: 10, start_time: 0, end_time: 100, max_distance_km: null },
  nodes: [
    {
      id: 'd',
      name: 'Depot',
      x: 0,
      y: 0,
      demand: 0,
      service_minutes: 0,
      window_start: 0,
      window_end: 100,
    },
    {
      id: 'a',
      name: '<img src=x onerror=alert(1)>',
      x: 1,
      y: 1,
      demand: 2,
      service_minutes: 5,
      window_start: 0,
      window_end: 100,
    },
  ],
}

beforeEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('input and identity guards', () => {
  it('rejects corrupt persisted state without crashing', () => {
    expect(isDraft(scenario)).toBe(true)
    expect(isDraft({ ...scenario, nodes: 'ab' })).toBe(false)
    expect(isDraft({ ...scenario, nodes: [null, null] })).toBe(false)
    expect(isDraft({ ...scenario, depot_id: 'missing' })).toBe(false)
    expect(isDraft({ ...scenario, nodes: [scenario.nodes[0], scenario.nodes[0]] })).toBe(false)
  })
  it('does not silently convert an empty seed to zero', () => {
    expect(parseSeeds('0, 42')).toEqual([0, 42])
    for (const input of ['', '1,', '1,1', '-1', '2147483648', '1.2'])
      expect(() => parseSeeds(input)).toThrow()
  })
  it('rejects hash route injection', () => {
    expect(jobFromHash('#run=' + 'a'.repeat(32))).toBe('a'.repeat(32))
    expect(jobFromHash('#run=../../presets')).toBeNull()
  })
})

describe('safe, accessible route rendering', () => {
  it('keeps small ivory route labels readable across the vehicle palette', () => {
    function luminance(hex: string) {
      const values = hex
        .slice(1)
        .match(/../g)!
        .map((v) => parseInt(v, 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722
    }
    for (const color of COLORS)
      expect((luminance('#fcfaf6') + 0.05) / (luminance(color) + 0.05)).toBeGreaterThanOrEqual(4.5)
  })
  it('renders malicious labels as text and supports keyboard selection', () => {
    const select = vi.fn()
    const { container } = render(
      <RouteCanvas
        scenario={scenario}
        routes={[['a']]}
        selected={null}
        onSelect={select}
        focusedVehicle={null}
        onFocus={vi.fn()}
      />,
    )
    expect(container.querySelector('img')).toBeNull()
    const node = screen.getByRole('button', { name: /<img src=x/ })
    fireEvent.keyDown(node, { key: 'Enter' })
    expect(select).toHaveBeenCalledWith('a')
    expect(screen.getByRole('group', { name: /Delivery routes/ })).toBeTruthy()
  })
  it('locks coordinate changes to imported matrices', () => {
    render(
      <StopEditor
        scenario={{
          ...scenario,
          matrix: {
            distances_km: [
              [0, 1],
              [1, 0],
            ],
            durations_minutes: [
              [0, 2],
              [2, 0],
            ],
            source: 'test',
            profile: 'test',
            data_version: '1',
          },
        }}
        node={scenario.nodes[1]}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    )
    expect((screen.getByLabelText('X (km)') as HTMLInputElement).disabled).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Remove stop' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})

describe('API failures', () => {
  it('explains non-JSON proxy failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })),
    )
    await expect(request('/runs')).rejects.toThrow('HTTP 502')
  })
  it('rejects oversized imports before uploading', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(
      upload(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.json')),
    ).rejects.toThrow('2 MB')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('workbench interactions', () => {
  function mockAPI(seedDraft = true) {
    if (seedDraft && localStorage.getItem('routelab.scenario.v1') === null)
      localStorage.setItem('routelab.scenario.v1', JSON.stringify(scenario))
    const fetch = vi.fn(async (url: string | URL | Request) => {
      const path = String(url)
      const body = path.endsWith('/presets')
        ? { presets: [] }
        : path.endsWith('/capabilities')
          ? { algorithms: ['greedy', 'alns', 'exact'] }
          : path.endsWith('/road-status')
            ? { configured: false }
            : path.endsWith('/presets/harbor')
              ? scenario
              : []
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetch)
    return fetch
  }
  it('recovers from corrupt draft storage and traps JSON dialog focus', async () => {
    localStorage.setItem(
      'routelab.scenario.v1',
      JSON.stringify({ nodes: 'ab', fleet: {}, depot_id: 'd' }),
    )
    mockAPI(false)
    render(<RouteLab />)
    await waitFor(() => expect(screen.getByDisplayValue('Untitled route')).toBeTruthy())
    expect(await screen.findByLabelText('Geographic workspace')).toBeTruthy()
    fireEvent.click(screen.getByText('Files & samples'))
    const open = screen.getByRole('button', { name: 'Edit JSON' })
    open.focus()
    fireEvent.click(open)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText('Scenario JSON'))
    const apply = screen.getByRole('button', { name: 'Validate & apply' })
    apply.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close editor' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(open)
  })
  it('names the active study and limits the mobile settings toggle to editable views', async () => {
    mockAPI()
    render(<RouteLab />)
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Audit scenario' })).toBeTruthy(),
    )
    const toggle = screen.getByRole('button', { name: 'Route settings' })
    const expanded = toggle.getAttribute('aria-expanded')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).not.toBe(expanded)
    expect(screen.getByRole('complementary', { name: 'Route setup' }).id).toBe(
      toggle.getAttribute('aria-controls'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.queryByRole('button', { name: 'Route settings' })).toBeNull()
    expect(screen.getByRole('button', { name: 'History' }).getAttribute('aria-current')).toBe(
      'page',
    )
  })
  it('does not show unrelated draft geometry while a saved run is loading', async () => {
    localStorage.setItem('routelab.scenario.v1', JSON.stringify(scenario))
    history.replaceState(null, '', '#run=' + 'a'.repeat(32))
    const fetch = mockAPI()
    fetch.mockImplementation(async (url) =>
      String(url).includes('/runs/')
        ? await new Promise<Response>(() => {})
        : new Response(
            JSON.stringify(
              String(url).endsWith('/capabilities')
                ? { algorithms: [] }
                : String(url).endsWith('/presets')
                  ? { presets: [] }
                  : String(url).endsWith('/road-status')
                    ? { configured: false }
                    : [],
            ),
          ),
    )
    vi.stubGlobal(
      'EventSource',
      class {
        addEventListener() {}
        close() {}
      },
    )
    render(<RouteLab />)
    expect(screen.queryByRole('group', { name: /Delivery routes/ })).toBeNull()
  })
  it('does not let a delayed saved snapshot overwrite a newer draft edit', async () => {
    const fetch = mockAPI()
    const fallback = fetch.getMockImplementation()!
    let resolveSnapshot!: (response: Response) => void
    fetch.mockImplementation(async (url) => {
      if (String(url).endsWith('/scenarios/saved'))
        return await new Promise<Response>((resolve) => {
          resolveSnapshot = resolve
        })
      if (String(url).endsWith('/scenarios'))
        return new Response(JSON.stringify([{ id: 'saved', name: 'Saved scenario', created: 0 }]))
      return fallback(url)
    })
    render(<RouteLab />)
    await waitFor(() => expect(screen.getByDisplayValue('Audit scenario')).toBeTruthy())
    await waitFor(() => expect(screen.getByLabelText('Saved routes')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Saved routes'), { target: { value: 'saved' } })
    fireEvent.change(screen.getByLabelText('Route name', { exact: true }), {
      target: { value: 'Newer edit' },
    })
    resolveSnapshot(new Response(JSON.stringify({ ...scenario, name: 'Old saved snapshot' })))
    await waitFor(() => expect(screen.getByDisplayValue('Newer edit')).toBeTruthy())
    expect(screen.queryByDisplayValue('Old saved snapshot')).toBeNull()
  })
  it('keeps navigation names available when mobile CSS hides the labels', async () => {
    mockAPI()
    render(<RouteLab />)
    for (const name of ['Plan', 'Compare', 'History']) {
      expect(screen.getByRole('button', { name }).getAttribute('aria-label')).toBe(name)
    }
    await waitFor(() => expect(screen.getByDisplayValue('Audit scenario')).toBeTruthy())
  })

  it('submits the frozen road snapshot and never submits a failed road request', async () => {
    const draft = changePlace(
      changePlace(newRoadScenario(), { name: 'Depot', latitude: 18.52, longitude: 73.85 }, 'depot'),
      { name: 'Delivery', latitude: 18.53, longitude: 73.86 },
      'delivery',
    )
    localStorage.setItem('routelab.scenario.v1', JSON.stringify(draft))
    const fetch = mockAPI()
    const fallback = fetch.getMockImplementation()!
    const frozen = {
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
        source: 'OSRM test',
        profile: 'driving',
        data_version: 'v1',
      },
    }
    let roadsAvailable = false
    const submissions: { scenario: Scenario }[] = []
    fetch.mockImplementation(async (url, init?: RequestInit) => {
      if (String(url).endsWith('/road-status'))
        return new Response(JSON.stringify({ configured: true, max_customers: 25 }))
      if (String(url).endsWith('/matrices/road'))
        return roadsAvailable
          ? new Response(JSON.stringify(frozen))
          : new Response(JSON.stringify({ detail: 'Road engine unavailable' }), { status: 422 })
      if (String(url).endsWith('/runs') && init?.method === 'POST') {
        submissions.push(JSON.parse(String(init.body)))
        return new Response(JSON.stringify({ detail: 'Test stops before creating a job' }), {
          status: 503,
        })
      }
      return fallback(url)
    })
    render(<RouteLab />)
    fireEvent.click(screen.getByRole('button', { name: '04 Solve' }))
    const solve = await screen.findByRole('button', { name: 'Plan routes →' })
    await waitFor(() => expect((solve as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(solve)
    await screen.findByText('Road engine unavailable')
    expect(submissions).toHaveLength(0)
    roadsAvailable = true
    fireEvent.click(screen.getByRole('button', { name: 'Plan routes →' }))
    await waitFor(() => expect(submissions).toHaveLength(1))
    expect(submissions[0].scenario).toEqual(frozen)
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('routelab.scenario.v1')!).matrix).toEqual(
        frozen.matrix,
      ),
    )
    await screen.findByText('Test stops before creating a job')
  })
})

describe('geographic draft identity', () => {
  it('persists an empty road draft and clears road matrices when locations change', () => {
    const blank = newRoadScenario()
    expect(isDraft(blank)).toBe(true)
    const depot = changePlace(
      blank,
      { name: 'Warehouse', latitude: 18.52, longitude: 73.85 },
      'depot',
    )
    const draft = changePlace(
      depot,
      { name: 'Shop', latitude: 18.53, longitude: 73.86 },
      'delivery',
    )
    expect(draft.nodes).toHaveLength(2)
    expect(draft.nodes[0].demand).toBe(0)
    expect(draft.travel_model).toBe('road')
    expect(
      isDraft({ ...draft, nodes: [{ ...draft.nodes[0], latitude: 1000 }, draft.nodes[1]] }),
    ).toBe(false)
    const frozen = {
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
        source: 'roads',
        profile: 'driving',
        data_version: 'test',
      },
    }
    const moved = changePlace(
      frozen,
      { name: 'New warehouse', latitude: 19, longitude: 73 },
      'depot',
    )
    expect(moved.matrix).toBeNull()
    expect(moved.nodes).toHaveLength(2)
    expect(frozen.matrix.distances_km[0][1]).toBe(1)
  })
})
