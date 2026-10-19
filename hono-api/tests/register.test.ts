import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, json } from './helpers.ts'
import { passwordHasher } from '../src/infrastructure/security/password-hasher.ts'

test('register normalizes email and never exposes the password hash', async () => {
  const { app, records } = fixture()
  const response = await app.request(
    '/auth/register',
    json({
      email: 'Alice@EXAMPLE.com',
      password: 'a-long-password',
      name: 'Alice',
    }),
  )
  assert.equal(response.status, 201)
  const body = await response.json()
  assert.equal(body.user.email, 'alice@example.com')
  assert.equal('pass' in body.user, false)
  assert.equal(records[0].pass, 'hash:a-long-password')
  assert.equal(
    (
      await app.request(
        '/auth/register',
        json({ email: 'alice@example.com', password: 'a-long-password' }),
      )
    ).status,
    409,
  )
})
test('rejects invalid JSON, email, short passwords and non-object bodies', async () => {
  const { app } = fixture()
  for (const body of [
    null,
    [],
    { email: 'invalid', password: 'a-long-password' },
    { email: 'a@b.com', password: 'short' },
  ]) {
    assert.equal((await app.request('/auth/register', json(body))).status, 400)
  }
  assert.equal(
    (await app.request('/auth/register', { ...json({}), body: '{' })).status,
    400,
  )
})
test('passwords use random salts and timing-safe verification; plaintext hashes are rejected', async () => {
  const hash = await passwordHasher.hash('a-long-password')
  assert.notEqual(hash, await passwordHasher.hash('a-long-password'))
  assert.equal(await passwordHasher.verify('a-long-password', hash), true)
  assert.equal(await passwordHasher.verify('incorrect-password', hash), false)
  assert.equal(
    await passwordHasher.verify('a-long-password', 'a-long-password'),
    false,
  )
})
test('health endpoints retain their responses', async () => {
  const { app } = fixture()
  assert.equal(await (await app.request('/')).text(), 'Hello Hono!')
  assert.deepEqual(await (await app.request('/health')).json(), {
    status: 'ok',
  })
  assert.equal((await app.request('/health/db')).status, 200)
  assert.equal(
    (
      await fixture({
        checkDatabase: async () => {
          throw new Error('down')
        },
      }).app.request('/health/db')
    ).status,
    503,
  )
})
