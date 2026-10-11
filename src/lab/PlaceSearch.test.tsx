import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PlaceSearch from './PlaceSearch'

const pune = { name: 'Pune, Maharashtra, India', latitude: 18.52, longitude: 73.85 }
const mumbai = { name: 'Mumbai, Maharashtra, India', latitude: 19.07, longitude: 72.88 }

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function setup() {
  const props = {
    onSelect: vi.fn(),
    onClear: vi.fn(),
    getBias: () => ({ latitude: 18.52, longitude: 73.85 }),
  }
  const view = render(<PlaceSearch {...props} />)
  const input = screen.getByRole('combobox', { name: 'Search cities, places, or addresses' })
  return { ...view, ...props, input }
}

async function debounce() {
  await act(() => vi.advanceTimersByTimeAsync(500))
}

describe('place suggestions', () => {
  it('debounces typing and sends the current map center as a location preference', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([pune])))
    vi.stubGlobal('fetch', fetch)
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'P' } })
    await debounce()
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'Pun' } })
    await act(() => vi.advanceTimersByTimeAsync(350))
    fireEvent.change(input, { target: { value: 'Pune' } })
    await act(() => vi.advanceTimersByTimeAsync(350))
    expect(fetch).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(150))
    expect(fetch).toHaveBeenCalledTimes(1)
    const url = new URL(fetch.mock.calls[0][0], 'http://localhost')
    expect(url.searchParams.get('q')).toBe('Pune')
    expect(url.searchParams.get('latitude')).toBe('18.52')
    expect(url.searchParams.get('longitude')).toBe('73.85')
    expect(screen.getByRole('option', { name: pune.name })).toBeTruthy()
  })

  it('keeps two-character place searches available without requesting a single character', async () => {
    const place = { name: 'Los Angeles, California, USA', latitude: 34.05, longitude: -118.24 }
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([place])))
    vi.stubGlobal('fetch', fetch)
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'L' } })
    await debounce()
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'LA' } })
    await debounce()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(new URL(fetch.mock.calls[0][0], 'http://localhost').searchParams.get('q')).toBe('LA')
    expect(screen.getByRole('option', { name: place.name })).toBeTruthy()
  })

  it('rejects stale responses even when the search provider ignores cancellation', async () => {
    const pending: { resolve: (response: Response) => void; signal: AbortSignal }[] = []
    const fetch = vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise<Response>((resolve) => pending.push({ resolve, signal: options.signal! })),
    )
    vi.stubGlobal('fetch', fetch)
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'Pune' } })
    await debounce()
    fireEvent.change(input, { target: { value: 'Mumbai' } })
    expect(pending[0].signal.aborted).toBe(true)
    await debounce()
    await act(async () => pending[1].resolve(new Response(JSON.stringify([mumbai]))))
    await act(async () => pending[0].resolve(new Response(JSON.stringify([pune]))))
    expect(screen.queryByRole('option', { name: pune.name })).toBeNull()
    expect(screen.getByRole('option', { name: mumbai.name })).toBeTruthy()
  })

  it('supports arrow selection and Enter without searching the selected address again', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([pune, mumbai])))
    vi.stubGlobal('fetch', fetch)
    const { input, onSelect } = setup()
    fireEvent.change(input, { target: { value: 'Maharashtra' } })
    await debounce()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: mumbai.name }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(input.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: mumbai.name }).id,
    )
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(mumbai)
    expect((input as HTMLInputElement).value).toBe(mumbai.name)
    expect(input.getAttribute('aria-expanded')).toBe('false')
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('supports click selection, Escape, and clearing the search', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([pune]))))
    const { input, onSelect, onClear } = setup()
    fireEvent.change(input, { target: { value: 'Pune' } })
    await debounce()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.click(screen.getByRole('option', { name: pune.name }))
    expect(onSelect).toHaveBeenCalledWith(pune)
    onClear.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Clear place search' }))
    expect((input as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onClear).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(input)
  })

  it('shows loading, empty, and service error states', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([])))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Try again later.' }), { status: 503 }),
      )
    vi.stubGlobal('fetch', fetch)
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'Unknown place' } })
    expect(screen.getByRole('status').textContent).toContain('Searching places')
    await debounce()
    expect(screen.getByRole('status').textContent).toContain('No places found')
    fireEvent.change(input, { target: { value: 'Another place' } })
    await debounce()
    expect(screen.getByRole('status').textContent).toContain('Search unavailable. Try again later.')
  })

  it('keeps whitespace edits from leaving a cancelled search stuck loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([pune]))))
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'Pune' } })
    await act(() => vi.advanceTimersByTimeAsync(250))
    fireEvent.change(input, { target: { value: 'Pune ' } })
    await debounce()
    expect(screen.getByRole('option', { name: pune.name })).toBeTruthy()
  })
})
