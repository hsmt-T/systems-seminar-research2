import { publicUser } from '../../domain/user.ts'
import type { UserRepository } from '../../domain/user.ts'
import type { PasswordHasher } from '../ports/password-hasher.ts'

export function register(users: UserRepository, passwords: PasswordHasher) {
  return async (input: { email: string; password: string; name?: string }) => {
    const pass = await passwords.hash(input.password)
    return publicUser(
      await users.create({
        email: input.email.toLowerCase(),
        name: input.name ?? null,
        pass,
      }),
    )
  }
}
