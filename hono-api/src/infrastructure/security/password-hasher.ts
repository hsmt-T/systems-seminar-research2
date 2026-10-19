import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'
import type { PasswordHasher } from '../../application/ports/password-hasher.ts'

// Keep memory within the Workers isolate limit while increasing CPU cost with p=5.
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error)
        else resolve(key)
      },
    )
  })
}
export const passwordHasher: PasswordHasher = {
  async hash(password) {
    const salt = randomBytes(16).toString('hex')
    const key = await derive(password, salt)
    return `scrypt$16384$8$5$${salt}$${key.toString('hex')}`
  },
  async verify(password, hash) {
    const parts = hash.split('$')
    if (
      parts.length !== 6 ||
      parts.slice(0, 4).join('$') !== 'scrypt$16384$8$5' ||
      !/^[a-f0-9]{32}$/.test(parts[4]) ||
      !/^[a-f0-9]{128}$/.test(parts[5])
    )
      return false
    const key = await derive(password, parts[4])
    return timingSafeEqual(key, Buffer.from(parts[5], 'hex'))
  },
}
