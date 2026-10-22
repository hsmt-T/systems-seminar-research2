import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, json } from './helpers.ts'
import { DomainError } from '../src/domain/errors.ts'

const authorization = { Authorization: 'Bearer test-token:1' }
async function account(app: ReturnType<typeof fixture>['app']) {
  await app.request(
    '/auth/register',
    json({ email: 'owner@example.com', password: 'a-long-password' }),
  )
}
const body = (value: unknown, method = 'POST') => ({
  ...json(value),
  method,
  headers: { ...json(value).headers, ...authorization },
})

test('all commerce mutations require authentication', async () => {
  const { app } = fixture()
  for (const [path, method] of [
    ['/products', 'POST'],
    ['/products/1', 'PATCH'],
    ['/products/1', 'DELETE'],
    ['/orders', 'GET'],
    ['/orders', 'POST'],
    ['/orders/1', 'GET'],
    ['/orders/1', 'PUT'],
    ['/orders/1', 'DELETE'],
    ['/favorites', 'GET'],
    ['/favorites/1', 'PUT'],
    ['/favorites/1', 'DELETE'],
  ])
    assert.equal(
      (await app.request(path, { method })).status,
      401,
      `${method} ${path}`,
    )
})
test('product validation rejects invalid ids, pagination, prices, stock and empty patches', async () => {
  const { app } = fixture()
  await account(app)
  for (const input of [
    null,
    [],
    {},
    { sku: 'a', name: ' ', price: 1, stock: 0 },
    ...[-1, 0.5, '10', null, 100000001].map((price) => ({
      sku: 'a',
      name: 'A',
      price,
      stock: 0,
    })),
    ...[-1, 0.1, '1', 1000001].map((stock) => ({
      sku: 'a',
      name: 'A',
      price: 1,
      stock,
    })),
  ])
    assert.equal((await app.request('/products', body(input))).status, 400)
  assert.equal(
    (await app.request('/products/1', body({}, 'PATCH'))).status,
    400,
  )
  for (const path of [
    '/products/0',
    '/products/-1',
    '/products/1.5',
    '/products/2147483648',
    '/products?limit=0',
    '/products?offset=-1',
    '/products?limit=101',
    '/products?limit=1&limit=2',
  ])
    assert.equal((await app.request(path)).status, 400, path)
  assert.equal((await app.request('/products/1')).status, 404)
})
test('orders validate items and obtain identity from the token', async () => {
  let receivedUser = 0
  const setup = fixture()
  setup.dependencies.orders.create = async (userId) => {
    receivedUser = userId
    throw new DomainError('CONFLICT', 'Insufficient stock')
  }
  await account(setup.app)
  for (const input of [
    null,
    {},
    { items: [] },
    { items: Array(51).fill({ productId: 1, quantity: 1 }) },
    ...[0, -1, 1.1, '1', 1001].map((quantity) => ({
      items: [{ productId: 1, quantity }],
    })),
    {
      items: [
        { productId: 1, quantity: 1 },
        { productId: 1, quantity: 2 },
      ],
    },
    { items: [{ productId: 0, quantity: 1 }] },
  ])
    assert.equal((await setup.app.request('/orders', body(input))).status, 400)
  assert.equal(
    (
      await setup.app.request(
        '/orders',
        body({ userId: 999, items: [{ productId: 1, quantity: 1 }] }),
      )
    ).status,
    409,
  )
  assert.equal(receivedUser, 1)
  assert.equal(
    (await setup.app.request('/orders/1', { headers: authorization })).status,
    404,
  )
})
test('favorite mutations are scoped to the authenticated account and validate product ids', async () => {
  const { app, dependencies } = fixture()
  await account(app)
  const changes: number[][] = []
  dependencies.favorites.add = async (userId, productId) => {
    changes.push([userId, productId])
  }
  assert.equal(
    (
      await app.request('/favorites/7', {
        method: 'PUT',
        headers: authorization,
      })
    ).status,
    204,
  )
  assert.deepEqual(changes, [[1, 7]])
  assert.equal(
    (
      await app.request('/favorites/0', {
        method: 'PUT',
        headers: authorization,
      })
    ).status,
    400,
  )
})
