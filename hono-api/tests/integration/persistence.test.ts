import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { PrismaClient } from '../../.wrangler/prisma-node/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { productRepository } from '../../src/infrastructure/persistence/product-repository.ts'
import { orderRepository } from '../../src/infrastructure/persistence/order-repository.ts'
import { favoriteRepository } from '../../src/infrastructure/persistence/favorite-repository.ts'

const connection = process.env.DATABASE_URL ?? ''
if (new URL(connection).pathname !== '/ec_api_test')
  throw new Error('Use the dedicated ec_api_test database')

test('real PostgreSQL: atomic stock, concurrent purchases/cancellations, ownership and favorites', async () => {
  const client = () =>
    new PrismaClient({
      adapter: new PrismaPg({ connectionString: connection, max: 2 }),
    })
  const db = client()
  const db2 = client()
  const products = productRepository(db)
  const orders = orderRepository(db)
  const otherOrders = orderRepository(db2)
  const favorites = favoriteRepository(db)
  const prefix = randomUUID()
  const owner = await db.user.create({
    data: { email: `${prefix}-owner@example.com`, pass: 'unused' },
  })
  const buyer = await db.user.create({
    data: { email: `${prefix}-buyer@example.com`, pass: 'unused' },
  })
  const users = [owner.id, buyer.id]
  const conflict = (error: unknown) =>
    error instanceof Error && 'code' in error && error.code === 'CONFLICT'
  const missing = (error: unknown) =>
    error instanceof Error && 'code' in error && error.code === 'NOT_FOUND'
  const stock = async (id: number) =>
    (await db.product.findUniqueOrThrow({ where: { id } })).stock
  try {
    const a = await products.create(owner.id, {
      sku: `${prefix}-a`,
      name: 'A',
      price: 100,
      stock: 5,
    })
    const b = await products.create(owner.id, {
      sku: `${prefix}-b`,
      name: 'B',
      price: 200,
      stock: 1,
    })
    await assert.rejects(
      products.create(owner.id, {
        sku: a.sku,
        name: 'Duplicate',
        price: 1,
        stock: 1,
      }),
      conflict,
    )
    await assert.rejects(products.update(a.id, buyer.id, { stock: 9 }), missing)
    await assert.rejects(products.remove(a.id, buyer.id), missing)
    const saved = await products.update(a.id, owner.id, { name: 'Updated A' })
    assert.equal(saved.name, 'Updated A')

    // The first stock reservation must roll back if a later item is unavailable.
    await assert.rejects(
      orders.create(buyer.id, [
        { productId: a.id, quantity: 2 },
        { productId: b.id, quantity: 2 },
      ]),
      conflict,
    )
    assert.equal(await stock(a.id), 5)
    assert.equal(await db.order.count({ where: { userId: buyer.id } }), 0)
    await assert.rejects(
      orders.create(buyer.id, [
        { productId: a.id, quantity: 1 },
        { productId: 2147483647, quantity: 1 },
      ]),
      missing,
    )
    assert.equal(await stock(a.id), 5)
    const placed = await orders.create(buyer.id, [
      { productId: a.id, quantity: 2 },
    ])
    assert.equal(placed.total, 200)
    assert.equal(await stock(a.id), 3)
    assert.equal(await orders.find(placed.id, owner.id), null)
    await assert.rejects(
      orders.replace(placed.id, owner.id, [{ productId: a.id, quantity: 1 }]),
      missing,
    )
    await assert.rejects(orders.cancel(placed.id, owner.id), missing)
    assert.equal(
      (await orders.list(buyer.id, { limit: 1, offset: 0 }))[0].id,
      placed.id,
    )
    await products.update(a.id, owner.id, { price: 150 })
    assert.equal(
      (await orders.find(placed.id, buyer.id))?.items[0].unitPrice,
      100,
    )
    await assert.rejects(
      orders.replace(placed.id, buyer.id, [{ productId: b.id, quantity: 2 }]),
      conflict,
    )
    assert.equal(await stock(a.id), 3)
    assert.equal((await orders.find(placed.id, buyer.id))?.total, 200)
    const changed = await orders.replace(placed.id, buyer.id, [
      { productId: a.id, quantity: 3 },
    ])
    assert.equal(changed.total, 450)
    assert.equal(await stock(a.id), 2)

    // Separate clients/pools exercise overlapping transactions, rather than a
    // single pool with max=1 silently serializing requests before the database.
    const results = await Promise.allSettled([
      orders.create(buyer.id, [{ productId: b.id, quantity: 1 }]),
      otherOrders.create(owner.id, [{ productId: b.id, quantity: 1 }]),
    ])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    const failed = results.find((r) => r.status === 'rejected')
    assert.ok(failed?.status === 'rejected' && conflict(failed.reason))
    assert.equal(await stock(b.id), 0)
    await Promise.all([
      orders.cancel(placed.id, buyer.id),
      otherOrders.cancel(placed.id, buyer.id),
    ])
    assert.equal(await stock(a.id), 5)
    assert.equal((await orders.find(placed.id, buyer.id))?.status, 'CANCELLED')
    await assert.rejects(
      orders.replace(placed.id, buyer.id, [{ productId: a.id, quantity: 1 }]),
      conflict,
    )

    await Promise.all([
      favorites.add(buyer.id, a.id),
      favoriteRepository(db2).add(buyer.id, a.id),
    ])
    assert.equal(
      await db.favorite.count({ where: { userId: buyer.id, productId: a.id } }),
      1,
    )
    assert.equal(
      (await favorites.list(buyer.id, { limit: 50, offset: 0 }))[0].id,
      a.id,
    )
    assert.deepEqual(
      await favorites.list(owner.id, { limit: 50, offset: 0 }),
      [],
    )
    await favorites.remove(owner.id, a.id)
    assert.equal(
      (await favorites.list(buyer.id, { limit: 50, offset: 0 })).length,
      1,
    )
    await favorites.remove(buyer.id, a.id)
    await favorites.remove(buyer.id, a.id)
    await favorites.add(buyer.id, a.id)
    const archivedOrder = await orders.create(buyer.id, [
      { productId: a.id, quantity: 1 },
    ])
    await products.remove(a.id, owner.id)
    assert.equal(await products.find(a.id), null)
    assert.deepEqual(
      await favorites.list(buyer.id, { limit: 50, offset: 0 }),
      [],
    )
    await assert.rejects(favorites.add(buyer.id, a.id), missing)
    await assert.rejects(
      orders.create(buyer.id, [{ productId: a.id, quantity: 1 }]),
      missing,
    )
    await orders.cancel(archivedOrder.id, buyer.id)
    assert.equal(await stock(a.id), 5)
    assert.equal(
      (await orders.find(archivedOrder.id, buyer.id))?.items[0].name,
      'Updated A',
    )

    const costly = await products.create(owner.id, {
      sku: `${prefix}-costly`,
      name: 'Costly',
      price: 100000000,
      stock: 100,
    })
    await assert.rejects(
      orders.create(buyer.id, [{ productId: costly.id, quantity: 100 }]),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        error.code === 'INVALID_INPUT',
    )
    assert.equal(await stock(costly.id), 100)
  } finally {
    // Delete only this test's records; never reset a shared development DB.
    await db.favorite.deleteMany({ where: { userId: { in: users } } })
    await db.order.deleteMany({ where: { userId: { in: users } } })
    await db.product.deleteMany({ where: { ownerId: { in: users } } })
    await db.user.deleteMany({ where: { id: { in: users } } })
    await Promise.all([db.$disconnect(), db2.$disconnect()])
  }
})
