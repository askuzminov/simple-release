import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { detectPM, getVersionType } from '../src/npm';

function makeConfig(flags: { isMajor?: boolean; isMinor?: boolean } = {}) {
  return {
    groups: {},
    isMajor: flags.isMajor ?? false,
    isMinor: flags.isMinor ?? false,
    isEmpty: false,
  };
}

describe('getVersionType', () => {
  it('should return major for breaking changes', () => {
    assert.equal(getVersionType(makeConfig({ isMajor: true })), 'major');
  });

  it('should return minor for features', () => {
    assert.equal(getVersionType(makeConfig({ isMinor: true })), 'minor');
  });

  it('should return patch for fixes/other', () => {
    assert.equal(getVersionType(makeConfig()), 'patch');
  });

  it('should prefer major over minor', () => {
    assert.equal(getVersionType(makeConfig({ isMajor: true, isMinor: true })), 'major');
  });

  it('should return premajor with string preid', () => {
    assert.equal(getVersionType(makeConfig({ isMajor: true }), 'beta'), 'premajor');
  });

  it('should return preminor with string preid', () => {
    assert.equal(getVersionType(makeConfig({ isMinor: true }), 'alpha'), 'preminor');
  });

  it('should return prepatch with string preid', () => {
    assert.equal(getVersionType(makeConfig(), 'rc'), 'prepatch');
  });

  it('should return premajor with boolean true preid', () => {
    assert.equal(getVersionType(makeConfig({ isMajor: true }), true), 'premajor');
  });

  it('should return prepatch with boolean true preid', () => {
    assert.equal(getVersionType(makeConfig(), true), 'prepatch');
  });

  it('should not add pre prefix with false preid', () => {
    assert.equal(getVersionType(makeConfig({ isMinor: true }), false), 'minor');
  });
});

describe('detectPM', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(join(tmpdir(), 'sr-pm-'));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should detect npm by default', () => {
    const pm = detectPM();
    assert.ok(pm.startsWith('npm'));
  });

  it('should detect bun from bun.lock', async () => {
    await fs.writeFile(join(tempDir, 'bun.lock'), '', 'utf8');
    assert.equal(detectPM(), 'bun');
  });

  it('should detect bun from bun.lockb', async () => {
    await fs.writeFile(join(tempDir, 'bun.lockb'), '', 'utf8');
    assert.equal(detectPM(), 'bun');
  });

  it('should detect pnpm from pnpm-lock.yaml', async () => {
    await fs.writeFile(join(tempDir, 'pnpm-lock.yaml'), '', 'utf8');
    const pm = detectPM();
    assert.ok(pm.startsWith('pnpm'));
  });

  it('should detect yarn from yarn.lock', async () => {
    await fs.writeFile(join(tempDir, 'yarn.lock'), '', 'utf8');
    const pm = detectPM();
    assert.ok(pm.startsWith('yarn'));
  });

  it('should prefer npm when package-lock.json exists alongside others', async () => {
    await fs.writeFile(join(tempDir, 'package-lock.json'), '', 'utf8');
    await fs.writeFile(join(tempDir, 'bun.lock'), '', 'utf8');
    const pm = detectPM();
    assert.ok(pm.startsWith('npm'));
  });

  it('should detect npm from package-lock.json', async () => {
    await fs.writeFile(join(tempDir, 'package-lock.json'), '', 'utf8');
    const pm = detectPM();
    assert.ok(pm.startsWith('npm'));
  });

  it('should detect npm from npm-shrinkwrap.json', async () => {
    await fs.writeFile(join(tempDir, 'npm-shrinkwrap.json'), '', 'utf8');
    const pm = detectPM();
    assert.ok(pm.startsWith('npm'));
  });
});
