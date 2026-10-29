import { useEffect, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SessionProvider, useSession } from '../src/session'
import Auth from '../src/pages/Auth'
import Manage from '../src/pages/Manage'
import Cart from '../src/pages/Cart'
import Orders from '../src/pages/Orders'
import Catalog from '../src/pages/Catalog'
import type { CartItem, Product } from '../src/types'

const products: Product[] = [
  {
    id: 1,
    ownerId: 1,
    name: 'マグカップ',
    sku: 'MUG-1',
    price: 1200,
    stock: 5,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 2,
    ownerId: 2,
    name: 'プレート',
    sku: 'PLATE-1',
    price: 2000,
    stock: 0,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
]
const user = {
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  createdAt: '2026-10-01T00:00:00Z',
}
function mockApi(
  handler?: (url: string, init: RequestInit) => Response | undefined,
) {
  const fetcher = vi.fn(async (url: string, init: RequestInit = {}) => {
    const custom = handler?.(url, init)
    if (custom) return custom
    if (url.includes('/auth/me')) return Response.json({ user })
    if (url.includes('/products?')) return Response.json({ products })
    if (url.includes('/favorites?')) return Response.json({ products: [] })
    throw new Error(`Unexpected request ${init.method} ${url}`)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function SeedCart({ items }: { items: CartItem[] }) {
  const { setCart } = useSession()
  useEffect(() => {
    setCart(items)
  }, [items, setCart])
  return null
}
function renderPage(
  page: ReactNode,
  {
    authenticated = true,
    cart,
  }: { authenticated?: boolean; cart?: CartItem[] } = {},
) {
  if (authenticated) sessionStorage.setItem('kurashi.session.v1', 'test-token')
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <MemoryRouter>
          {cart && <SeedCart items={cart} />}
          <Routes>
            <Route path="/" element={page} />
            <Route path="/orders" element={<h1>注文受付画面</h1>} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  )
}
describe('EC user flows', () => {
  it('registers, then logs in with the same credentials', async () => {
    const fetcher = mockApi((url) =>
      url.endsWith('/auth/register')
        ? Response.json({ user }, { status: 201 })
        : url.endsWith('/auth/login')
          ? Response.json({
              user,
              accessToken: 'new-token',
              tokenType: 'Bearer',
              expiresIn: 3600,
            })
          : undefined,
    )
    renderPage(<Auth />, { authenticated: false })
    const ui = userEvent.setup()
    await ui.click(screen.getByRole('button', { name: '新規会員登録' }))
    await ui.type(screen.getByLabelText('メールアドレス'), 'alice@example.com')
    await ui.type(screen.getByLabelText('パスワード'), 'a-long-password')
    await ui.click(screen.getByRole('button', { name: '登録してはじめる' }))
    await waitFor(() =>
      expect(sessionStorage.getItem('kurashi.session.v1')).toBe('new-token'),
    )
    expect(
      fetcher.mock.calls
        .filter(([url]) => url.includes('/auth/'))
        .slice(0, 2)
        .map(([url]) => url),
    ).toEqual(['/api/auth/register', '/api/auth/login'])
    expect(sessionStorage.length).toBe(1)
  })
  it('filters products by name and stock', async () => {
    mockApi()
    renderPage(<Catalog />)
    await screen.findByRole('heading', { name: 'マグカップ' })
    const ui = userEvent.setup()
    await ui.click(screen.getByLabelText('在庫ありのみ'))
    expect(
      screen.queryByRole('heading', { name: 'プレート' }),
    ).not.toBeInTheDocument()
    await ui.type(screen.getByRole('searchbox'), '存在しない商品')
    expect(await screen.findByText('商品が見つかりません')).toBeInTheDocument()
  })
  it('shows only owned products in management and submits valid product data', async () => {
    const fetcher = mockApi((url, init) =>
      url === '/api/products' && init.method === 'POST'
        ? Response.json({ product: products[0] }, { status: 201 })
        : undefined,
    )
    renderPage(<Manage />)
    await screen.findByText('マグカップ')
    expect(screen.queryByText('プレート')).not.toBeInTheDocument()
    const ui = userEvent.setup()
    await ui.click(screen.getByRole('button', { name: '＋ 商品を登録' }))
    await ui.type(screen.getByLabelText('商品名'), '花瓶')
    await ui.type(screen.getByLabelText('SKU', { exact: false }), 'VASE-1')
    await ui.click(screen.getByRole('button', { name: '保存する' }))
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(
          ([url, init]) =>
            url === '/api/products' &&
            init?.body === '{"sku":"VASE-1","name":"花瓶","price":0,"stock":0}',
        ),
      ).toBe(true),
    )
  })
  it('creates an order using only product IDs and quantities, then clears the bag', async () => {
    const fetcher = mockApi((url, init) =>
      url === '/api/orders' && init.method === 'POST'
        ? Response.json({ order: { id: 7 } }, { status: 201 })
        : undefined,
    )
    renderPage(<Cart />, { cart: [{ productId: 1, quantity: 2 }] })
    const ui = userEvent.setup()
    await ui.click(
      await screen.findByRole('button', { name: '注文を確定する' }),
    )
    await screen.findByRole('heading', { name: '注文受付画面' })
    expect(
      fetcher.mock.calls.find(([url]) => url === '/api/orders')?.[1],
    ).toMatchObject({
      method: 'POST',
      body: '{"items":[{"productId":1,"quantity":2}]}',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    })
  })
  it('replaces order items with PUT and cancels with DELETE after confirmation', async () => {
    const order = {
      id: 7,
      userId: 1,
      status: 'PLACED',
      total: 2400,
      items: [
        {
          productId: 1,
          name: 'マグカップ',
          sku: 'MUG-1',
          unitPrice: 1200,
          quantity: 2,
        },
      ],
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    }
    const fetcher = mockApi((url, init) =>
      url.includes('/orders?')
        ? Response.json({ orders: [order] })
        : url === '/api/orders/7'
          ? init.method === 'DELETE'
            ? new Response(null, { status: 204 })
            : Response.json({ order })
          : undefined,
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage(<Orders />)
    const ui = userEvent.setup()
    await ui.click(await screen.findByRole('button', { name: '注文を変更' }))
    const input = screen.getByRole('spinbutton', { name: 'マグカップの数量' })
    await ui.clear(input)
    await ui.type(input, '3')
    await ui.click(screen.getByRole('button', { name: 'この内容に変更する' }))
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(
          ([url, init]) =>
            url === '/api/orders/7' &&
            init?.method === 'PUT' &&
            init.body === '{"items":[{"productId":1,"quantity":3}]}',
        ),
      ).toBe(true),
    )
    await waitFor(() =>
      expect(screen.queryByText('注文内容を変更')).not.toBeInTheDocument(),
    )
    await ui.click(screen.getByRole('button', { name: '注文を取り消す' }))
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(
          ([url, init]) => url === '/api/orders/7' && init?.method === 'DELETE',
        ),
      ).toBe(true),
    )
    expect(window.confirm).toHaveBeenCalled()
  })
  it('discards an expired token', async () => {
    mockApi((url) =>
      url === '/api/auth/me'
        ? Response.json({ error: 'Expired' }, { status: 401 })
        : undefined,
    )
    renderPage(<Catalog />)
    await waitFor(() =>
      expect(sessionStorage.getItem('kurashi.session.v1')).toBeNull(),
    )
  })
})
