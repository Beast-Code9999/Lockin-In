/**
 * Discretion scan (SPEC §3, CLAUDE.md rule 2): no forbidden word may appear in any
 * user-facing string, notification, widget, asset name, app/package name or seed
 * caption. Scans file *names* everywhere and file *contents* of every text file we
 * ship or show. Only text between `@forbidden-begin` / `@forbidden-end` markers is
 * exempt (the canonical lists and their own test inputs).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

import { findForbiddenWord } from '../src/shared/forbiddenWords';

const ROOT = join(__dirname, '..');

/** Specs that *define* the rule (they must name the words). Never shipped. */
const EXCLUDED_FILES = new Set(['SPEC.md', 'CLAUDE.md']);
const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'android', 'ios', '.expo', 'dist', 'coverage', '.temp', '.branches']);
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.json', '.md', '.sql', '.txt', '.jsonc', '.xml', '.example', '']);
const SCAN_ROOTS = ['app', 'src', 'assets', 'supabase', 'docs', 'scripts', 'fixtures', 'tests', 'plugins'];
const SCAN_FILES = ['app.config.ts', 'package.json', 'index.ts', 'README.md', '.env.example'];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (EXCLUDED_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function stripExemptBlocks(text: string): string {
  // Keep the newlines so reported line numbers stay accurate.
  return text.replace(/@forbidden-begin[\s\S]*?@forbidden-end/g, (block) => block.replace(/[^\n]/g, ''));
}

const files = [...SCAN_ROOTS.flatMap((d) => walk(join(ROOT, d))), ...SCAN_FILES.map((f) => join(ROOT, f))].filter(
  (f) => !EXCLUDED_FILES.has(relative(ROOT, f)),
);

describe('discretion scan', () => {
  it('finds files to scan', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('no forbidden word in any file or folder name', () => {
    const offenders = files
      .map((f) => relative(ROOT, f))
      .map((rel) => ({ rel, hit: findForbiddenWord(rel.replace(/[/\\]/g, ' ')) }))
      .filter((x) => x.hit);
    expect(offenders).toEqual([]);
  });

  it('no forbidden word in any shipped or user-facing text', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (!TEXT_EXTENSIONS.has(extname(file))) continue;
      const text = stripExemptBlocks(readFileSync(file, 'utf8'));
      text.split('\n').forEach((line, i) => {
        const hit = findForbiddenWord(line);
        if (hit) offenders.push(`${relative(ROOT, file)}:${i + 1} → "${hit}"`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('copy never uses the internal status name (UI says "Slipped")', () => {
    const copyFiles = walk(join(ROOT, 'src/copy'));
    const offenders = copyFiles.filter((f) => /relaps/i.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it('app and package names stay neutral', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { name: string };
    expect(pkg.name).toBe('lockinin');
    const config = readFileSync(join(ROOT, 'app.config.ts'), 'utf8');
    expect(config).toContain("package: 'com.jasonlay.lockinin'");
    expect(config).toContain(`name: "Lockin' In"`);
  });
});
