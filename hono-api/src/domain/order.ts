import type { Page } from './product.ts'

export type OrderInput = { productId: number; quantity: number }[]
export type OrderItem = {
  productId: number
  quantity: number
  name: string
  sku: string
  unitPrice: number
}
export type Order = {
  id: number
  userId: number
  status: 'PLACED' | 'CANCELLED'
  total: number
  items: OrderItem[]
  createdAt: Date
  updatedAt: Date
}
export interface OrderRepository {
  list(userId: number, page: Page): Promise<Order[]>
  find(id: number, userId: number): Promise<Order | null>
  create(userId: number, items: OrderInput): Promise<Order>
  replace(id: number, userId: number, items: OrderInput): Promise<Order>
  cancel(id: number, userId: number): Promise<void>
}
