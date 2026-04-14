

import { useState, useCallback } from 'react'
import { optimize, benchmark, loadPreset, uploadCSV } from '../utils/api'


const DEFAULT_PARAMS = {
  aco: { n_ants: 20, n_iterations: 100, alpha: 1.0, beta: 2.0, rho: 0.5, q: 100, elitist_weight: 2.0 },
  ga:  { population_size: 50, n_generations: 100, crossover_rate: 0.85, mutation_rate: 0.15, tournament_size: 5, elitism_count: 2 },
  pso: { n_particles: 30, n_iterations: 100, inertia_weight: 0.7, c1: 1.5, c2: 1.5, max_velocity: 4 },
  nearest_neighbor: {},
  random: { n_trials: 20 },
}

const DEFAULT_CONSTRAINTS = {
  num_vehicles: 1,
  vehicle_capacity: 1e9,   
  max_distance: 1e9,
}

export function useOptimizer() {
  
  const [points, setPoints] = useState([])

  
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('aco')
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [constraints, setConstraints] = useState(DEFAULT_CONSTRAINTS)
  const [distanceMode, setDistanceMode] = useState('haversine')

  
  const [results, setResults] = useState({})         
  const [benchmarkData, setBenchmarkData] = useState(null)  
  const [activeRoute, setActiveRoute] = useState(null)      

  
  const [loading, setLoading] = useState(false)
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)
  const [error, setError] = useState(null)

  

  const addPoint = useCallback((point) => {
    setPoints((prev) => {
      const id = prev.length === 0 ? 0 : Math.max(...prev.map((p) => p.id)) + 1
      return [...prev, { ...point, id, name: point.name || `Node ${id}` }]
    })
  }, [])

  const removePoint = useCallback((id) => {
    setPoints((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const clearPoints = useCallback(() => {
    setPoints([])
    setResults({})
    setBenchmarkData(null)
    setActiveRoute(null)
  }, [])

  const loadPresetPoints = useCallback(async (presetName) => {
    setError(null)
    try {
      const pts = await loadPreset(presetName)
      setPoints(pts)
      setResults({})
      setBenchmarkData(null)
      setActiveRoute(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const loadCSVPoints = useCallback(async (file) => {
    setError(null)
    try {
      const pts = await uploadCSV(file)
      setPoints(pts)
      setResults({})
      setBenchmarkData(null)
      setActiveRoute(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  

  const updateParam = useCallback((algo, key, value) => {
    setParams((prev) => ({
      ...prev,
      [algo]: { ...prev[algo], [key]: value },
    }))
  }, [])

  const updateConstraint = useCallback((key, value) => {
    setConstraints((prev) => ({ ...prev, [key]: value }))
  }, [])

  

  const runOptimize = useCallback(async () => {
    if (points.length < 2) {
      setError('Add at least 2 delivery points before optimizing.')
      return
    }
    setError(null)
    setLoading(true)

    try {
      const result = await optimize({
        points,
        algorithm: selectedAlgorithm,
        params: params[selectedAlgorithm] || {},
        constraints,
        distanceMode,
      })
      setResults((prev) => ({ ...prev, [selectedAlgorithm]: result }))
      setActiveRoute(selectedAlgorithm)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [points, selectedAlgorithm, params, constraints, distanceMode])

  

  const runBenchmark = useCallback(async (selectedAlgos = ['aco', 'ga', 'pso', 'nearest_neighbor', 'random']) => {
    if (points.length < 2) {
      setError('Add at least 2 delivery points before benchmarking.')
      return
    }
    setError(null)
    setBenchmarkLoading(true)

    
    const mergedParams = Object.assign({}, ...Object.values(params))

    try {
      const data = await benchmark({
        points,
        algorithms: selectedAlgos,
        params: mergedParams,
        constraints,
        distanceMode,
        nRuns: 1,
      })
      setBenchmarkData(data)

      
      const newResults = {}
      for (const entry of data.results) {
        newResults[entry.algorithm.toLowerCase().replace(/ /g, '_')] = entry
      }
      setResults((prev) => ({ ...prev, ...newResults }))

      
      if (data.results.length > 0) {
        const best = data.results[0]
        setActiveRoute(best.algorithm.toLowerCase().replace(/ /g, '_'))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBenchmarkLoading(false)
    }
  }, [points, params, constraints, distanceMode])

  return {
    
    points, selectedAlgorithm, params, constraints, distanceMode,
    results, benchmarkData, activeRoute,
    loading, benchmarkLoading, error,

    
    addPoint, removePoint, clearPoints,
    loadPresetPoints, loadCSVPoints,
    setSelectedAlgorithm, updateParam, updateConstraint, setDistanceMode,
    runOptimize, runBenchmark,
    setActiveRoute,
  }
}
