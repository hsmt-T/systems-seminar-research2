import type { ProductRepository } from '../domain/product.ts'
import type { OrderRepository } from '../domain/order.ts'
import type { FavoriteRepository } from '../domain/favorite.ts'
import type { TokenService } from '../application/ports/token-service.ts'
import type { UserRepository } from '../domain/user.ts'
import type { PasswordHasher } from '../application/ports/password-hasher.ts'

export type Dependencies = {
  products: ProductRepository
  orders: OrderRepository
  favorites: FavoriteRepository
  users: UserRepository
  tokens: TokenService
  passwords: PasswordHasher
  checkDatabase: () => Promise<void>
}
export type AppEnv = {
  Bindings: CloudflareBindings
  Variables: { dependencies: Dependencies; userId: number }
}
