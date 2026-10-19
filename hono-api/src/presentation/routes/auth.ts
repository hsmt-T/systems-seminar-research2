import { Hono } from 'hono'
import type { AppEnv } from '../dependencies.ts'
import { login } from '../../application/use-cases/login.ts'
import { registrationBody, loginBody } from '../validation.ts'
import { register } from '../../application/use-cases/register.ts'

export function authRoutes() {
  return new Hono<AppEnv>()
    .post('/register', registrationBody, async (c) => {
      const { users, passwords } = c.var.dependencies
      const user = await register(users, passwords)(c.req.valid('json'))
      return c.json({ user }, 201)
    })
    .post('/login', loginBody, async (c) => {
      const { users, passwords, tokens } = c.var.dependencies
      c.header('Cache-Control', 'no-store')
      return c.json(await login(users, passwords, tokens)(c.req.valid('json')))
    })
}
