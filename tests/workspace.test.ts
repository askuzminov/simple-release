import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PackageContext } from '../src/types';
import { discoverWorkspaces, parsePnpmWorkspace, resolveGlobs, topoSort } from '../src/workspace';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'sr-ws-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeJson(dir: string, file: string, data: object): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(join(dir, file), `${JSON.stringify(data, undefined, 2)}\n`, 'utf8');
}

describe('parsePnpmWorkspace', () => {
  it('should parse simple packages list', () => {
    const result = parsePnpmWorkspace('packages:\n  - "packages/*"\n  - "apps/*"\n');
    assert.deepEqual(result, ['packages/*', 'apps/*']);
  });

  it('should parse single-quoted values', () => {
    const result = parsePnpmWorkspace("packages:\n  - 'packages/*'\n");
    assert.deepEqual(result, ['packages/*']);
  });

  it('should parse unquoted values', () => {
    const result = parsePnpmWorkspace('packages:\n  - packages/*\n');
    assert.deepEqual(result, ['packages/*']);
  });

  it('should stop at next key', () => {
    const result = parsePnpmWorkspace('packages:\n  - packages/*\nother:\n  - foo\n');
    assert.deepEqual(result, ['packages/*']);
  });

  it('should return empty for no packages key', () => {
    const result = parsePnpmWorkspace('other:\n  - foo\n');
    assert.deepEqual(result, []);
  });

  it('should skip comments', () => {
    const result = parsePnpmWorkspace('packages:\n  # comment\n  - packages/*\n');
    assert.deepEqual(result, ['packages/*']);
  });
});

describe('resolveGlobs', () => {
  it('should resolve simple wildcard', async () => {
    await fs.mkdir(join(tempDir, 'packages', 'pkg-a'), { recursive: true });
    await fs.mkdir(join(tempDir, 'packages', 'pkg-b'), { recursive: true });
    const result = resolveGlobs(tempDir, ['packages/*']);
    assert.equal(result.length, 2);
    assert.ok(result.some(d => d.endsWith('pkg-a')));
    assert.ok(result.some(d => d.endsWith('pkg-b')));
  });

  it('should resolve exact directory', async () => {
    await fs.mkdir(join(tempDir, 'ui'), { recursive: true });
    const result = resolveGlobs(tempDir, ['ui']);
    assert.equal(result.length, 1);
    assert.ok(result[0].endsWith('ui'));
  });

  it('should resolve deep wildcard', async () => {
    await fs.mkdir(join(tempDir, 'src', 'packages', 'core'), { recursive: true });
    await fs.mkdir(join(tempDir, 'src', 'packages', 'utils'), { recursive: true });
    const result = resolveGlobs(tempDir, ['src/**']);
    assert.ok(result.length >= 3);
  });

  it('should skip non-existent dirs', () => {
    const result = resolveGlobs(tempDir, ['nonexistent/*']);
    assert.equal(result.length, 0);
  });

  it('should deduplicate', async () => {
    await fs.mkdir(join(tempDir, 'packages', 'pkg-a'), { recursive: true });
    const result = resolveGlobs(tempDir, ['packages/*', 'packages/*']);
    assert.equal(result.length, 1);
  });
});

describe('discoverWorkspaces', () => {
  it('should return null when no workspaces', async () => {
    await writeJson(tempDir, 'package.json', { name: 'root', version: '1.0.0' });
    const result = await discoverWorkspaces(tempDir);
    assert.equal(result, null);
  });

  it('should discover npm workspaces (array format)', async () => {
    await writeJson(tempDir, 'package.json', {
      name: 'root',
      version: '1.0.0',
      workspaces: ['packages/*'],
    });
    await writeJson(join(tempDir, 'packages', 'pkg-a'), 'package.json', { name: '@org/pkg-a', version: '1.0.0' });
    await writeJson(join(tempDir, 'packages', 'pkg-b'), 'package.json', { name: '@org/pkg-b', version: '2.0.0' });
    const result = await discoverWorkspaces(tempDir);
    assert.ok(result !== null);
    assert.equal(result.length, 2);
    assert.equal(result[0].name, '@org/pkg-a');
    assert.equal(result[0].tagPrefix, '@org/pkg-a@');
    assert.equal(result[1].name, '@org/pkg-b');
    assert.equal(result[1].version, '2.0.0');
  });

  it('should discover yarn/bun workspaces (object format)', async () => {
    await writeJson(tempDir, 'package.json', {
      name: 'root',
      version: '1.0.0',
      workspaces: { packages: ['packages/*'] },
    });
    await writeJson(join(tempDir, 'packages', 'my-lib'), 'package.json', { name: 'my-lib', version: '0.1.0' });
    const result = await discoverWorkspaces(tempDir);
    assert.ok(result !== null);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'my-lib');
    assert.equal(result[0].tagPrefix, 'my-lib@');
  });

  it('should discover pnpm workspaces', async () => {
    await writeJson(tempDir, 'package.json', { name: 'root', version: '1.0.0' });
    await fs.writeFile(join(tempDir, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n", 'utf8');
    await writeJson(join(tempDir, 'packages', 'core'), 'package.json', { name: '@app/core', version: '3.0.0' });
    const result = await discoverWorkspaces(tempDir);
    assert.ok(result !== null);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, '@app/core');
  });

  it('should skip directories without package.json', async () => {
    await writeJson(tempDir, 'package.json', {
      name: 'root',
      version: '1.0.0',
      workspaces: ['packages/*'],
    });
    await fs.mkdir(join(tempDir, 'packages', 'no-pkg'), { recursive: true });
    await writeJson(join(tempDir, 'packages', 'has-pkg'), 'package.json', { name: 'has-pkg', version: '1.0.0' });
    const result = await discoverWorkspaces(tempDir);
    assert.ok(result !== null);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'has-pkg');
  });

  it('should skip packages without name', async () => {
    await writeJson(tempDir, 'package.json', {
      name: 'root',
      version: '1.0.0',
      workspaces: ['packages/*'],
    });
    await writeJson(join(tempDir, 'packages', 'no-name'), 'package.json', { version: '1.0.0' });
    await writeJson(join(tempDir, 'packages', 'has-name'), 'package.json', { name: 'has-name', version: '1.0.0' });
    const result = await discoverWorkspaces(tempDir);
    assert.ok(result !== null);
    assert.equal(result.length, 1);
  });

  it('should return null when workspaces resolve to no packages', async () => {
    await writeJson(tempDir, 'package.json', {
      name: 'root',
      version: '1.0.0',
      workspaces: ['empty/*'],
    });
    await fs.mkdir(join(tempDir, 'empty'), { recursive: true });
    const result = await discoverWorkspaces(tempDir);
    assert.equal(result, null);
  });

  it('should return packages in topological order', async () => {
    await writeJson(tempDir, 'package.json', {
      name: 'root',
      version: '1.0.0',
      workspaces: ['packages/*'],
    });
    await writeJson(join(tempDir, 'packages', 'app'), 'package.json', {
      name: '@org/app',
      version: '1.0.0',
      dependencies: { '@org/core': '^1.0.0', '@org/utils': '^1.0.0' },
    });
    await writeJson(join(tempDir, 'packages', 'core'), 'package.json', {
      name: '@org/core',
      version: '1.0.0',
      dependencies: { '@org/utils': '^1.0.0' },
    });
    await writeJson(join(tempDir, 'packages', 'utils'), 'package.json', {
      name: '@org/utils',
      version: '1.0.0',
    });
    const result = await discoverWorkspaces(tempDir);
    assert.ok(result !== null);
    const names = result.map(p => p.name);
    assert.ok(names.indexOf('@org/utils') < names.indexOf('@org/core'));
    assert.ok(names.indexOf('@org/core') < names.indexOf('@org/app'));
  });
});

describe('topoSort', () => {
  function makePkg(name: string, deps?: Record<string, string>): PackageContext {
    return {
      dir: `/tmp/${name}`,
      name,
      version: '1.0.0',
      pack: { version: '1.0.0', ...(deps ? { dependencies: deps } : {}) },
      tagPrefix: `${name}@`,
      files: [`/tmp/${name}`],
    };
  }

  it('should sort dependencies before dependents', () => {
    const a = makePkg('a');
    const b = makePkg('b', { a: '^1.0.0' });
    const c = makePkg('c', { b: '^1.0.0' });
    const result = topoSort([c, b, a]);
    const names = result.map(p => p.name);
    assert.deepEqual(names, ['a', 'b', 'c']);
  });

  it('should handle no dependencies', () => {
    const a = makePkg('a');
    const b = makePkg('b');
    const result = topoSort([a, b]);
    assert.equal(result.length, 2);
  });

  it('should handle diamond dependency', () => {
    const a = makePkg('a');
    const b = makePkg('b', { a: '^1.0.0' });
    const c = makePkg('c', { a: '^1.0.0' });
    const d = makePkg('d', { b: '^1.0.0', c: '^1.0.0' });
    const result = topoSort([d, c, b, a]);
    const names = result.map(p => p.name);
    assert.ok(names.indexOf('a') < names.indexOf('b'));
    assert.ok(names.indexOf('a') < names.indexOf('c'));
    assert.ok(names.indexOf('b') < names.indexOf('d'));
    assert.ok(names.indexOf('c') < names.indexOf('d'));
  });

  it('should handle circular dependencies without infinite loop', () => {
    const a = makePkg('a', { b: '^1.0.0' });
    const b = makePkg('b', { a: '^1.0.0' });
    const result = topoSort([a, b]);
    assert.equal(result.length, 2);
  });

  it('should ignore external dependencies', () => {
    const a = makePkg('a', { lodash: '^4.0.0', react: '^18.0.0' });
    const result = topoSort([a]);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'a');
  });
});
