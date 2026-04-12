import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { cascadeDeps, extractPrefix, resolveWorkspace } from '../src/changes';
import { Pack, PackageContext } from '../src/types';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'sr-changes-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function makeCtx(name: string, version: string, pack?: Partial<Pack>): PackageContext {
  const dir = join(tempDir, name);
  return {
    dir,
    name,
    version,
    pack: { version, ...pack } as Pack,
    tagPrefix: `${name}@`,
    files: [dir],
  };
}

async function writeJson(dir: string, file: string, data: object): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(join(dir, file), `${JSON.stringify(data, undefined, 2)}\n`, 'utf8');
}

async function readJson<T>(dir: string, file: string): Promise<T> {
  return JSON.parse(await fs.readFile(join(dir, file), 'utf8')) as T;
}

describe('cascadeDeps', () => {
  it('should update dependencies version', async () => {
    const pkgA = makeCtx('pkg-a', '1.0.0');
    const pkgB = makeCtx('pkg-b', '1.0.0', {
      dependencies: { 'pkg-a': '^0.9.0' },
    });
    await writeJson(pkgB.dir, 'package.json', pkgB.pack);

    const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
    await cascadeDeps([pkgA, pkgB], releases);

    const result = await readJson<Pack>(pkgB.dir, 'package.json');
    const deps = result.dependencies as Record<string, string>;
    assert.equal(deps['pkg-a'], '^1.1.0');
  });

  it('should bump dependent package version in auto mode', async () => {
    const pkgA = makeCtx('pkg-a', '1.0.0');
    const pkgB = makeCtx('pkg-b', '1.0.0', {
      dependencies: { 'pkg-a': '^0.9.0' },
    });
    await writeJson(pkgB.dir, 'package.json', pkgB.pack);

    const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
    await cascadeDeps([pkgA, pkgB], releases);

    assert.equal(releases.length, 2);
    assert.equal(releases[1].name, 'pkg-b');
    assert.equal(releases[1].version, '1.0.1');
  });

  it('should not update devDependencies in auto mode', async () => {
    const pkgA = makeCtx('pkg-a', '1.0.0');
    const pkgB = makeCtx('pkg-b', '1.0.0', {
      devDependencies: { 'pkg-a': '^0.9.0' },
    });
    await writeJson(pkgB.dir, 'package.json', pkgB.pack);

    const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
    await cascadeDeps([pkgA, pkgB], releases);

    const result = await readJson<Pack>(pkgB.dir, 'package.json');
    const devDeps = result.devDependencies as Record<string, string>;
    assert.equal(devDeps['pkg-a'], '^0.9.0');
  });

  it('should skip already released packages', async () => {
    const pkgA = makeCtx('pkg-a', '1.0.0', {
      dependencies: { 'pkg-a': '^0.9.0' },
    });
    await writeJson(pkgA.dir, 'package.json', pkgA.pack);

    const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
    await cascadeDeps([pkgA], releases);

    assert.equal(releases.length, 1);
  });

  it('should skip packages without matching dependency', async () => {
    const pkgA = makeCtx('pkg-a', '1.0.0');
    const pkgC = makeCtx('pkg-c', '1.0.0', {
      dependencies: { 'other-pkg': '^1.0.0' },
    });
    await writeJson(pkgC.dir, 'package.json', pkgC.pack);

    const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
    await cascadeDeps([pkgA, pkgC], releases);

    const result = await readJson<Pack>(pkgC.dir, 'package.json');
    const deps = result.dependencies as Record<string, string>;
    assert.equal(deps['other-pkg'], '^1.0.0');
  });

  it('should cascade through chain: A→B→C', async () => {
    const pkgA = makeCtx('pkg-a', '1.0.0');
    const pkgB = makeCtx('pkg-b', '2.0.0', {
      dependencies: { 'pkg-a': '^0.9.0' },
    });
    const pkgC = makeCtx('pkg-c', '3.0.0', {
      dependencies: { 'pkg-b': '^1.0.0' },
    });
    await writeJson(pkgB.dir, 'package.json', pkgB.pack);
    await writeJson(pkgC.dir, 'package.json', pkgC.pack);

    const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
    await cascadeDeps([pkgA, pkgB, pkgC], releases);

    assert.equal(releases.length, 3);
    assert.equal(releases[1].name, 'pkg-b');
    assert.equal(releases[1].version, '2.0.1');
    assert.equal(releases[2].name, 'pkg-c');
    assert.equal(releases[2].version, '3.0.1');
  });

  it('should not update devDependencies', async () => {
    const pkgA = makeCtx('pkg-a', '1.0.0');
    const pkgB = makeCtx('pkg-b', '1.0.0', {
      devDependencies: { 'pkg-a': '^0.9.0' },
    });
    await writeJson(pkgB.dir, 'package.json', pkgB.pack);

    const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
    await cascadeDeps([pkgA, pkgB], releases);

    const result = await readJson<Pack>(pkgB.dir, 'package.json');
    const devDeps = result.devDependencies as Record<string, string>;
    assert.equal(devDeps['pkg-a'], '^0.9.0');
    assert.equal(releases.length, 1);
  });

  describe('preserves version prefix', () => {
    it('should preserve ^ prefix', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '1.0.0', {
        dependencies: { 'pkg-a': '^1.0.0' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases);

      const result = await readJson<Pack>(pkgB.dir, 'package.json');
      const deps = result.dependencies as Record<string, string>;
      assert.equal(deps['pkg-a'], '^1.1.0');
    });

    it('should preserve ~ prefix', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '1.0.0', {
        dependencies: { 'pkg-a': '~1.0.0' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases);

      const result = await readJson<Pack>(pkgB.dir, 'package.json');
      const deps = result.dependencies as Record<string, string>;
      assert.equal(deps['pkg-a'], '~1.1.0');
    });

    it('should preserve exact version (no prefix)', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '1.0.0', {
        dependencies: { 'pkg-a': '1.0.0' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases);

      const result = await readJson<Pack>(pkgB.dir, 'package.json');
      const deps = result.dependencies as Record<string, string>;
      assert.equal(deps['pkg-a'], '1.1.0');
    });

    it('should bump workspace:* dependent in auto mode (PM resolves at publish)', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '2.0.0', {
        dependencies: { 'pkg-a': 'workspace:*' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases);

      assert.equal(releases.length, 2);
      assert.equal(releases[1].name, 'pkg-b');
      assert.equal(releases[1].version, '2.0.1');
      const result = await readJson<Pack>(pkgB.dir, 'package.json');
      const deps = result.dependencies as Record<string, string>;
      assert.equal(deps['pkg-a'], 'workspace:*');
    });

    it('should bump workspace:* dependent in all mode', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '2.0.0', {
        dependencies: { 'pkg-a': 'workspace:*' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases);

      assert.equal(releases.length, 2);
      assert.equal(releases[1].name, 'pkg-b');
      assert.equal(releases[1].version, '2.0.1');
      const result = await readJson<Pack>(pkgB.dir, 'package.json');
      const deps = result.dependencies as Record<string, string>;
      assert.equal(deps['pkg-a'], 'workspace:*');
    });

    it('should preserve >= prefix', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '1.0.0', {
        dependencies: { 'pkg-a': '>=1.0.0' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases);

      const result = await readJson<Pack>(pkgB.dir, 'package.json');
      const deps = result.dependencies as Record<string, string>;
      assert.equal(deps['pkg-a'], '>=1.1.0');
    });
  });

  describe('lazy mode', () => {
    it('should skip when ^ range covers new version (minor bump)', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '1.0.0', {
        dependencies: { 'pkg-a': '^1.0.0' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases, 'lazy');

      assert.equal(releases.length, 1);
      const result = await readJson<Pack>(pkgB.dir, 'package.json');
      const deps = result.dependencies as Record<string, string>;
      assert.equal(deps['pkg-a'], '^1.0.0');
    });

    it('should bump when ^ range does not cover new version (major bump)', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '1.0.0', {
        dependencies: { 'pkg-a': '^1.0.0' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '2.0.0', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases, 'lazy');

      assert.equal(releases.length, 2);
      assert.equal(releases[1].name, 'pkg-b');
      const result = await readJson<Pack>(pkgB.dir, 'package.json');
      const deps = result.dependencies as Record<string, string>;
      assert.equal(deps['pkg-a'], '^2.0.0');
    });

    it('should bump when ~ range does not cover minor bump', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '1.0.0', {
        dependencies: { 'pkg-a': '~1.0.0' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases, 'lazy');

      assert.equal(releases.length, 2);
      const result = await readJson<Pack>(pkgB.dir, 'package.json');
      const deps = result.dependencies as Record<string, string>;
      assert.equal(deps['pkg-a'], '~1.1.0');
    });

    it('should skip when ~ range covers patch bump', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '1.0.0', {
        dependencies: { 'pkg-a': '~1.0.0' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '1.0.1', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases, 'lazy');

      assert.equal(releases.length, 1);
    });

    it('should always bump exact version', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '1.0.0', {
        dependencies: { 'pkg-a': '1.0.0' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '1.0.1', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases, 'lazy');

      assert.equal(releases.length, 2);
      const result = await readJson<Pack>(pkgB.dir, 'package.json');
      const deps = result.dependencies as Record<string, string>;
      assert.equal(deps['pkg-a'], '1.0.1');
    });

    it('should bump workspace:* deps (exact)', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '2.0.0', {
        dependencies: { 'pkg-a': 'workspace:*' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases, 'lazy');

      assert.equal(releases.length, 2);
      assert.equal(releases[1].version, '2.0.1');
    });

    it('should skip workspace:^ when minor bump (range covers)', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '2.0.0', {
        dependencies: { 'pkg-a': 'workspace:^' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases, 'lazy');

      assert.equal(releases.length, 1);
    });

    it('should bump workspace:^ when major bump (range broken)', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '2.0.0', {
        dependencies: { 'pkg-a': 'workspace:^' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '2.0.0', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases, 'lazy');

      assert.equal(releases.length, 2);
      assert.equal(releases[1].version, '2.0.1');
    });

    it('should skip workspace:~ when patch bump (range covers)', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '2.0.0', {
        dependencies: { 'pkg-a': 'workspace:~' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '1.0.1', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases, 'lazy');

      assert.equal(releases.length, 1);
    });

    it('should bump workspace:~ when minor bump (range broken)', async () => {
      const pkgA = makeCtx('pkg-a', '1.0.0');
      const pkgB = makeCtx('pkg-b', '2.0.0', {
        dependencies: { 'pkg-a': 'workspace:~' },
      });
      await writeJson(pkgB.dir, 'package.json', pkgB.pack);

      const releases = [{ name: 'pkg-a', version: '1.1.0', ctx: pkgA }];
      await cascadeDeps([pkgA, pkgB], releases, 'lazy');

      assert.equal(releases.length, 2);
      assert.equal(releases[1].version, '2.0.1');
    });
  });
});

describe('extractPrefix', () => {
  it('should extract ^', () => {
    assert.equal(extractPrefix('^1.0.0'), '^');
  });

  it('should extract ~', () => {
    assert.equal(extractPrefix('~1.0.0'), '~');
  });

  it('should extract empty for exact', () => {
    assert.equal(extractPrefix('1.0.0'), '');
  });

  it('should extract >=', () => {
    assert.equal(extractPrefix('>=1.0.0'), '>=');
  });

  it('should extract empty for workspace protocol', () => {
    assert.equal(extractPrefix('workspace:*'), '');
    assert.equal(extractPrefix('workspace:^1.0.0'), '');
    assert.equal(extractPrefix('workspace:~1.0.0'), '');
  });
});

describe('resolveWorkspace', () => {
  it('should resolve workspace:* to exact version', () => {
    assert.equal(resolveWorkspace('workspace:*', '1.2.3'), '1.2.3');
  });

  it('should resolve workspace:^ to caret range', () => {
    assert.equal(resolveWorkspace('workspace:^', '1.2.3'), '^1.2.3');
  });

  it('should resolve workspace:~ to tilde range', () => {
    assert.equal(resolveWorkspace('workspace:~', '1.2.3'), '~1.2.3');
  });

  it('should resolve unknown workspace protocol to exact', () => {
    assert.equal(resolveWorkspace('workspace:>=', '1.2.3'), '1.2.3');
  });
});
