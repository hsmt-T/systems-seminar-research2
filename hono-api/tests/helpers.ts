import { createApp } from '../src/presentation/app.ts'
import { DomainError } from '../src/domain/errors.ts'
import type { User, UserRepository } from '../src/domain/user.ts'
import type { Dependencies } from '../src/presentation/dependencies.ts'

export function fixture(overrides: Partial<Dependencies> = {}) {
  const records: User[] = []
  const users: UserRepository = {
    findByEmail: async (email) =>
      records.find((user) => user.email === email) ?? null,
    async create(input) {
      if (records.some((user) => user.email === input.email))
        throw new DomainError('CONFLICT', 'Email is already registered')
      const user = { id: records.length + 1, ...input, createdAt: new Date() }
      records.push(user)
      return user
    },
  }
  const dependencies: Dependencies = {
    users,
    tokens: {
      issue: async (id) => ({
        accessToken: `test-token:${id}`,
        expiresIn: 3600,
      }),
      verify: async () => 1,
    },
    passwords: {
      hash: async (value) => `hash:${value}`,
      verify: async (value, hash) => hash === `hash:${value}`,
    },
    checkDatabase: async () => {},
    ...overrides,
  }
  return { app: createApp(() => dependencies), records, dependencies }
}
export const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
