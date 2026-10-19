import { Hono } from 'hono'
import type { AppEnv } from '../dependencies.ts'
import { registrationBody } from '../validation.ts'
import { register } from '../../application/use-cases/register.ts'

export function authRoutes() {
  return new Hono<AppEnv>().post('/register', registrationBody, async (c) => {
    const { users, passwords } = c.var.dependencies
    const user = await register(users, passwords)(c.req.valid('json'))
    return c.json({ user }, 201)
  })
}
