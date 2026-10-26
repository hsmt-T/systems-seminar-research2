import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './helpers.ts'

test('Swagger UI and OpenAPI are publicly accessible', async () => {
  const { app } = fixture()
  const response = await app.request('/docs')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /text\/html/)
  const html = await response.text()
  assert.match(html, /SwaggerUIBundle/)
  assert.match(html, /\/openapi\.json/)
  const spec = await app.request('/openapi.json')
  assert.equal(spec.status, 200)
  assert.match(spec.headers.get('content-type') ?? '', /application\/json/)
})

test('OpenAPI covers every API operation and resolves all schema references', async () => {
  const { app } = fixture()
  const document = await (await app.request('/openapi.json')).json()
  assert.equal(document.openapi, '3.0.3')
  const actual = new Set<string>()
  for (const route of app.routes) {
    if (
      route.method === 'ALL' ||
      ['/docs', '/openapi.json'].includes(route.path)
    )
      continue
    const path =
      route.path.replace(/:([^/]+)/g, '{$1}').replace(/\/$/, '') || '/'
    actual.add(`${route.method.toLowerCase()} ${path}`)
  }
  const documented = new Set<string>()
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of Object.keys(item as object)) {
      if (method !== 'parameters') documented.add(`${method} ${path}`)
    }
  }
  assert.deepEqual(documented, actual)
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      if (key === '$ref') {
        assert.equal(typeof child, 'string')
        const name = String(child).replace('#/components/schemas/', '')
        assert.ok(
          document.components.schemas[name],
          `Unresolved reference: ${child}`,
        )
      } else visit(child)
    }
  }
  visit(document)
})

test('OpenAPI declares Bearer authentication only for protected operations', async () => {
  const { app } = fixture()
  const document = await (await app.request('/openapi.json')).json()
  assert.deepEqual(document.components.securitySchemes.bearerAuth, {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  })
  for (const [path, item] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(
      item as Record<string, { security?: unknown }>,
    )) {
      if (method === 'parameters') continue
      const protectedRoute =
        path === '/auth/me' ||
        path.startsWith('/orders') ||
        path.startsWith('/favorites') ||
        (path.startsWith('/products') && method !== 'get')
      assert.deepEqual(
        operation.security,
        protectedRoute ? [{ bearerAuth: [] }] : undefined,
        `${method} ${path}`,
      )
      if (protectedRoute) {
        const url = path.replace(/\{[^}]+\}/g, '1')
        assert.equal(
          (await app.request(url, { method: method.toUpperCase() })).status,
          401,
        )
      }
    }
  }
})

test('OpenAPI exposes distinct login and registration constraints and commerce limits', async () => {
  const { app } = fixture()
  const document = await (await app.request('/openapi.json')).json()
  const schemas = document.components.schemas
  assert.equal(schemas.RegistrationInput.properties.password.minLength, 12)
  assert.equal(schemas.LoginInput.properties.password.minLength, 1)
  assert.equal(schemas.RegistrationInput.properties.password.writeOnly, true)
  assert.equal('pass' in schemas.PublicUser.properties, false)
  assert.equal(schemas.ProductInput.properties.price.maximum, 100000000)
  assert.equal(schemas.ProductInput.properties.stock.maximum, 1000000)
  assert.equal(schemas.OrderInput.properties.items.maxItems, 50)
  assert.equal(
    schemas.OrderInput.properties.items.items.properties.quantity.maximum,
    1000,
  )
  for (const path of ['/products', '/orders', '/favorites']) {
    assert.deepEqual(
      document.paths[path].get.parameters.map(
        (p: { schema: { default: number } }) => p.schema.default,
      ),
      [50, 0],
    )
  }
  for (const path of [
    '/products/{id}',
    '/orders/{id}',
    '/favorites/{productId}',
  ]) {
    assert.equal(
      document.paths[path].delete.responses['204'].content,
      undefined,
    )
  }
})
