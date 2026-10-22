import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { parse } from 'dotenv'
import { URL } from 'node:url'

// Use an isolated DB; each run gets distinct accounts so reruns are safe.
const settings = parse(readFileSync('.dev.vars', 'utf8'))
if (new URL(settings.DATABASE_URL).pathname !== '/ec_api_test') {
  throw new Error(
    'Set .dev.vars DATABASE_URL to the dedicated ec_api_test database',
  )
}
const file = process.argv[2]
if (!file)
  throw new Error(
    'Usage: node scripts/check-api.mjs tests/integration/<file>.jsonl',
  )
const input = readFileSync(file, 'utf8')
  .replaceAll('TEST_RUN', randomUUID())
  .replaceAll('@example.com', `-${randomUUID()}@example.com`)
const result = spawnSync(
  'pnpm',
  ['exec', 'hono', 'batch', '-', '--runtime', 'workerd'],
  { input, encoding: 'utf8' },
)
if (result.error) throw result.error
if (result.status !== 0) {
  process.stderr.write(result.stderr)
  process.stdout.write(result.stdout)
  process.exit(1)
}
const output = JSON.parse(result.stdout)
if (!output.ok || output.data?.summary?.failed !== 0) {
  process.stderr.write(JSON.stringify(output, null, 2) + '\n')
  process.stderr.write(result.stderr)
  process.exit(1)
}
process.stdout.write(JSON.stringify({ file, ...output.data.summary }) + '\n')
