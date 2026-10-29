import { describe, expect, it, vi } from 'vitest'
import { ApiError, listAll, request } from '../src/api'

describe('API contract', () => {
  it('sends bearer authentication and JSON, and accepts a 204 response', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(
      request('/favorites/3', { method: 'PUT', token: 'token' }),
    ).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledWith(
      '/api/favorites/3',
      expect.objectContaining({
        method: 'PUT',
        headers: { Accept: 'application/json', Authorization: 'Bearer token' },
      }),
    )
    await request('/orders', {
      method: 'POST',
      token: 'token',
      body: { items: [{ productId: 3, quantity: 2 }] },
    })
    expect(fetcher).toHaveBeenLastCalledWith(
      '/api/orders',
      expect.objectContaining({
        body: '{"items":[{"productId":3,"quantity":2}]}',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    )
  })
  it('preserves conflict errors and expires only the rejected session', async () => {
    const listener = vi.fn()
    window.addEventListener('session-expired', listener)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ error: 'Insufficient stock' }, { status: 409 }),
        )
        .mockResolvedValueOnce(
          Response.json({ error: 'Unauthorized' }, { status: 401 }),
        ),
    )
    await expect(request('/orders', { token: 'old' })).rejects.toMatchObject({
      status: 409,
      message: 'Insufficient stock',
    })
    expect(listener).not.toHaveBeenCalled()
    await expect(request('/auth/me', { token: 'old' })).rejects.toBeInstanceOf(
      ApiError,
    )
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'old' }),
    )
    window.removeEventListener('session-expired', listener)
  })
  it('loads every page using the API limit and offset', async () => {
    const first = Array.from({ length: 100 }, (_, id) => ({ id }))
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ products: first }))
      .mockResolvedValueOnce(Response.json({ products: [{ id: 100 }] }))
    vi.stubGlobal('fetch', fetcher)
    expect(await listAll('/products', 'products')).toHaveLength(101)
    expect(fetcher.mock.calls.map((args) => args[0])).toEqual([
      '/api/products?limit=100&offset=0',
      '/api/products?limit=100&offset=100',
    ])
  })
  it('reports non-JSON gateway errors and preserves cancellation', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('Bad gateway', { status: 502 }))
        .mockRejectedValueOnce(new DOMException('Aborted', 'AbortError')),
    )
    await expect(request('/products')).rejects.toMatchObject({ status: 502 })
    await expect(request('/products')).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})
