export type Product = {
  id: number
  ownerId: number
  sku: string
  name: string
  price: number
  stock: number
  createdAt: Date
  updatedAt: Date
}
export type ProductInput = Pick<Product, 'sku' | 'name' | 'price' | 'stock'>
export type Page = { limit: number; offset: number }
export interface ProductRepository {
  list(page: Page): Promise<Product[]>
  find(id: number): Promise<Product | null>
  create(ownerId: number, input: ProductInput): Promise<Product>
  update(
    id: number,
    ownerId: number,
    input: Partial<ProductInput>,
  ): Promise<Product>
  remove(id: number, ownerId: number): Promise<void>
}
