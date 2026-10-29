import { useQuery } from '@tanstack/react-query'
import { listAll } from './api'
import { useSession } from './session'
import type { Product, Order } from './types'
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: ({ signal }) =>
      listAll<Product>('/products', 'products', undefined, signal),
  })
}
export function useFavorites() {
  const { token } = useSession()
  return useQuery({
    queryKey: ['favorites', token],
    enabled: !!token,
    queryFn: ({ signal }) =>
      listAll<Product>('/favorites', 'products', token, signal),
  })
}
export function useOrders() {
  const { token } = useSession()
  return useQuery({
    queryKey: ['orders', token],
    enabled: !!token,
    queryFn: ({ signal }) => listAll<Order>('/orders', 'orders', token, signal),
  })
}
