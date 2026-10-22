import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, json } from './helpers.ts'
import { tokenService } from '../src/infrastructure/security/token-service.ts'
import { sign } from 'hono/jwt'

test('login issues a bearer token and omits password data', async () => {
  const { app } = fixture()
  await app.request(
    '/auth/register',
    json({ email: 'alice@example.com', password: 'a-long-password' }),
  )
  const result = await app.request(
    '/auth/login',
    json({ email: 'ALICE@example.com', password: 'a-long-password' }),
  )
  assert.equal(result.status, 200)
  assert.equal(result.headers.get('Cache-Control'), 'no-store')
  const body = await result.json()
  assert.equal(body.accessToken, 'test-token:1')
  assert.equal('pass' in body.user, false)
  for (const email of ['alice@example.com', 'nobody@example.com']) {
    const response = await app.request(
      '/auth/login',
      json({ email, password: 'wrong-password' }),
    )
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: 'Invalid email or password',
    })
  }
})
test('JWT validates signature, expiry, algorithm and required claims', async () => {
  const secret = 'test-only-secret-with-at-least-32-characters'
  const tokens = tokenService(secret)
  const issued = await tokens.issue(42)
  assert.equal(await tokens.verify(issued.accessToken), 42)
  await assert.rejects(tokens.verify(issued.accessToken + 'bad'))
  await assert.rejects(
    tokenService('a-different-secret-with-at-least-32-characters').verify(
      issued.accessToken,
    ),
  )
  for (const claims of [
    { sub: '42' },
    { sub: '42', exp: 1, iat: 0, iss: 'hono-ec-api', aud: 'ec-client' },
    { sub: '42', exp: 9999999999, iat: 1, iss: 'wrong', aud: 'ec-client' },
  ]) {
    await assert.rejects(tokens.verify(await sign(claims, secret, 'HS256')))
  }
  await assert.rejects(tokenService('short').issue(1))
})
