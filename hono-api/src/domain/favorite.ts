import type { Page, Product } from './product.ts'

export interface FavoriteRepository {
  list(userId: number, page: Page): Promise<Product[]>
  add(userId: number, productId: number): Promise<void>
  remove(userId: number, productId: number): Promise<void>
}
