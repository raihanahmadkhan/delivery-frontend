import { useState, useRef, useEffect, useCallback } from 'react'

// 50 major Indian cities with state info and real coordinates
const INDIAN_CITIES = [
  { name: 'Mumbai',           state: 'Maharashtra',    lat: 19.0760, lon: 72.8777 },
  { name: 'Delhi',            state: 'Delhi',          lat: 28.7041, lon: 77.1025 },
  { name: 'Bengaluru',        state: 'Karnataka',      lat: 12.9716, lon: 77.5946 },
  { name: 'Hyderabad',        state: 'Telangana',      lat: 17.3850, lon: 78.4867 },
  { name: 'Ahmedabad',        state: 'Gujarat',        lat: 23.0225, lon: 72.5714 },
  { name: 'Chennai',          state: 'Tamil Nadu',     lat: 13.0827, lon: 80.2707 },
  { name: 'Kolkata',          state: 'West Bengal',    lat: 22.5726, lon: 88.3639 },
  { name: 'Surat',            state: 'Gujarat',        lat: 21.1702, lon: 72.8311 },
  { name: 'Pune',             state: 'Maharashtra',    lat: 18.5204, lon: 73.8567 },
  { name: 'Jaipur',           state: 'Rajasthan',      lat: 26.9124, lon: 75.7873 },
  { name: 'Lucknow',          state: 'Uttar Pradesh',  lat: 26.8467, lon: 80.9462 },
  { name: 'Kanpur',           state: 'Uttar Pradesh',  lat: 26.4499, lon: 80.3319 },
  { name: 'Nagpur',           state: 'Maharashtra',    lat: 21.1458, lon: 79.0882 },
  { name: 'Indore',           state: 'Madhya Pradesh', lat: 22.7196, lon: 75.8577 },
  { name: 'Thane',            state: 'Maharashtra',    lat: 19.2183, lon: 72.9781 },
  { name: 'Bhopal',           state: 'Madhya Pradesh', lat: 23.2599, lon: 77.4126 },
  { name: 'Visakhapatnam',    state: 'Andhra Pradesh', lat: 17.6868, lon: 83.2185 },
  { name: 'Patna',            state: 'Bihar',          lat: 25.5941, lon: 85.1376 },
  { name: 'Vadodara',         state: 'Gujarat',        lat: 22.3072, lon: 73.1812 },
  { name: 'Ghaziabad',        state: 'Uttar Pradesh',  lat: 28.6692, lon: 77.4538 },
  { name: 'Ludhiana',         state: 'Punjab',         lat: 30.9010, lon: 75.8573 },
  { name: 'Agra',             state: 'Uttar Pradesh',  lat: 27.1767, lon: 78.0081 },
  { name: 'Nashik',           state: 'Maharashtra',    lat: 19.9975, lon: 73.7898 },
  { name: 'Faridabad',        state: 'Haryana',        lat: 28.4089, lon: 77.3178 },
  { name: 'Meerut',           state: 'Uttar Pradesh',  lat: 28.9845, lon: 77.7064 },
  { name: 'Rajkot',           state: 'Gujarat',        lat: 22.3039, lon: 70.8022 },
  { name: 'Varanasi',         state: 'Uttar Pradesh',  lat: 25.3176, lon: 82.9739 },
  { name: 'Aurangabad',       state: 'Maharashtra',    lat: 19.8762, lon: 75.3433 },
  { name: 'Dhanbad',          state: 'Jharkhand',      lat: 23.7957, lon: 86.4304 },
  { name: 'Amritsar',         state: 'Punjab',         lat: 31.6340, lon: 74.8723 },
  { name: 'Allahabad',        state: 'Uttar Pradesh',  lat: 25.4358, lon: 81.8463 },
  { name: 'Ranchi',           state: 'Jharkhand',      lat: 23.3441, lon: 85.3096 },
  { name: 'Howrah',           state: 'West Bengal',    lat: 22.5958, lon: 88.2636 },
  { name: 'Coimbatore',       state: 'Tamil Nadu',     lat: 11.0168, lon: 76.9558 },
  { name: 'Jabalpur',         state: 'Madhya Pradesh', lat: 23.1815, lon: 79.9864 },
  { name: 'Gwalior',          state: 'Madhya Pradesh', lat: 26.2183, lon: 78.1828 },
  { name: 'Vijayawada',       state: 'Andhra Pradesh', lat: 16.5062, lon: 80.6480 },
  { name: 'Jodhpur',          state: 'Rajasthan',      lat: 26.2389, lon: 73.0243 },
  { name: 'Madurai',          state: 'Tamil Nadu',     lat:  9.9252, lon: 78.1198 },
  { name: 'Raipur',           state: 'Chhattisgarh',   lat: 21.2514, lon: 81.6296 },
  { name: 'Kota',             state: 'Rajasthan',      lat: 25.2138, lon: 75.8648 },
  { name: 'Chandigarh',       state: 'Chandigarh',     lat: 30.7333, lon: 76.7794 },
  { name: 'Guwahati',         state: 'Assam',          lat: 26.1445, lon: 91.7362 },
  { name: 'Solapur',          state: 'Maharashtra',    lat: 17.6805, lon: 75.9064 },
  { name: 'Hubli',            state: 'Karnataka',      lat: 15.3647, lon: 75.1240 },
  { name: 'Mysuru',           state: 'Karnataka',      lat: 12.2958, lon: 76.6394 },
  { name: 'Tiruchirappalli',  state: 'Tamil Nadu',     lat: 10.7905, lon: 78.7047 },
  { name: 'Bareilly',         state: 'Uttar Pradesh',  lat: 28.3670, lon: 79.4304 },
  { name: 'Aligarh',          state: 'Uttar Pradesh',  lat: 27.8974, lon: 78.0880 },
  { name: 'Moradabad',        state: 'Uttar Pradesh',  lat: 28.8386, lon: 78.7733 },
]

export default function LocationSearchBar({ onSelect }) {
  const [query, setQuery]         = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen]           = useState(false)
  const [fetching, setFetching]   = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef   = useRef(null)
  const debounceId = useRef(null)
  const containerRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setActiveIdx(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const doSearch = useCallback((q) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setSuggestions([])
      setOpen(false)
      setFetching(false)
      clearTimeout(debounceId.current)
      return
    }

    // Instant local results
    const lower = trimmed.toLowerCase()
    const local = INDIAN_CITIES
      .filter(c =>
        c.name.toLowerCase().startsWith(lower) ||
        c.name.toLowerCase().includes(lower) ||
        c.state.toLowerCase().includes(lower)
      )
      .slice(0, 5)
      .map(c => ({ ...c, source: 'local', display: `${c.name}, ${c.state}` }))

    setSuggestions(local)
    setOpen(local.length > 0)
    setActiveIdx(-1)

    // Nominatim geocoding for anything beyond the local list
    clearTimeout(debounceId.current)
    debounceId.current = setTimeout(async () => {
      try {
        setFetching(true)
        const url =
          `https://nominatim.openstreetmap.org/search` +
          `?q=${encodeURIComponent(trimmed)}` +
          `&countrycodes=in&format=json&limit=4&addressdetails=1`
        const res  = await fetch(url, { headers: { 'Accept-Language': 'en-IN,en' } })
        const data = await res.json()

        const remote = data
          .filter(d => d.lat && d.lon)
          .map(d => {
            const parts    = d.display_name.split(',').map(s => s.trim())
            const cityName = d.name || parts[0]
            const state    = d.address?.state || parts[parts.length - 2] || 'India'
            return {
              name:    cityName,
              state,
              lat:     parseFloat(d.lat),
              lon:     parseFloat(d.lon),
              display: d.display_name,
              source:  'nominatim',
            }
          })
          .slice(0, 3)

        setSuggestions(prev => {
          const localNames = new Set(prev.map(p => p.name.toLowerCase()))
          const filtered   = remote.filter(r => !localNames.has(r.name.toLowerCase()))
          return [...prev, ...filtered].slice(0, 7)
        })
        setOpen(true)
      } catch {
        // Nominatim unavailable — local results still shown
      } finally {
        setFetching(false)
      }
    }, 650)
  }, [])

  useEffect(() => {
    doSearch(query)
    return () => clearTimeout(debounceId.current)
  }, [query, doSearch])

  const handleSelect = useCallback((city) => {
    onSelect({ name: city.name, lat: city.lat, lon: city.lon })
    setQuery('')
    setSuggestions([])
    setOpen(false)
    setActiveIdx(-1)
    inputRef.current?.blur()
  }, [onSelect])

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0) handleSelect(suggestions[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
      inputRef.current?.blur()
    }
  }

  const clearInput = () => {
    setQuery('')
    setSuggestions([])
    setOpen(false)
    setActiveIdx(-1)
    inputRef.current?.focus()
  }

  return (
    <div
      ref={containerRef}
      className="absolute top-3 right-3 z-[500] w-72"
      // Prevent Leaflet from capturing scroll / click inside the bar
      onWheel={e => e.stopPropagation()}
    >
      {/* Input */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd" />
          </svg>
        </span>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search city or location…"
          className="w-full pl-9 pr-8 py-2.5 text-sm bg-slate-900/95 backdrop-blur-md
                     border border-slate-600/80 rounded-xl text-slate-100
                     placeholder:text-slate-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     shadow-xl transition-all"
        />

        {/* Spinner / clear */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {fetching ? (
            <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          ) : query ? (
            <button
              onClick={clearInput}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              tabIndex={-1}
              aria-label="Clear search"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute top-full mt-1.5 w-full
                        bg-slate-900/98 backdrop-blur-md
                        border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <ul className="py-1 max-h-64 overflow-y-auto">
            {suggestions.map((city, idx) => (
              <li key={`${city.name}-${idx}`}>
                <button
                  onMouseDown={e => e.preventDefault()} // keep focus in input
                  onClick={() => handleSelect(city)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors
                    ${idx === activeIdx ? 'bg-blue-600/25 text-white' : 'hover:bg-slate-800 text-slate-200'}`}
                >
                  {/* Icon */}
                  <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs leading-none
                    ${city.source === 'local' ? 'bg-blue-600/20 text-blue-300' : 'bg-slate-700 text-slate-400'}`}>
                    {city.source === 'local' ? '🏙' : '📍'}
                  </span>

                  {/* Text */}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium leading-tight truncate">
                      {city.name}
                    </span>
                    <span className="block text-[11px] text-slate-500 truncate leading-tight mt-0.5">
                      {city.source === 'local'
                        ? city.state
                        : city.display?.split(',').slice(1, 4).join(', ').trim()}
                    </span>
                  </span>

                  {/* Coords */}
                  <span className="shrink-0 text-[10px] text-slate-600 font-mono">
                    {city.lat.toFixed(2)}°
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Footer hint */}
          <div className="px-3 py-1.5 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-600">Click to add as route point</span>
            <span className="text-[10px] text-slate-700">↑↓ · Enter · Esc</span>
          </div>
        </div>
      )}

      {/* Empty state when query entered but no results yet */}
      {open && suggestions.length === 0 && query.trim() && !fetching && (
        <div className="absolute top-full mt-1.5 w-full
                        bg-slate-900/98 border border-slate-700 rounded-xl shadow-xl px-4 py-3">
          <p className="text-sm text-slate-500 text-center">No results found for "{query}"</p>
        </div>
      )}
    </div>
  )
}
