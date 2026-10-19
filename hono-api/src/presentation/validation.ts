import { validator } from 'hono/validator'
import { HTTPException } from 'hono/http-exception'

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HTTPException(400, { message: 'Expected a JSON object' })
  }
  return value as Record<string, unknown>
}
export function text(
  value: unknown,
  field: string,
  max: number,
  min = 1,
): string {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    throw new HTTPException(400, { message: `Invalid ${field}` })
  }
  return value
}
export const registrationBody = validator('json', (value: unknown) => {
  const input = object(value)
  const email = text(input.email, 'email', 254).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HTTPException(400, { message: 'Invalid email' })
  }
  const password = text(input.password, 'password', 128, 12)
  const name =
    input.name === undefined ? undefined : text(input.name, 'name', 100).trim()
  if (name !== undefined && !name)
    throw new HTTPException(400, { message: 'Invalid name' })
  return { email, password, name }
})
