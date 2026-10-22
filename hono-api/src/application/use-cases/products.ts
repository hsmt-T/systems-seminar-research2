import { DomainError } from '../../domain/errors.ts'
import type { ProductRepository } from '../../domain/product.ts'

export async function getProduct(products: ProductRepository, id: number) {
  const product = await products.find(id)
  if (!product) throw new DomainError('NOT_FOUND', 'Product not found')
  return product
}
