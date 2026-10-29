export interface User {
  id: number
  email: string
  name: string | null
  createdAt: string
}
export interface Product {
  id: number
  ownerId: number
  sku: string
  name: string
  price: number
  stock: number
  createdAt: string
  updatedAt: string
}
export type ProductInput = Pick<Product, 'sku' | 'name' | 'price' | 'stock'>
export interface OrderItem {
  productId: number
  quantity: number
  name: string
  sku: string
  unitPrice: number
}
export interface Order {
  id: number
  userId: number
  status: 'PLACED' | 'CANCELLED'
  total: number
  items: OrderItem[]
  createdAt: string
  updatedAt: string
}
export type CartItem = { productId: number; quantity: number }
export interface LoginResponse {
  user: User
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
}
