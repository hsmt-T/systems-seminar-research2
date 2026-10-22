import { validator } from 'hono/validator'
import { HTTPException } from 'hono/http-exception'
import { object, text } from './validation.ts'
import type { ProductInput } from '../domain/product.ts'

export function integer(
  value: unknown,
  field: string,
  min: number,
  max = 2147483647,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new HTTPException(400, { message: `Invalid ${field}` })
  return value
}
export function id(value: string) {
  if (!/^[1-9]\d*$/.test(value))
    throw new HTTPException(400, { message: 'Invalid id' })
  return integer(Number(value), 'id', 1)
}
export const pagination = validator('query', (value) => ({
  limit:
    value.limit === undefined
      ? 50
      : integer(Number(value.limit), 'limit', 1, 100),
  offset:
    value.offset === undefined
      ? 0
      : integer(Number(value.offset), 'offset', 0, 1000000),
}))
function productInput(value: unknown, partial: boolean): Partial<ProductInput> {
  const input = object(value)
  const output: Partial<ProductInput> = {}
  for (const field of ['sku', 'name'] as const) {
    if (!partial || input[field] !== undefined) {
      const result = text(
        input[field],
        field,
        field === 'sku' ? 64 : 200,
      ).trim()
      if (!result) throw new HTTPException(400, { message: `Invalid ${field}` })
      output[field] = result
    }
  }
  for (const field of ['price', 'stock'] as const) {
    if (!partial || input[field] !== undefined)
      output[field] = integer(
        input[field],
        field,
        0,
        field === 'price' ? 100000000 : 1000000,
      )
  }
  if (!Object.keys(output).length)
    throw new HTTPException(400, { message: 'No product fields provided' })
  return output
}
export const newProduct = validator(
  'json',
  (value: unknown) => productInput(value, false) as ProductInput,
)
export const patchProduct = validator('json', (value: unknown) =>
  productInput(value, true),
)

export const orderBody = validator('json', (value: unknown) => {
  const { items } = object(value)
  if (!Array.isArray(items) || items.length < 1 || items.length > 50)
    throw new HTTPException(400, { message: 'Expected 1 to 50 order items' })
  const seen = new Set<number>()
  return {
    items: items.map((entry: unknown) => {
      const input = object(entry)
      const productId = integer(input.productId, 'productId', 1)
      if (seen.has(productId))
        throw new HTTPException(400, { message: 'Duplicate product in order' })
      seen.add(productId)
      return {
        productId,
        quantity: integer(input.quantity, 'quantity', 1, 1000),
      }
    }),
  }
})
