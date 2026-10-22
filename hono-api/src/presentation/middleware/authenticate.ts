import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../dependencies.ts'
import { DomainError } from '../../domain/errors.ts'

export const authenticate = createMiddleware<AppEnv>(async (c, next) => {
  const authorization = c.req.header('Authorization')
  const match = authorization?.match(/^Bearer ([^\s]+)$/)
  if (!match) throw new DomainError('UNAUTHENTICATED', 'Bearer token required')
  const { tokens, users } = c.var.dependencies
  const id = await tokens.verify(match[1])
  if (!(await users.findById(id)))
    throw new DomainError('UNAUTHENTICATED', 'User no longer exists')
  c.set('userId', id)
  c.header('Cache-Control', 'no-store')
  await next()
})
