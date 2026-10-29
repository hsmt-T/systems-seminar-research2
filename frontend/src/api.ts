export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
export async function request<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    token?: string | null
    signal?: AbortSignal
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method || 'GET',
      headers,
      signal: options.signal,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'AbortError'
    )
      throw error
    throw new Error(
      'API に接続できません。API の起動状況を確認して再度お試しください。',
    )
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    if (response.status === 401 && options.token) {
      window.dispatchEvent(
        new CustomEvent('session-expired', { detail: options.token }),
      )
    }
    throw new ApiError(
      response.status,
      data?.error || `リクエストに失敗しました (${response.status})`,
    )
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
// API に total がないため、100件ずつ取得して全件検索と所有者判定を行う。
export async function listAll<T>(
  path: string,
  key: string,
  token?: string | null,
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = []
  for (let offset = 0; offset <= 1_000_000; offset += 100) {
    const page = await request<Record<string, T[]>>(
      `${path}?limit=100&offset=${offset}`,
      { token, signal },
    )
    items.push(...page[key])
    if (page[key].length < 100) break
  }
  return items
}
export const money = (value: number) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(
    value,
  )
export const date = (value: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : '処理に失敗しました。再度お試しください。'
