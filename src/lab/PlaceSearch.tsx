import { useEffect, useId, useRef, useState } from 'react'
import { request } from './api'
import type { Place } from './types'

const MIN_QUERY_LENGTH = 2

type Bias = { latitude: number; longitude: number }
type Props = {
  onSelect: (place: Place) => void
  onClear: () => void
  getBias: () => Bias | undefined
}

export default function PlaceSearch({ onSelect, onClear, getBias }: Props) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sequence = useRef(0)
  const selectedQuery = useRef<string | null>(null)
  const bias = useRef(getBias)
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const searchText = query.trim()
  const expanded = open && searchText.length >= MIN_QUERY_LENGTH

  useEffect(() => {
    bias.current = getBias
  }, [getBias])

  useEffect(() => {
    if (searchText.length < MIN_QUERY_LENGTH || searchText === selectedQuery.current) return
    const current = ++sequence.current
    const pending = new AbortController()
    controller.current = pending
    timer.current = setTimeout(async () => {
      const params = new URLSearchParams({ q: searchText })
      const center = bias.current()
      if (center) {
        params.set('latitude', String(center.latitude))
        params.set('longitude', String(center.longitude))
      }
      try {
        const data = await request<Place[]>(`/places?${params}`, undefined, pending.signal)
        if (pending.signal.aborted || current !== sequence.current) return
        setPlaces(data)
        setStatus('ready')
      } catch (cause) {
        if (pending.signal.aborted || current !== sequence.current) return
        setError((cause as Error).message)
        setStatus('error')
      }
    }, 500)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      pending.abort()
    }
  }, [query, searchText])

  function cancel() {
    sequence.current++
    controller.current?.abort()
    if (timer.current) clearTimeout(timer.current)
  }

  function updateQuery(value: string) {
    cancel()
    selectedQuery.current = null
    setQuery(value)
    setPlaces([])
    setActive(-1)
    setError('')
    setStatus(value.trim().length >= MIN_QUERY_LENGTH ? 'loading' : 'idle')
    setOpen(value.trim().length >= MIN_QUERY_LENGTH)
    onClear()
  }

  function choose(place: Place) {
    cancel()
    selectedQuery.current = place.name.trim()
    setQuery(place.name)
    setOpen(false)
    setActive(-1)
    setStatus('idle')
    onSelect(place)
    input.current?.focus()
  }

  return (
    <div
      className="place-search"
      role="search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false)
          setActive(-1)
        }
      }}
    >
      <div className="place-search-input">
        <svg className="place-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </svg>
        <label className="sr-only" htmlFor={id}>
          Search cities, places, or addresses
        </label>
        <input
          type="text"
          id={id}
          ref={input}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={`${id}-results`}
          aria-activedescendant={expanded && active >= 0 ? `${id}-place-${active}` : undefined}
          autoComplete="off"
          value={query}
          placeholder="Search an address or place"
          maxLength={160}
          onChange={(event) => updateQuery(event.target.value)}
          onFocus={() => {
            if (searchText.length >= MIN_QUERY_LENGTH && selectedQuery.current === null)
              setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
              setActive(-1)
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (!places.length || searchText === selectedQuery.current) return
              setOpen(true)
              setActive((index) =>
                event.key === 'ArrowDown'
                  ? (index + 1) % places.length
                  : index <= 0
                    ? places.length - 1
                    : index - 1,
              )
            } else if (event.key === 'Enter' && expanded && places.length) {
              event.preventDefault()
              choose(places[active >= 0 ? active : 0])
            }
          }}
        />
        {query && (
          <button
            className="place-search-clear"
            aria-label="Clear place search"
            onClick={() => {
              updateQuery('')
              input.current?.focus()
            }}
          >
            ×
          </button>
        )}
      </div>
      {expanded && (
        <div className="place-results">
          <div id={`${id}-results`} role="listbox" aria-label="Place suggestions">
            {places.map((place, index) => (
              <button
                key={`${place.latitude}-${place.longitude}-${index}`}
                id={`${id}-place-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={active === index}
                className={active === index ? 'active' : ''}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(place)}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <span>{place.name}</span>
              </button>
            ))}
          </div>
          {status === 'loading' && (
            <p className="place-search-status" role="status">
              <span className="place-search-spinner" aria-hidden="true" />
              Searching places…
            </p>
          )}
          {status === 'ready' && !places.length && (
            <p className="place-search-status" role="status">
              No places found. Try a more specific address.
            </p>
          )}
          {status === 'error' && (
            <p className="place-search-status place-search-error" role="status">
              Search unavailable. {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
