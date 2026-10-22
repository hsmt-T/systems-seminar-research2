import type { PrismaClient } from '../../../generated/prisma/client.ts'
import type { FavoriteRepository } from '../../domain/favorite.ts'
import { DomainError } from '../../domain/errors.ts'

export function favoriteRepository(prisma: PrismaClient): FavoriteRepository {
  return {
    async list(userId, { limit, offset }) {
      const rows = await prisma.favorite.findMany({
        where: { userId, product: { deletedAt: null } },
        include: { product: true },
        orderBy: { productId: 'asc' },
        take: limit,
        skip: offset,
      })
      return rows.map((row) => row.product)
    },
    async add(userId, productId) {
      const product = await prisma.product.findFirst({
        where: { id: productId, deletedAt: null },
      })
      if (!product) throw new DomainError('NOT_FOUND', 'Product not found')
      await prisma.favorite.createMany({
        data: [{ userId, productId }],
        skipDuplicates: true,
      })
    },
    async remove(userId, productId) {
      await prisma.favorite.deleteMany({ where: { userId, productId } })
    },
  }
}
