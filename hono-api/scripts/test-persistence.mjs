import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { URL } from 'node:url'

if (new URL(process.env.DATABASE_URL ?? '').pathname !== '/ec_api_test')
  throw new Error('Use the dedicated ec_api_test database')

// Node cannot load Workers' `wasm?module` imports. Generate a Node client from
// the same schema for repository tests; HTTP tests use the real Workers client.
mkdirSync('.wrangler', { recursive: true })
const schema = readFileSync('prisma/schema.prisma', 'utf8')
  .replace(/output\s*=\s*"[^"]+"/, 'output = "./prisma-node"')
  .replace(/runtime\s*=\s*"cloudflare"/, 'runtime = "nodejs"')
writeFileSync('.wrangler/prisma-node.prisma', schema)
for (const [command, args] of [
  [
    'pnpm',
    ['exec', 'prisma', 'generate', '--schema', '.wrangler/prisma-node.prisma'],
  ],
  [
    'node',
    [
      '--experimental-strip-types',
      '--test',
      'tests/integration/persistence.test.ts',
    ],
  ],
]) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
