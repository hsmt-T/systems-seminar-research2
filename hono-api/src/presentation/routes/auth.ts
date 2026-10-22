import { Hono } from 'hono'
import { authenticate } from '../middleware/authenticate.ts'
import { currentUser } from '../../application/use-cases/current-user.ts'
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
    .get('/me', authenticate, async (c) => {
      return c.json({
        user: await currentUser(c.var.dependencies.users, c.var.userId),
      })
    })
}
