import { DomainError } from '../../domain/errors.ts'
import type { OrderRepository } from '../../domain/order.ts'

export async function getOrder(
  orders: OrderRepository,
  id: number,
  userId: number,
) {
  const order = await orders.find(id, userId)
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found')
  return order
}
