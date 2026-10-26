import { Hono } from 'hono'
import type { AppEnv } from '../dependencies.ts'
import { authenticate } from '../middleware/authenticate.ts'
import {
  id,
  newProduct,
  pagination,
  patchProduct,
} from '../commerce-validation.ts'
import { getProduct } from '../../application/use-cases/products.ts'

export function productRoutes() {
  return new Hono<AppEnv>()
    .get('/', pagination, async (c) =>
      c.json({
        products: await c.var.dependencies.products.list(c.req.valid('query')),
      }),
    )
    .get('/:id', async (c) =>
      c.json({
        product: await getProduct(
          c.var.dependencies.products,
          id(c.req.param('id')),
        ),
      }),
    )
    .post('/', authenticate, newProduct, async (c) =>
      c.json(
        {
          product: await c.var.dependencies.products.create(
            c.var.userId,
            c.req.valid('json'),
          ),
        },
        201,
      ),
    )
    .patch('/:id', authenticate, patchProduct, async (c) =>
      c.json({
        product: await c.var.dependencies.products.update(
          id(c.req.param('id')),
          c.var.userId,
          c.req.valid('json'),
        ),
      }),
    )
    .delete('/:id', authenticate, async (c) => {
      await c.var.dependencies.products.remove(
        id(c.req.param('id')),
        c.var.userId,
      )
      return c.body(null, 204)
    })
}
