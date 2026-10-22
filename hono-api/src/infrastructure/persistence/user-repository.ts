import type { PrismaClient } from '../../../generated/prisma/client.ts'
import type { UserRepository } from '../../domain/user.ts'
import { DomainError } from '../../domain/errors.ts'

export function userRepository(prisma: PrismaClient): UserRepository {
  return {
    findByEmail: (email) => prisma.user.findUnique({ where: { email } }),
    async create(input) {
      try {
        return await prisma.user.create({ data: input })
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          throw new DomainError('CONFLICT', 'Email is already registered')
        }
        throw error
      }
    },
  }
}
