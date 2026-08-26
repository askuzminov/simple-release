import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, execSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ARG } from '../src/arg';
import { publishDir, publishPackage, publishTargets } from '../src/publish';
import { PackageContext } from '../src/types';

const MARKER = '.sr-publish';
const CUSTOM = 'http://127.0.0.1:9/npm/';
const skip = process.platform === 'win32';

let tempDir: string;
let originalCwd: string;
let originalPath: string | undefined;
let snapshot: Pick<
  typeof ARG,
  'publish-github' | 'publish-npmjs' | '--publish-custom' | '--contents' | 'prerelease' | 'provenance'
>;

function writeJson(dir: string, file: string, data: object): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), `${JSON.stringify(data, undefined, 2)}\n`, 'utf8');
}

function shimPM(): string {
  const bin = join(tempDir, 'bin');
  mkdirSync(bin, { recursive: true });

  for (const name of ['npm', 'bun', 'pnpm', 'yarn']) {
    const file = join(bin, name);
    writeFileSync(file, `#!/bin/sh\nprintf '%s\\n' "$*" >> ./${MARKER}\n`, 'utf8');
    chmodSync(file, 0o755);
  }

  return bin;
}

function published(dir: string): string | undefined {
  const file = join(dir, MARKER);

  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

function context(dir: string): PackageContext {
  return { dir, name: 'test-pkg', version: '1.0.0', pack: { version: '1.0.0' }, tagPrefix: 'v', files: [] };
}

beforeEach(async () => {
  originalCwd = process.cwd();
  originalPath = process.env.PATH;
  tempDir = await mkdtemp(join(tmpdir(), 'sr-pub-'));
  process.env.PATH = `${shimPM()}${delimiter}${originalPath ?? ''}`;
  snapshot = {
    'publish-github': ARG['publish-github'],
    'publish-npmjs': ARG['publish-npmjs'],
    '--publish-custom': ARG['--publish-custom'],
    '--contents': ARG['--contents'],
    prerelease: ARG.prerelease,
    provenance: ARG.provenance,
  };
});

afterEach(async () => {
  Object.assign(ARG, snapshot);
  process.chdir(originalCwd);
  process.env.PATH = originalPath;
  await rm(tempDir, { recursive: true, force: true });
});

describe('publishDir', () => {
  it('should stay in the package root without contents', () => {
    ARG['--contents'] = undefined;
    assert.equal(publishDir('/repo'), '/repo');
  });

  it('should descend into contents', () => {
    ARG['--contents'] = 'dist';
    assert.equal(publishDir('/repo'), join('/repo', 'dist'));
  });

  it('should ignore an empty contents', () => {
    ARG['--contents'] = '';
    assert.equal(publishDir('/repo'), '/repo');
  });
});

describe('publishTargets', () => {
  it('should be empty when no registry is selected', () => {
    assert.deepEqual(publishTargets(), []);
  });

  it('should collect flags and custom registries', () => {
    ARG['publish-github'] = true;
    ARG['publish-npmjs'] = true;
    ARG['--publish-custom'] = [CUSTOM];

    assert.deepEqual(publishTargets(), [
      ['https://npm.pkg.github.com', 'npm.pkg.github.com'],
      ['https://registry.npmjs.org', 'registry.npmjs.org'],
      [CUSTOM, CUSTOM],
    ]);
  });
});

describe('publishPackage', { skip }, () => {
  beforeEach(() => {
    writeJson(tempDir, 'package.json', { name: 'test-pkg', version: '1.0.0' });
    writeJson(tempDir, 'package-lock.json', { name: 'test-pkg', version: '1.0.0', lockfileVersion: 3 });
    writeJson(join(tempDir, 'dist'), 'package.json', { name: 'test-pkg', version: '1.0.0', main: './index.js' });
    process.chdir(tempDir);
    ARG['--publish-custom'] = [CUSTOM];
  });

  it('should publish from the contents subdirectory', async () => {
    ARG['--contents'] = 'dist';
    const errors: string[] = [];

    await publishPackage(context(tempDir), errors);

    assert.deepEqual(errors, []);
    assert.equal(published(tempDir), undefined);
    assert.equal(published(join(tempDir, 'dist')), `publish --tag latest --registry ${CUSTOM}\n`);
  });

  it('should publish from the package root without contents', async () => {
    ARG['--contents'] = undefined;
    const errors: string[] = [];

    await publishPackage(context(tempDir), errors);

    assert.deepEqual(errors, []);
    assert.equal(published(join(tempDir, 'dist')), undefined);
    assert.equal(published(tempDir), `publish --tag latest --registry ${CUSTOM}\n`);
  });

  it('should publish once per registry', async () => {
    ARG['--contents'] = 'dist';
    ARG['--publish-custom'] = [CUSTOM, `${CUSTOM}other/`];

    await publishPackage(context(tempDir));

    assert.equal(
      published(join(tempDir, 'dist')),
      `publish --tag latest --registry ${CUSTOM}\npublish --tag latest --registry ${CUSTOM}other/\n`
    );
  });

  it('should publish a canary tag for a prerelease', async () => {
    ARG['--contents'] = 'dist';
    ARG.prerelease = 'next';

    await publishPackage(context(tempDir));

    assert.equal(published(join(tempDir, 'dist')), `publish --tag canary --registry ${CUSTOM}\n`);
  });

  it('should sync the released version into the contents manifest before publishing', async () => {
    ARG['--contents'] = 'dist';
    writeJson(tempDir, 'package.json', { name: 'test-pkg', version: '1.1.0' });

    await publishPackage(context(tempDir));

    const pack = JSON.parse(readFileSync(join(tempDir, 'dist', 'package.json'), 'utf8')) as Record<string, string>;

    assert.equal(pack.version, '1.1.0');
    assert.equal(pack.main, './index.js');
    assert.equal(published(join(tempDir, 'dist')), `publish --tag latest --registry ${CUSTOM}\n`);
  });

  it('should leave the manifest untouched without contents', async () => {
    ARG['--contents'] = undefined;
    const before = readFileSync(join(tempDir, 'package.json'), 'utf8');

    await publishPackage(context(tempDir));

    assert.equal(readFileSync(join(tempDir, 'package.json'), 'utf8'), before);
  });

  it('should fail when contents has no package.json', async () => {
    ARG['--contents'] = 'lib';
    const errors: string[] = [];

    await publishPackage(context(tempDir), errors);

    assert.deepEqual(errors, [`test-pkg → ${join(tempDir, 'lib')}`]);
    assert.equal(published(tempDir), undefined);
  });

  it('should do nothing when no registry is selected', async () => {
    ARG['--contents'] = 'lib';
    ARG['--publish-custom'] = [];
    const errors: string[] = [];

    await publishPackage(context(tempDir), errors);

    assert.deepEqual(errors, []);
    assert.equal(published(tempDir), undefined);
  });
});

describe('cli single package', { skip }, () => {
  function git(args: string): string {
    return execSync(`git ${args}`, { cwd: tempDir, encoding: 'utf8', stdio: 'pipe' }).trim();
  }

  function release(): string {
    const loader = join(__dirname, '..', 'node_modules', 'tsx', 'dist', 'loader.mjs');

    return execFileSync(
      process.execPath,
      [
        '--import',
        pathToFileURL(loader).href,
        join(__dirname, '..', 'src'),
        'disable-git',
        'disable-github',
        'disable-md',
        '--publish-custom',
        CUSTOM,
      ],
      { cwd: tempDir, encoding: 'utf8', stdio: 'pipe' }
    );
  }

  beforeEach(() => {
    writeJson(tempDir, 'package.json', {
      name: 'test-pkg',
      version: '1.0.0',
      repository: { type: 'git', url: 'https://github.com/test/test.git' },
      'simple-release': { contents: 'dist' },
    });
    writeJson(join(tempDir, 'dist'), 'package.json', { name: 'test-pkg', version: '1.0.0', main: './index.js' });
    git('init');
    git('config user.email "test@test.com"');
    git('config user.name "Test"');
    git('add -A');
    git('commit -m "chore: init"');
    git('commit --allow-empty -m "feat: a feature"');
  });

  it('should publish from the configured contents directory', () => {
    release();

    const pack = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf8')) as { version: string };

    assert.equal(pack.version, '1.1.0');
    assert.equal(published(tempDir), undefined);
    assert.equal(published(join(tempDir, 'dist')), `publish --tag latest --registry ${CUSTOM}\n`);
  });

  it('should publish the bumped version without a build hook', () => {
    release();

    const pack = JSON.parse(readFileSync(join(tempDir, 'dist', 'package.json'), 'utf8')) as Record<string, string>;

    assert.equal(pack.version, '1.1.0');
    assert.equal(pack.main, './index.js');
  });
});
