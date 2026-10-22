import type { UserRepository } from '../domain/user.ts'
import type { PasswordHasher } from '../application/ports/password-hasher.ts'

export type Dependencies = {
  users: UserRepository
  passwords: PasswordHasher
  checkDatabase: () => Promise<void>
}
export type AppEnv = {
  Bindings: CloudflareBindings
  Variables: { dependencies: Dependencies }
}
