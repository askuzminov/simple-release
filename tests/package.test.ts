import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, promises as fs } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Pack } from '../src/types';
import { detectIndent, getPack, getVersion, readPackageConfig, runScript, writeVersion } from '../src/package';

interface LockFile {
  name?: string;
  version: string;
  lockfileVersion?: number;
  requires?: boolean;
  packages?: Record<string, { name?: string; version: string }>;
}

async function writeJson(dir: string, file: string, data: object, indent = 2): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(join(dir, file), `${JSON.stringify(data, undefined, indent)}\n`, 'utf8');
}

async function readJson<T>(dir: string, file: string): Promise<T> {
  return JSON.parse(await fs.readFile(join(dir, file), 'utf8')) as T;
}

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(join(tmpdir(), 'sr-test-'));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe('getPack', () => {
  it('should read and parse package.json', async () => {
    const pkg = { name: 'test-pkg', version: '1.0.0' };
    await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify(pkg), 'utf8');
    const result = await getPack();
    assert.equal(result.name, 'test-pkg');
    assert.equal(result.version, '1.0.0');
  });

  it('should read custom file', async () => {
    const pkg = { name: 'custom', version: '2.0.0' };
    await fs.writeFile(join(tempDir, 'custom.json'), JSON.stringify(pkg), 'utf8');
    const result = await getPack(tempDir, 'custom.json');
    assert.equal(result.name, 'custom');
  });

  it('should throw for missing file', async () => {
    await assert.rejects(() => getPack(), { code: 'ENOENT' });
  });
});

describe('getVersion', () => {
  it('should return version from package.json', async () => {
    await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify({ version: '1.2.3' }), 'utf8');
    const version = await getVersion();
    assert.equal(version, '1.2.3');
  });

  it('should return 0.0.0 when version is missing', async () => {
    await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'no-version' }), 'utf8');
    const version = await getVersion();
    assert.equal(version, '0.0.0');
  });

  it('should return 0.0.0 when version is empty string', async () => {
    await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify({ version: '' }), 'utf8');
    const version = await getVersion();
    assert.equal(version, '0.0.0');
  });
});

describe('writeVersion', () => {
  it('should update version in package.json', async () => {
    await writeJson(tempDir, 'package.json', { name: 'test', version: '1.0.0' });
    await writeVersion('2.0.0');
    const pkg = await readJson<Pack>(tempDir, 'package.json');
    assert.equal(pkg.version, '2.0.0');
  });

  it('should preserve indent in package.json', async () => {
    await writeJson(tempDir, 'package.json', { name: 'test', version: '1.0.0' }, 4);
    await writeVersion('2.0.0');
    const raw = await fs.readFile(join(tempDir, 'package.json'), 'utf8');
    assert.ok(raw.includes('    "name"'));
  });

  it('should end file with newline', async () => {
    await writeJson(tempDir, 'package.json', { version: '1.0.0' });
    await writeVersion('2.0.0');
    const raw = await fs.readFile(join(tempDir, 'package.json'), 'utf8');
    assert.ok(raw.endsWith('\n'));
  });

  it('should update package-lock.json v1 (top-level version only)', async () => {
    await writeJson(tempDir, 'package.json', { version: '1.0.0' });
    await writeJson(tempDir, 'package-lock.json', { name: 'test', version: '1.0.0', lockfileVersion: 1 });
    await writeVersion('2.0.0');
    const result = await readJson<LockFile>(tempDir, 'package-lock.json');
    assert.equal(result.version, '2.0.0');
  });

  it('should update package-lock.json v2 (both top-level and packages[""])', async () => {
    await writeJson(tempDir, 'package.json', { version: '1.0.0' });
    await writeJson(tempDir, 'package-lock.json', {
      name: 'test',
      version: '1.0.0',
      lockfileVersion: 2,
      packages: { '': { name: 'test', version: '1.0.0' } },
    });
    await writeVersion('2.0.0');
    const result = await readJson<LockFile>(tempDir, 'package-lock.json');
    assert.equal(result.version, '2.0.0');
    assert.equal(result.packages?.[''].version, '2.0.0');
  });

  it('should update package-lock.json v3 (both top-level and packages[""])', async () => {
    await writeJson(tempDir, 'package.json', { version: '1.0.0' });
    await writeJson(tempDir, 'package-lock.json', {
      name: 'test',
      version: '1.0.0',
      lockfileVersion: 3,
      requires: true,
      packages: { '': { name: 'test', version: '1.0.0' } },
    });
    await writeVersion('2.0.0');
    const result = await readJson<LockFile>(tempDir, 'package-lock.json');
    assert.equal(result.version, '2.0.0');
    assert.equal(result.packages?.[''].version, '2.0.0');
  });

  it('should update npm-shrinkwrap.json', async () => {
    await writeJson(tempDir, 'package.json', { version: '1.0.0' });
    await writeJson(tempDir, 'npm-shrinkwrap.json', {
      name: 'test',
      version: '1.0.0',
      lockfileVersion: 2,
      packages: { '': { version: '1.0.0' } },
    });
    await writeVersion('2.0.0');
    const result = await readJson<LockFile>(tempDir, 'npm-shrinkwrap.json');
    assert.equal(result.version, '2.0.0');
    assert.equal(result.packages?.[''].version, '2.0.0');
  });

  it('should skip missing lockfiles without error', async () => {
    await writeJson(tempDir, 'package.json', { version: '1.0.0' });
    await writeVersion('2.0.0');
    const pkg = await readJson<Pack>(tempDir, 'package.json');
    assert.equal(pkg.version, '2.0.0');
  });

  it('should preserve indent in lockfile', async () => {
    await writeJson(tempDir, 'package.json', { version: '1.0.0' });
    await writeJson(tempDir, 'package-lock.json', { name: 'test', version: '1.0.0', lockfileVersion: 3 }, 4);
    await writeVersion('2.0.0');
    const raw = await fs.readFile(join(tempDir, 'package-lock.json'), 'utf8');
    assert.ok(raw.includes('    "name"'));
  });

  it('should update both package-lock.json and npm-shrinkwrap.json', async () => {
    await writeJson(tempDir, 'package.json', { version: '1.0.0' });
    await writeJson(tempDir, 'package-lock.json', {
      version: '1.0.0',
      lockfileVersion: 3,
      packages: { '': { version: '1.0.0' } },
    });
    await writeJson(tempDir, 'npm-shrinkwrap.json', { version: '1.0.0', lockfileVersion: 1 });
    await writeVersion('3.0.0');
    const lock = await readJson<LockFile>(tempDir, 'package-lock.json');
    const shrink = await readJson<LockFile>(tempDir, 'npm-shrinkwrap.json');
    assert.equal(lock.version, '3.0.0');
    assert.equal(lock.packages?.[''].version, '3.0.0');
    assert.equal(shrink.version, '3.0.0');
  });

  it('should run preversion script before writing', async () => {
    const marker = join(tempDir, 'preversion-ran');
    await writeJson(tempDir, 'package.json', {
      version: '1.0.0',
      scripts: { preversion: `touch ${marker}` },
    });
    await writeVersion('2.0.0');
    assert.ok(existsSync(marker));
  });

  it('should run version script after writing', async () => {
    const marker = join(tempDir, 'version-ran');
    await writeJson(tempDir, 'package.json', {
      version: '1.0.0',
      scripts: { version: `touch ${marker}` },
    });
    await writeVersion('2.0.0');
    assert.ok(existsSync(marker));
  });

  it('should not run postversion (called from index.ts after git)', async () => {
    const marker = join(tempDir, 'postversion-ran');
    await writeJson(tempDir, 'package.json', {
      version: '1.0.0',
      scripts: { postversion: `touch ${marker}` },
    });
    await writeVersion('2.0.0');
    assert.ok(!existsSync(marker));
  });

  it('should run preversion and version in order', async () => {
    const log = join(tempDir, 'lifecycle.log');
    await writeJson(tempDir, 'package.json', {
      version: '1.0.0',
      scripts: {
        preversion: `echo pre >> ${log}`,
        version: `echo ver >> ${log}`,
      },
    });
    await writeVersion('2.0.0');
    const content = await fs.readFile(log, 'utf8');
    assert.equal(content.trim(), 'pre\nver');
  });

  it('should skip lifecycle scripts when none defined', async () => {
    await writeJson(tempDir, 'package.json', { version: '1.0.0' });
    await writeVersion('2.0.0');
    const pkg = await readJson<Pack>(tempDir, 'package.json');
    assert.equal(pkg.version, '2.0.0');
  });

  it('should write version before running version script', async () => {
    const out = join(tempDir, 'version-check');
    await writeJson(tempDir, 'package.json', {
      version: '1.0.0',
      scripts: {
        version: `node -e "const p=require('./package.json');require('fs').writeFileSync('${out}',p.version)"`,
      },
    });
    await writeVersion('2.0.0');
    const captured = await fs.readFile(out, 'utf8');
    assert.equal(captured, '2.0.0');
  });

  it('should pass npm_package_version env to lifecycle scripts', async () => {
    const out = join(tempDir, 'env-check');
    await writeJson(tempDir, 'package.json', {
      version: '1.0.0',
      scripts: { version: `node -e "require('fs').writeFileSync('${out}', process.env.npm_package_version || '')"` },
    });
    await writeVersion('3.0.0');
    const captured = await fs.readFile(out, 'utf8');
    assert.equal(captured, '3.0.0');
  });

  it('should write version in custom dir', async () => {
    const subDir = join(tempDir, 'packages', 'my-pkg');
    await writeJson(subDir, 'package.json', { version: '1.0.0' });
    await writeVersion('2.0.0', subDir);
    const pkg = await readJson<Pack>(subDir, 'package.json');
    assert.equal(pkg.version, '2.0.0');
  });

  it('should run lifecycle scripts with custom cwd', async () => {
    const subDir = join(tempDir, 'packages', 'my-pkg');
    const marker = join(subDir, 'script-ran');
    await writeJson(subDir, 'package.json', {
      version: '1.0.0',
      scripts: { version: `touch script-ran` },
    });
    await writeVersion('2.0.0', subDir);
    assert.ok(existsSync(marker));
  });
});

describe('runScript', () => {
  it('should run script with custom cwd', async () => {
    const subDir = join(tempDir, 'sub');
    await fs.mkdir(subDir, { recursive: true });
    const marker = join(subDir, 'ran');
    await runScript({ scripts: { test: 'touch ran' } } as Pack, 'test', '1.0.0', subDir);
    assert.ok(existsSync(marker));
  });

  it('should skip non-existent script', async () => {
    await runScript({} as Pack, 'missing', '1.0.0', tempDir);
  });

  it('should provide npm_package_version env', async () => {
    const out = join(tempDir, 'ver');
    await runScript(
      {
        scripts: { check: `node -e "require('fs').writeFileSync('ver', process.env.npm_package_version || '')"` },
      } as Pack,
      'check',
      '5.0.0',
      tempDir
    );
    const captured = await fs.readFile(out, 'utf8');
    assert.equal(captured, '5.0.0');
  });
});

describe('detectIndent', () => {
  it('should detect 2-space indent', () => {
    assert.equal(detectIndent('{\n  "name": "test"\n}'), 2);
  });

  it('should detect 4-space indent', () => {
    assert.equal(detectIndent('{\n    "name": "test"\n}'), 4);
  });

  it('should default to 2 when no indent found', () => {
    assert.equal(detectIndent('{"name":"test"}'), 2);
  });
});

describe('readPackageConfig', () => {
  it('should return empty object when no config', () => {
    const result = readPackageConfig({ version: '1.0.0' });
    assert.deepEqual(result, {});
  });

  it('should return empty object when config is not an object', () => {
    const result = readPackageConfig({ version: '1.0.0', 'simple-release': 'invalid' });
    assert.deepEqual(result, {});
  });

  it('should read contents', () => {
    const result = readPackageConfig({ version: '1.0.0', 'simple-release': { contents: 'dist' } });
    assert.equal(result.contents, 'dist');
  });

  it('should read cascade', () => {
    const result = readPackageConfig({ version: '1.0.0', 'simple-release': { cascade: 'all' } });
    assert.equal(result.cascade, 'all');
  });

  it('should read both', () => {
    const result = readPackageConfig({ version: '1.0.0', 'simple-release': { contents: 'lib', cascade: 'none' } });
    assert.equal(result.contents, 'lib');
    assert.equal(result.cascade, 'none');
  });

  it('should ignore non-string values', () => {
    const result = readPackageConfig({
      version: '1.0.0',
      'simple-release': { contents: 123, cascade: true },
    } as unknown as Pack);
    assert.equal(result.contents, undefined);
    assert.equal(result.cascade, undefined);
  });
});
