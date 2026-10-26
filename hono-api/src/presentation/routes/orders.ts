import { Hono } from 'hono'
import type { AppEnv } from '../dependencies.ts'
import { authenticate } from '../middleware/authenticate.ts'
import { id, orderBody, pagination } from '../commerce-validation.ts'
import { getOrder } from '../../application/use-cases/orders.ts'

export function orderRoutes() {
  return new Hono<AppEnv>()
    .use('*', authenticate)
    .get('/', pagination, async (c) =>
      c.json({
        orders: await c.var.dependencies.orders.list(
          c.var.userId,
          c.req.valid('query'),
        ),
      }),
    )
    .get('/:id', async (c) =>
      c.json({
        order: await getOrder(
          c.var.dependencies.orders,
          id(c.req.param('id')),
          c.var.userId,
        ),
      }),
    )
    .post('/', orderBody, async (c) =>
      c.json(
        {
          order: await c.var.dependencies.orders.create(
            c.var.userId,
            c.req.valid('json').items,
          ),
        },
        201,
      ),
    )
    .put('/:id', orderBody, async (c) =>
      c.json({
        order: await c.var.dependencies.orders.replace(
          id(c.req.param('id')),
          c.var.userId,
          c.req.valid('json').items,
        ),
      }),
    )
    .delete('/:id', async (c) => {
      await c.var.dependencies.orders.cancel(
        id(c.req.param('id')),
        c.var.userId,
      )
      return c.body(null, 204)
    })
}
