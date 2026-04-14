import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 120_000,
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      'Unknown error'
    return Promise.reject(new Error(message))
  }
)

export async function optimize({ points, algorithm, params, constraints, distanceMode = 'haversine' }) {
  const { data } = await client.post('/optimize', {
    points,
    algorithm,
    params,
    constraints,
    distance_mode: distanceMode,
  })
  return data
}

export async function benchmark({ points, algorithms, params, constraints, distanceMode = 'haversine', nRuns = 1 }) {
  const { data } = await client.post('/benchmark', {
    points,
    algorithms,
    params,
    constraints,
    distance_mode: distanceMode,
    n_runs: nRuns,
  })
  return data
}

export async function listPresets() {
  const { data } = await client.get('/presets')
  return data.available
}

export async function loadPreset(name) {
  const { data } = await client.get(`/presets/${name}`)
  return data.points
}

export async function uploadCSV(file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await client.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.points
}
