import type { PrismaClient, Prisma } from '../../../generated/prisma/client.ts'
import type {
  OrderInput,
  OrderItem,
  OrderRepository,
} from '../../domain/order.ts'
import { DomainError } from '../../domain/errors.ts'
import { hasCode } from './product-repository.ts'

// Retrying the entire serializable transaction prevents lost updates between
// overlapping purchases, replacements and cancellations.
async function transaction<T>(
  prisma: PrismaClient,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(run, {
        isolationLevel: 'Serializable',
        timeout: 10000,
      })
    } catch (error) {
      if (!hasCode(error, 'P2034')) throw error
      if (attempt >= 3)
        throw new DomainError(
          'CONFLICT',
          'Concurrent stock change; retry the request',
        )
    }
  }
}
async function reserve(tx: Prisma.TransactionClient, input: OrderInput) {
  const items: OrderItem[] = []
  let total = 0
  // A consistent locking order reduces deadlocks for multi-product orders.
  for (const entry of [...input].sort((a, b) => a.productId - b.productId)) {
    const product = await tx.product.findFirst({
      where: { id: entry.productId, deletedAt: null },
    })
    if (!product) throw new DomainError('NOT_FOUND', 'Product not found')
    const result = await tx.product.updateMany({
      where: {
        id: product.id,
        deletedAt: null,
        stock: { gte: entry.quantity },
      },
      data: { stock: { decrement: entry.quantity } },
    })
    if (!result.count) throw new DomainError('CONFLICT', 'Insufficient stock')
    total += product.price * entry.quantity
    if (total > 2147483647)
      throw new DomainError(
        'INVALID_INPUT',
        'Order total exceeds the supported amount',
      )
    items.push({
      ...entry,
      name: product.name,
      sku: product.sku,
      unitPrice: product.price,
    })
  }
  return { items, total }
}
async function restore(tx: Prisma.TransactionClient, items: OrderItem[]) {
  for (const item of [...items].sort((a, b) => a.productId - b.productId)) {
    // Restoration includes archived products. Keep within PostgreSQL Int range.
    const result = await tx.product.updateMany({
      where: { id: item.productId, stock: { lte: 2147483647 - item.quantity } },
      data: { stock: { increment: item.quantity } },
    })
    if (!result.count)
      throw new DomainError(
        'CONFLICT',
        'Restored stock exceeds the supported amount',
      )
  }
}
export function orderRepository(prisma: PrismaClient): OrderRepository {
  return {
    list: (userId, { limit, offset }) =>
      prisma.order.findMany({
        where: { userId },
        include: { items: true },
        orderBy: { id: 'desc' },
        take: limit,
        skip: offset,
      }),
    find: (id, userId) =>
      prisma.order.findFirst({
        where: { id, userId },
        include: { items: true },
      }),
    create: (userId, input) =>
      transaction(prisma, async (tx) => {
        const { items, total } = await reserve(tx, input)
        return tx.order.create({
          data: { userId, total, items: { create: items } },
          include: { items: true },
        })
      }),
    replace: (id, userId, input) =>
      transaction(prisma, async (tx) => {
        const order = await tx.order.findFirst({
          where: { id, userId },
          include: { items: true },
        })
        if (!order) throw new DomainError('NOT_FOUND', 'Order not found')
        if (order.status !== 'PLACED')
          throw new DomainError(
            'CONFLICT',
            'Cancelled orders cannot be changed',
          )
        await restore(tx, order.items)
        const { items, total } = await reserve(tx, input)
        return tx.order.update({
          where: { id },
          data: { total, items: { deleteMany: {}, create: items } },
          include: { items: true },
        })
      }),
    cancel: (id, userId) =>
      transaction(prisma, async (tx) => {
        const order = await tx.order.findFirst({
          where: { id, userId },
          include: { items: true },
        })
        if (!order) throw new DomainError('NOT_FOUND', 'Order not found')
        if (order.status === 'CANCELLED') return
        await restore(tx, order.items)
        await tx.order.update({ where: { id }, data: { status: 'CANCELLED' } })
      }),
  }
}
