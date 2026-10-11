const raw = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
if (raw && !/^https?:\/\//.test(raw)) throw new Error('VITE_API_URL must be an HTTP(S) URL')
export const API = raw ? (raw.endsWith('/api') ? raw : `${raw}/api`) : '/api'

async function responseData(response: Response) {
  try {
    return await response.json()
  } catch {
    throw new Error(
      `Server returned HTTP ${response.status} without valid JSON. Check the API connection.`,
    )
  }
}

export async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    signal,
    headers:
      body === undefined
        ? undefined
        : { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await responseData(response)
  if (!response.ok) {
    const detail = data.detail
    throw new Error(
      Array.isArray(detail)
        ? detail
            .map(
              (item: { loc?: (string | number)[]; msg: string }) =>
                `${item.loc?.slice(1).join('.')}: ${item.msg}`,
            )
            .join('; ')
        : detail || 'Request failed',
    )
  }
  return data as T
}

export async function upload(file: File) {
  if (file.size > 2 * 1024 * 1024) throw new Error('Scenario files may be at most 2 MB')
  const body = new FormData()
  body.append('file', file)
  const response = await fetch(`${API}/import`, { method: 'POST', body })
  const data = await responseData(response)
  if (!response.ok) throw new Error(data.detail || 'Import failed')
  return data
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
