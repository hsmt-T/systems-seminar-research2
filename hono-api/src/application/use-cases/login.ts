import type { UserRepository } from '../../domain/user.ts'
import { publicUser } from '../../domain/user.ts'
import { DomainError } from '../../domain/errors.ts'
import type { PasswordHasher } from '../ports/password-hasher.ts'
import type { TokenService } from '../ports/token-service.ts'

const dummyHash = `scrypt$16384$8$5$${'0'.repeat(32)}$${'0'.repeat(128)}`
export function login(
  users: UserRepository,
  passwords: PasswordHasher,
  tokens: TokenService,
) {
  return async (input: { email: string; password: string }) => {
    const user = await users.findByEmail(input.email.toLowerCase())
    const valid = await passwords.verify(
      input.password,
      user?.pass ?? dummyHash,
    )
    if (!user || !valid)
      throw new DomainError('UNAUTHENTICATED', 'Invalid email or password')
    return {
      user: publicUser(user),
      ...(await tokens.issue(user.id)),
      tokenType: 'Bearer',
    }
  }
}
