import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, json } from './helpers.ts'
test('me requires a valid bearer token for an existing account', async () => {
  const { app } = fixture()
  await app.request(
    '/auth/register',
    json({ email: 'me@example.com', password: 'a-long-password' }),
  )
  for (const token of [
    undefined,
    'Basic abc',
    'Bearer invalid',
    'Bearer test-token:2',
  ]) {
    assert.equal(
      (
        await app.request('/auth/me', {
          headers: token ? { Authorization: token } : {},
        })
      ).status,
      401,
    )
  }
  const response = await app.request('/auth/me', {
    headers: { Authorization: 'Bearer test-token:1' },
  })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).user.email, 'me@example.com')
})
