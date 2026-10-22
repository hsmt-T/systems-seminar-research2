import { productRepository } from './infrastructure/persistence/product-repository.ts'
import { orderRepository } from './infrastructure/persistence/order-repository.ts'
import { favoriteRepository } from './infrastructure/persistence/favorite-repository.ts'
import { Hono } from 'hono'
import { createPrismaClient } from './lib/prisma.ts'
import { createApp } from './presentation/app.ts'
import { userRepository } from './infrastructure/persistence/user-repository.ts'
import { tokenService } from './infrastructure/security/token-service.ts'
import { passwordHasher } from './infrastructure/security/password-hasher.ts'

// Composition root: only the outer layer knows about both Prisma and Hono.
const app = new Hono<{ Bindings: CloudflareBindings }>()
app.all('*', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  const api = createApp(() => ({
    users: userRepository(prisma),
    products: productRepository(prisma),
    orders: orderRepository(prisma),
    favorites: favoriteRepository(prisma),
    tokens: tokenService(c.env.JWT_SECRET),
    passwords: passwordHasher,
    checkDatabase: async () => {
      await prisma.$queryRaw`SELECT 1`
    },
  }))
  try {
    return await api.fetch(c.req.raw, c.env, c.executionCtx)
  } finally {
    c.executionCtx.waitUntil(prisma.$disconnect())
  }
})
export default app
