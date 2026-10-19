import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv, Dependencies } from './dependencies.ts'
import { DomainError } from '../domain/errors.ts'
import { authRoutes } from './routes/auth.ts'

export function createApp(
  dependencies: (env: CloudflareBindings) => Dependencies,
) {
  const app = new Hono<AppEnv>()
  app.use(bodyLimit({ maxSize: 16 * 1024 }))
  app.use(async (c, next) => {
    c.set('dependencies', dependencies(c.env))
    await next()
  })
  app.onError((error, c) => {
    if (error instanceof HTTPException)
      return c.json({ error: error.message }, error.status)
    if (error instanceof DomainError) {
      const status = error.code === 'CONFLICT' ? 409 : 400
      return c.json({ error: error.message }, status)
    }
    console.error('Request failed', error)
    return c.json({ error: 'Internal server error' }, 500)
  })
  app.get('/', (c) => c.text('Hello Hono!'))
  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.get('/health/db', async (c) => {
    try {
      await c.var.dependencies.checkDatabase()
      return c.json({ status: 'ok', database: 'ok' })
    } catch {
      return c.json({ status: 'error', database: 'unavailable' }, 503)
    }
  })
  return app.route('/auth', authRoutes())
}
