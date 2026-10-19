import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'

export function createPrismaClient(connectionString: string) {
  const adapter = new PrismaPg({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  })
  return new PrismaClient({ adapter })
}
