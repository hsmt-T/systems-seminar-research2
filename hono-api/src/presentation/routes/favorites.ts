import { Hono } from 'hono'
import type { AppEnv } from '../dependencies.ts'
import { authenticate } from '../middleware/authenticate.ts'
import { id, pagination } from '../commerce-validation.ts'

export function favoriteRoutes() {
  return new Hono<AppEnv>()
    .use('*', authenticate)
    .get('/', pagination, async (c) =>
      c.json({
        products: await c.var.dependencies.favorites.list(
          c.var.userId,
          c.req.valid('query'),
        ),
      }),
    )
    .put('/:productId', async (c) => {
      await c.var.dependencies.favorites.add(
        c.var.userId,
        id(c.req.param('productId')),
      )
      return c.body(null, 204)
    })
    .delete('/:productId', async (c) => {
      await c.var.dependencies.favorites.remove(
        c.var.userId,
        id(c.req.param('productId')),
      )
      return c.body(null, 204)
    })
}
