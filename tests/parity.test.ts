/**
 * TS ↔ SQL parity (CLAUDE.md: "Constants live in one TS file and one SQL config").
 * Parses the *latest* migration that defines each SQL mirror, so a later migration
 * that replaces app.config() / app.forbidden_words() is what gets checked.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONFIG } from '../src/shared/constants';
import { FORBIDDEN_WORDS } from '../src/shared/forbiddenWords';

const MIGRATIONS = join(__dirname, '..', 'supabase', 'migrations');

function latestBlock(begin: string, end: string): string {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files.reverse()) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    const start = sql.indexOf(begin);
    if (start !== -1) return sql.slice(start + begin.length, sql.indexOf(end, start));
  }
  throw new Error(`No migration contains ${begin}`);
}

describe('SQL ↔ TypeScript parity', () => {
  it('app.config() matches CONFIG in src/shared/constants.ts', () => {
    const block = latestBlock('-- @config-begin', '-- @config-end');
    const sql: Record<string, string | number> = {};
    for (const line of block.split('\n')) {
      const m = /^\s*'([A-Z0-9_]+)',\s*(-?\d+(?:\.\d+)?|'[^']*')\s*,?\s*$/.exec(line);
      if (!m) continue;
      const [, key, raw] = m;
      if (!key || raw === undefined) continue;
      sql[key] = raw.startsWith("'") ? raw.slice(1, -1) : Number(raw);
    }
    expect(Object.keys(sql).length).toBeGreaterThanOrEqual(22);
    expect(sql).toEqual({ ...CONFIG });
  });

  it('app.forbidden_words() matches FORBIDDEN_WORDS', () => {
    const block = latestBlock('-- @forbidden-begin', '-- @forbidden-end');
    const sqlWords = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(sqlWords).toEqual([...FORBIDDEN_WORDS]);
  });
});
