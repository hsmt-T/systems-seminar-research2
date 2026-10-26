import type { UserRepository } from '../../domain/user.ts'
import { publicUser } from '../../domain/user.ts'
import { DomainError } from '../../domain/errors.ts'
export async function currentUser(users: UserRepository, userId: number) {
  const user = await users.findById(userId)
  if (!user) throw new DomainError('UNAUTHENTICATED', 'User no longer exists')
  return publicUser(user)
}
