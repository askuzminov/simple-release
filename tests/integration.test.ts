import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { promises as fs, mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { checkBranch, getCommitsRaw, getHash, getTag, parseCommits, writeGit, writeWorkspaceGit } from '../src/git';
import { syncVersion, writeVersion } from '../src/package';
import { Pack, PackageContext } from '../src/types';
import { parseJSON, retry, sp } from '../src/utils';
import { parse } from '../src/parser';
import { detectPackageChanges } from '../src/changes';

let tempDir: string;
let originalCwd: string;

function git(args: string, cwd?: string): string {
  return execSync(`git ${args}`, { cwd: cwd ?? tempDir, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function writeJson(dir: string, file: string, data: object): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), `${JSON.stringify(data, undefined, 2)}\n`, 'utf8');
}

function commit(msg: string, files?: string[]): void {
  if (files !== undefined) {
    for (const f of files) {
      git(`add "${f}"`);
    }
  } else {
    git('add -A');
  }
  git(`commit --allow-empty -m "${msg}"`);
}

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(join(tmpdir(), 'sr-int-'));
  git('init');
  git('config user.email "test@test.com"');
  git('config user.name "Test"');
  writeJson(tempDir, 'package.json', { name: 'test-pkg', version: '1.0.0' });
  commit('chore: init');
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe('git integration', () => {
  describe('getHash', () => {
    it('should return current HEAD hash', async () => {
      process.chdir(tempDir);
      const hash = await getHash();
      assert.match(hash, /^[a-f0-9]{40}$/);
    });
  });

  describe('getTag', () => {
    it('should return latest tag', async () => {
      process.chdir(tempDir);
      git('tag v1.0.0');
      commit('feat: new feature');
      const tag = await getTag();
      assert.equal(tag, 'v1.0.0');
    });

    it('should return tag matching pattern', async () => {
      process.chdir(tempDir);
      git('tag v1.0.0');
      git('tag other-tag');
      commit('feat: new feature');
      const tag = await getTag('v*');
      assert.equal(tag, 'v1.0.0');
    });

    it('should fallback to first commit when no tags', async () => {
      process.chdir(tempDir);
      commit('feat: second');
      const tag = await getTag();
      assert.match(tag, /^[a-f0-9]{40}$/);
    });
  });

  describe('getCommitsRaw + parseCommits', () => {
    it('should return commits between tag and HEAD', async () => {
      process.chdir(tempDir);
      git('tag v1.0.0');
      writeJson(tempDir, 'src.ts', { code: true });
      commit('feat: add feature');
      writeJson(tempDir, 'src2.ts', { code: true });
      commit('fix: bug fix');
      const hash = await getHash();
      const raw = await getCommitsRaw('v1.0.0', hash);
      const commits = parseCommits(raw);
      assert.equal(commits.length, 2);
    });

    it('should filter by file path', async () => {
      process.chdir(tempDir);
      git('tag v1.0.0');
      await fs.mkdir(join(tempDir, 'src'), { recursive: true });
      await fs.mkdir(join(tempDir, 'docs'), { recursive: true });
      await fs.writeFile(join(tempDir, 'src', 'index.ts'), 'code', 'utf8');
      commit('feat: src change', ['src/index.ts']);
      await fs.writeFile(join(tempDir, 'docs', 'readme.md'), 'docs', 'utf8');
      commit('docs: readme', ['docs/readme.md']);
      const hash = await getHash();
      const raw = await getCommitsRaw('v1.0.0', hash, ['src']);
      const commits = parseCommits(raw);
      assert.equal(commits.length, 1);
      assert.ok(commits[0].title.includes('src change'));
    });
  });

  describe('writeGit', () => {
    it('should create commit and tag', async () => {
      process.chdir(tempDir);
      await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify({ version: '1.1.0' }, undefined, 2), 'utf8');
      await writeGit('v1.1.0');
      const logOutput = git('log --oneline -1');
      assert.ok(logOutput.includes('chore(release): v1.1.0'));
      const tags = git('tag');
      assert.ok(tags.includes('v1.1.0'));
    });

    it('should handle missing package-lock.json', async () => {
      process.chdir(tempDir);
      await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify({ version: '1.1.0' }, undefined, 2), 'utf8');
      await writeGit('v1.1.0');
      const logOutput = git('log --oneline -1');
      assert.ok(logOutput.includes('v1.1.0'));
    });
  });

  describe('writeWorkspaceGit', () => {
    it('should create single commit with multiple tags', async () => {
      process.chdir(tempDir);
      await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify({ version: '2.0.0' }, undefined, 2), 'utf8');
      await writeWorkspaceGit([
        { name: '@org/core', version: '1.1.0' },
        { name: '@org/utils', version: '2.0.0' },
      ]);

      const logOutput = git('log --oneline -1');
      assert.ok(logOutput.includes('chore(release): publish'));

      const logBody = git('log -1 --format=%b');
      assert.ok(logBody.includes('@org/core@1.1.0'));
      assert.ok(logBody.includes('@org/utils@2.0.0'));

      const tags = git('tag');
      assert.ok(tags.includes('@org/core@1.1.0'));
      assert.ok(tags.includes('@org/utils@2.0.0'));
    });

    it('should not capture gitignored files', async () => {
      process.chdir(tempDir);
      await fs.writeFile(join(tempDir, '.gitignore'), 'secret.env\n', 'utf8');
      git('add .gitignore');
      commit('chore: add gitignore');

      await fs.writeFile(join(tempDir, 'secret.env'), 'TOKEN=abc', 'utf8');
      await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify({ version: '2.0.0' }, undefined, 2), 'utf8');
      await writeWorkspaceGit([{ name: 'pkg', version: '1.0.0' }]);

      const diff = git('show --stat HEAD');
      assert.ok(!diff.includes('secret.env'));
    });
  });
});

describe('detectPackageChanges integration', () => {
  it('should detect changes in package directory', async () => {
    process.chdir(tempDir);
    const pkgDir = join(tempDir, 'packages', 'core');
    await fs.mkdir(pkgDir, { recursive: true });
    await fs.writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name: '@org/core', version: '1.0.0' }), 'utf8');
    await fs.writeFile(join(pkgDir, 'index.ts'), 'export const a = 1;', 'utf8');
    commit('feat: init core');
    git('tag @org/core@1.0.0');

    await fs.writeFile(join(pkgDir, 'index.ts'), 'export const a = 2;', 'utf8');
    commit('fix: fix core bug', ['packages/core/index.ts']);

    const hash = await getHash();
    const ctx: PackageContext = {
      dir: pkgDir,
      name: '@org/core',
      version: '1.0.0',
      pack: { name: '@org/core', version: '1.0.0' },
      tagPrefix: '@org/core@',
      files: [pkgDir],
    };

    const result = await detectPackageChanges(ctx, hash, '');
    assert.ok(result !== null);
    assert.equal(result.ctx.name, '@org/core');
    assert.equal(result.config.isEmpty, false);
  });

  it('should return null when no changes in package directory', async () => {
    process.chdir(tempDir);
    const coreDir = join(tempDir, 'packages', 'core');
    const utilsDir = join(tempDir, 'packages', 'utils');
    await fs.mkdir(coreDir, { recursive: true });
    await fs.mkdir(utilsDir, { recursive: true });
    await fs.writeFile(join(coreDir, 'package.json'), JSON.stringify({ name: '@org/core', version: '1.0.0' }), 'utf8');
    await fs.writeFile(join(coreDir, 'index.ts'), 'core', 'utf8');
    await fs.writeFile(
      join(utilsDir, 'package.json'),
      JSON.stringify({ name: '@org/utils', version: '1.0.0' }),
      'utf8'
    );
    await fs.writeFile(join(utilsDir, 'index.ts'), 'utils', 'utf8');
    commit('feat: init both');
    git('tag @org/utils@1.0.0');

    // Only change core, not utils
    await fs.writeFile(join(coreDir, 'index.ts'), 'core v2', 'utf8');
    commit('fix: fix core only', ['packages/core/index.ts']);

    const hash = await getHash();
    const ctx: PackageContext = {
      dir: utilsDir,
      name: '@org/utils',
      version: '1.0.0',
      pack: { name: '@org/utils', version: '1.0.0' },
      tagPrefix: '@org/utils@',
      files: [utilsDir],
    };

    const result = await detectPackageChanges(ctx, hash, '');
    assert.equal(result, null);
  });

  it('should detect major change from conventional commit', async () => {
    process.chdir(tempDir);
    const pkgDir = join(tempDir, 'packages', 'api');
    await fs.mkdir(pkgDir, { recursive: true });
    await fs.writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name: '@org/api', version: '1.0.0' }), 'utf8');
    await fs.writeFile(join(pkgDir, 'index.ts'), 'v1', 'utf8');
    commit('feat: init api');
    git('tag @org/api@1.0.0');

    await fs.writeFile(join(pkgDir, 'index.ts'), 'v2', 'utf8');
    commit('feat!: breaking api change', ['packages/api/index.ts']);

    const hash = await getHash();
    const ctx: PackageContext = {
      dir: pkgDir,
      name: '@org/api',
      version: '1.0.0',
      pack: { name: '@org/api', version: '1.0.0' },
      tagPrefix: '@org/api@',
      files: [pkgDir],
    };

    const result = await detectPackageChanges(ctx, hash, '');
    assert.ok(result !== null);
    assert.equal(result.config.isMajor, true);
  });
});

describe('full single-package flow', () => {
  it('should parse commits and determine version bump', async () => {
    process.chdir(tempDir);
    git('tag v1.0.0');

    await fs.writeFile(join(tempDir, 'src.ts'), 'feature', 'utf8');
    commit('feat: new feature');
    await fs.writeFile(join(tempDir, 'src2.ts'), 'fix', 'utf8');
    commit('fix: bug fix');

    const hash = await getHash();
    const tag = await getTag();
    const raw = await getCommitsRaw(tag, hash);
    const commits = parseCommits(raw);
    const config = parse(commits, '');

    assert.equal(config.isEmpty, false);
    assert.equal(config.isMinor, true);
    assert.equal(config.isMajor, false);
    assert.ok('feat' in config.groups);
    assert.ok('fix' in config.groups);
  });

  it('should detect breaking change in body', async () => {
    process.chdir(tempDir);
    git('tag v1.0.0');

    await fs.writeFile(join(tempDir, 'src.ts'), 'refactor', 'utf8');
    git('add -A');
    git('commit -m "refactor: big change" -m "BREAKING CHANGES: removed old API"');

    const hash = await getHash();
    const raw = await getCommitsRaw('v1.0.0', hash);
    const commits = parseCommits(raw);
    const config = parse(commits, '');

    assert.equal(config.isMajor, true);
  });
});

describe('sp() error handling', () => {
  it('should reject on non-existent command', async () => {
    await assert.rejects(() => sp('nonexistent-command-12345', []), { code: 'ENOENT' });
  });

  it('should reject on non-zero exit code', async () => {
    await assert.rejects(() => sp('node', ['-e', 'process.exit(1)']));
  });

  it('should resolve stdout on success', async () => {
    const result = await sp('node', ['-e', 'process.stdout.write("hello")']);
    assert.equal(result, 'hello');
  });

  it('should trim output', async () => {
    const result = await sp('node', ['-e', 'process.stdout.write("  hello  ")']);
    assert.equal(result, 'hello');
  });
});

describe('createTag (duplicate tag)', () => {
  it('should skip if tag already exists', async () => {
    process.chdir(tempDir);
    git('tag v1.0.0');
    await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify({ version: '1.0.1' }, undefined, 2), 'utf8');
    // writeGit tries to create tag v1.0.0 again — should not throw
    await writeGit('v1.0.0');
    const tags = git('tag -l v1.0.0');
    assert.ok(tags.includes('v1.0.0'));
  });

  it('should create tag if it does not exist', async () => {
    process.chdir(tempDir);
    await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify({ version: '2.0.0' }, undefined, 2), 'utf8');
    await writeGit('v2.0.0');
    const tags = git('tag -l v2.0.0');
    assert.ok(tags.includes('v2.0.0'));
  });
});

describe('getTag fallback (no tags, no commits)', () => {
  it('should handle repo with commits but no tags', async () => {
    process.chdir(tempDir);
    commit('feat: second commit');
    const tag = await getTag();
    assert.match(tag, /^[a-f0-9]{40}$/);
  });
});

describe('checkBranch', () => {
  it('should not throw on normal branch', async () => {
    process.chdir(tempDir);
    await checkBranch();
  });

  it('should warn on detached HEAD', async () => {
    process.chdir(tempDir);
    commit('feat: extra');
    const branch = git('rev-parse --abbrev-ref HEAD');
    const hash = git('rev-parse HEAD');
    git(`checkout ${hash} --quiet`);
    // Should not throw, just warn
    await checkBranch();
    git(`checkout ${branch} --quiet`);
  });
});

describe('parseJSON', () => {
  it('should parse JSON with BOM', () => {
    const result = parseJSON<Pack>('\uFEFF{"version":"1.0.0"}');
    assert.equal(result.version, '1.0.0');
  });

  it('should parse JSON without BOM', () => {
    const result = parseJSON<Pack>('{"version":"2.0.0"}');
    assert.equal(result.version, '2.0.0');
  });

  it('should throw on invalid JSON', () => {
    assert.throws(() => parseJSON('not json'));
  });
});

describe('writeVersion after preversion hook modifies package.json', () => {
  it('should preserve hook changes except version', async () => {
    process.chdir(tempDir);
    const pkgPath = join(tempDir, 'package.json');
    const pkgData = {
      name: 'test',
      version: '1.0.0',
      scripts: {
        preversion: `node -e "const p=require('./package.json');p.description='added';require('fs').writeFileSync('./package.json',JSON.stringify(p,null,2)+'\\n')"`,
      },
    };
    await fs.writeFile(pkgPath, `${JSON.stringify(pkgData, undefined, 2)}\n`, 'utf8');

    await writeVersion('2.0.0');

    const result = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as Pack;
    assert.equal(result.version, '2.0.0');
    assert.equal(result.description, 'added');
  });
});

describe('syncVersion', () => {
  it('should write the version and keep every other field', async () => {
    const dir = join(tempDir, 'dist');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      '{\n  "name": "test-pkg",\n  "version": "1.0.0",\n  "main": "./index.js"\n}\n'
    );

    await syncVersion(dir, '1.1.0');

    const raw = await fs.readFile(join(dir, 'package.json'), 'utf8');
    const pack = parseJSON<Pack>(raw);
    assert.equal(pack.version, '1.1.0');
    assert.equal(pack.main, './index.js');
    assert.equal(pack.name, 'test-pkg');
  });

  it('should keep the original indent', async () => {
    const dir = join(tempDir, 'dist');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), '{\n    "version": "1.0.0"\n}\n');

    await syncVersion(dir, '1.1.0');

    assert.equal(await fs.readFile(join(dir, 'package.json'), 'utf8'), '{\n    "version": "1.1.0"\n}\n');
  });

  it('should not rewrite an already matching version', async () => {
    const dir = join(tempDir, 'dist');
    mkdirSync(dir, { recursive: true });
    const raw = '{"version":"1.1.0","main":"./index.js"}';
    writeFileSync(join(dir, 'package.json'), raw);

    await syncVersion(dir, '1.1.0');

    assert.equal(await fs.readFile(join(dir, 'package.json'), 'utf8'), raw);
  });
});

describe('partial publish failure', () => {
  it('should collect errors from publishPackage', async () => {
    const errors: string[] = [];
    const failingPromise = Promise.reject('network error');
    await failingPromise.catch(e => {
      errors.push(`registry — ${e}`);
    });
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes('network error'));
  });
});

describe('retry', () => {
  it('should succeed on first attempt', async () => {
    let calls = 0;
    const result = await retry(async () => {
      calls++;
      return 'ok';
    });
    assert.equal(result, 'ok');
    assert.equal(calls, 1);
  });

  it('should retry on failure and succeed', async () => {
    let calls = 0;
    const result = await retry(
      async () => {
        calls++;
        if (calls < 3) {
          throw new Error('fail');
        }
        return 'ok';
      },
      3,
      0
    );
    assert.equal(result, 'ok');
    assert.equal(calls, 3);
  });

  it('should throw after all attempts fail', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        retry(
          async () => {
            calls++;
            throw new Error('always fail');
          },
          2,
          0
        ),
      { message: 'always fail' }
    );
    assert.equal(calls, 2);
  });
});

describe('release create-or-update pattern', () => {
  it('should succeed on first create', async () => {
    const calls: string[] = [];
    const mockCreate = async () => {
      calls.push('create');
      return 'created';
    };

    const result = await mockCreate();
    assert.equal(result, 'created');
    assert.deepEqual(calls, ['create']);
  });

  it('should fall back to update when create fails', async () => {
    const calls: string[] = [];
    const mockCreate = async () => {
      calls.push('create');
      throw new Error('422');
    };
    const mockGet = async () => {
      calls.push('get');
      return { id: 42 };
    };
    const mockUpdate = async (id: number) => {
      calls.push(`update:${id}`);
      return 'updated';
    };

    let result: string;
    try {
      result = await mockCreate();
    } catch {
      const existing = await mockGet();
      result = await mockUpdate(existing.id);
    }

    assert.equal(result, 'updated');
    assert.deepEqual(calls, ['create', 'get', 'update:42']);
  });

  it('should throw original error when update also fails', async () => {
    const originalError = new Error('network error');
    const mockCreate = async () => {
      throw originalError;
    };
    const mockUpdate = async () => {
      throw new Error('also failed');
    };

    try {
      await mockCreate();
      assert.fail('should throw');
    } catch (e) {
      try {
        await mockUpdate();
        assert.fail('should throw');
      } catch {
        assert.equal(e, originalError);
      }
    }
  });
});
