/**
 * Applies the schema and seed to the configured PostgreSQL database.
 *
 *   node scripts/db.mjs schema   - structure only
 *   node scripts/db.mjs seed     - data only
 *   node scripts/db.mjs reset    - both, in order
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

require('dotenv').config({ path: resolve(root, '.env') });
const pg = require('pg');

const command = process.argv[2] ?? 'reset';
const steps = command === 'reset' ? ['schema', 'seed'] : [command];

if (!steps.every((s) => s === 'schema' || s === 'seed')) {
  console.error(`Unknown command "${command}". Use: schema | seed | reset`);
  process.exit(1);
}

const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

await client.connect();
console.log(`connected to ${process.env.PGDATABASE} on ${process.env.PGHOST}`);

for (const step of steps) {
  const file = resolve(root, 'db', `${step}.sql`);
  process.stdout.write(`applying ${step}.sql … `);
  await client.query(readFileSync(file, 'utf8'));
  console.log('done');
}

const { rows } = await client.query(`
  select
    (select count(*) from menu_item)       as items,
    (select count(*) from menu_item_i18n)  as translations,
    (select count(*) from restaurant_table) as tables,
    (select count(*) from staff)           as staff,
    (select count(*) from daily_closeout)  as history_days
`);
console.table(rows[0]);

await client.end();
