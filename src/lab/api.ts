import type { Scenario } from './types'

const raw = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')
if (raw && !/^https?:\/\//.test(raw)) throw new Error('VITE_API_URL must be an HTTP(S) URL')
export const API = raw ? (raw.endsWith('/api') ? raw : `${raw}/api`) : '/api'

async function responseData(response: Response) {
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw Object.assign(
      new Error(
        `Server returned HTTP ${response.status} without valid JSON. Check the API connection.`,
      ),
      { status: response.status },
    )
  }
  if (!response.ok) {
    const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : null
    const message = Array.isArray(detail)
      ? detail
          .filter((item) => item && typeof item === 'object' && typeof item.msg === 'string')
          .map((item: { loc?: (string | number)[]; msg: string }) => {
            const field = Array.isArray(item.loc) ? item.loc.slice(1).join('.') : ''
            return field ? `${field}: ${item.msg}` : item.msg
          })
          .join('; ')
      : typeof detail === 'string'
        ? detail
        : ''
    throw Object.assign(new Error(message || `Request failed (HTTP ${response.status})`), {
      status: response.status,
    })
  }
  return data
}

async function fetchData<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, init)
  return (await responseData(response)) as T
}

export async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  return fetchData<T>(path, {
    method: body === undefined ? 'GET' : 'POST',
    signal,
    headers:
      body === undefined
        ? undefined
        : { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function upload(file: File) {
  if (file.size > 2 * 1024 * 1024) throw new Error('Scenario files may be at most 2 MB')
  const body = new FormData()
  body.append('file', file)
  return fetchData<Scenario>('/import', { method: 'POST', body })
}

export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
