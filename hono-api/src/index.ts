import { Hono } from 'hono'
import { createPrismaClient } from './lib/prisma'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.get('/health/db', async (c) => {
  const prisma = createPrismaClient(c.env.DATABASE_URL)
  try {
    await prisma.$queryRaw`SELECT 1`
    return c.json({ status: 'ok', database: 'ok' })
  } catch (error) {
    console.error('Database health check failed', error)
    return c.json({ status: 'error', database: 'unavailable' }, 503)
  } finally {
    c.executionCtx.waitUntil(prisma.$disconnect())
  }
})

export default app
