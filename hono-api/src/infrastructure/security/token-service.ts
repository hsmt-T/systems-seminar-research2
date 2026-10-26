import { sign, verify } from 'hono/jwt'
import type { TokenService } from '../../application/ports/token-service.ts'
import { DomainError } from '../../domain/errors.ts'

export function tokenService(secret: string): TokenService {
  function requireSecret() {
    if (typeof secret !== 'string' || secret.length < 32)
      throw new Error('JWT_SECRET must have at least 32 characters')
  }
  return {
    async issue(userId) {
      requireSecret()
      const iat = Math.floor(Date.now() / 1000)
      return {
        accessToken: await sign(
          {
            sub: String(userId),
            iat,
            exp: iat + 3600,
            iss: 'hono-ec-api',
            aud: 'ec-client',
          },
          secret,
          'HS256',
        ),
        expiresIn: 3600,
      }
    },
    async verify(token) {
      requireSecret()
      try {
        const payload = await verify(token, secret, 'HS256')
        const id =
          typeof payload.sub === 'string' && /^[1-9]\d*$/.test(payload.sub)
            ? Number(payload.sub)
            : NaN
        if (
          !Number.isSafeInteger(id) ||
          payload.iss !== 'hono-ec-api' ||
          payload.aud !== 'ec-client' ||
          typeof payload.exp !== 'number' ||
          typeof payload.iat !== 'number'
        )
          throw new Error('Invalid claims')
        return id
      } catch {
        throw new DomainError('UNAUTHENTICATED', 'Invalid or expired token')
      }
    },
  }
}
