import type { PrismaClient } from '../../../generated/prisma/client.ts'
import { DomainError } from '../../domain/errors.ts'
import type { ProductRepository } from '../../domain/product.ts'

export function productRepository(prisma: PrismaClient): ProductRepository {
  return {
    list: ({ limit, offset }) =>
      prisma.product.findMany({
        where: { deletedAt: null },
        orderBy: { id: 'asc' },
        take: limit,
        skip: offset,
      }),
    find: (id) => prisma.product.findFirst({ where: { id, deletedAt: null } }),
    async create(ownerId, input) {
      try {
        return await prisma.product.create({ data: { ...input, ownerId } })
      } catch (error) {
        if (hasCode(error, 'P2002'))
          throw new DomainError('CONFLICT', 'SKU already exists')
        throw error
      }
    },
    async update(id, ownerId, input) {
      try {
        return await prisma.product.update({
          where: { id, ownerId, deletedAt: null },
          data: input,
        })
      } catch (error) {
        if (hasCode(error, 'P2025'))
          throw new DomainError('NOT_FOUND', 'Product not found')
        if (hasCode(error, 'P2002'))
          throw new DomainError('CONFLICT', 'SKU already exists')
        throw error
      }
    },
    async remove(id, ownerId) {
      const result = await prisma.product.updateMany({
        where: { id, ownerId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      if (!result.count) throw new DomainError('NOT_FOUND', 'Product not found')
    },
  }
}

export function hasCode(error: unknown, code: string) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  )
}
