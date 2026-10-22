import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { URL } from 'node:url'
import { parse } from 'dotenv'

const connection = process.env.DATABASE_URL ?? ''
const settings = parse(readFileSync('.dev.vars', 'utf8'))
// Guard before migration, not just before test data is written.
if (
  new URL(connection).pathname !== '/ec_api_test' ||
  settings.DATABASE_URL !== connection
)
  throw new Error(
    'Set DATABASE_URL and .dev.vars to the same dedicated ec_api_test database',
  )
if (!settings.JWT_SECRET || settings.JWT_SECRET.length < 32)
  throw new Error('Set a random test JWT_SECRET of at least 32 characters')

const commands = [
  ['pnpm', ['db:generate']],
  ['pnpm', ['db:deploy']],
  ['pnpm', ['test:db']],
  ...['register', 'login', 'me', 'commerce'].map((name) => [
    'node',
    ['scripts/check-api.mjs', `tests/integration/${name}.jsonl`],
  ]),
]
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
