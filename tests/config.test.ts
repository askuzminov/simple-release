import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CHANGELOG_FILE, OTHERS, TITLE, rBreak, rIgnore, rParse, rRepo, whitelist } from '../src/config';

describe('rParse', () => {
  it('should match simple commit', () => {
    const m = rParse.exec('feat: add feature');
    assert.ok(m);
    assert.equal(m[1], 'feat');
    assert.equal(m[2], undefined);
    assert.equal(m[3], undefined);
    assert.equal(m[4], 'add feature');
  });

  it('should match scoped commit', () => {
    const m = rParse.exec('fix(core): bug fix');
    assert.ok(m);
    assert.equal(m[1], 'fix');
    assert.equal(m[2], 'core');
    assert.equal(m[3], undefined);
    assert.equal(m[4], 'bug fix');
  });

  it('should match breaking change with !', () => {
    const m = rParse.exec('feat!: breaking feature');
    assert.ok(m);
    assert.equal(m[1], 'feat');
    assert.equal(m[3], '!');
    assert.equal(m[4], 'breaking feature');
  });

  it('should match scoped breaking change', () => {
    const m = rParse.exec('fix(api)!: breaking fix');
    assert.ok(m);
    assert.equal(m[1], 'fix');
    assert.equal(m[2], 'api');
    assert.equal(m[3], '!');
    assert.equal(m[4], 'breaking fix');
  });

  it('should match scope with special chars', () => {
    const m = rParse.exec('feat(my-scope/sub): description');
    assert.ok(m);
    assert.equal(m[1], 'feat');
    assert.equal(m[2], 'my-scope/sub');
    assert.equal(m[4], 'description');
  });

  it('should not match non-conventional commit', () => {
    assert.equal(rParse.exec('random commit message'), null);
  });

  it('should match empty type with empty string', () => {
    const m = rParse.exec(': no type');
    assert.ok(m);
    assert.equal(m[1], '');
    assert.equal(m[4], 'no type');
  });
});

describe('rBreak', () => {
  it('should match BREAKING CHANGES:', () => {
    assert.ok(rBreak.test('BREAKING CHANGES: something'));
  });

  it('should match BREAKING CHANGE: (singular)', () => {
    assert.ok(rBreak.test('BREAKING CHANGE: something'));
  });

  it('should be case insensitive', () => {
    assert.ok(rBreak.test('breaking changes: something'));
    assert.ok(rBreak.test('Breaking Change: something'));
  });

  it('should not match unrelated text', () => {
    assert.ok(!rBreak.test('no breaking here'));
  });
});

describe('rIgnore', () => {
  it('should match Merge pull request', () => {
    assert.ok(rIgnore.test('Merge pull request #1 from branch'));
  });

  it('should match Merge remote-tracking branch', () => {
    assert.ok(rIgnore.test('Merge remote-tracking branch origin/main'));
  });

  it('should match Merge branch', () => {
    assert.ok(rIgnore.test('Merge branch main'));
  });

  it('should match Automatic merge', () => {
    assert.ok(rIgnore.test('Automatic merge from feature-branch'));
  });

  it('should match Auto-merged', () => {
    assert.ok(rIgnore.test('Auto-merged feature in main'));
  });

  it('should match Merged', () => {
    assert.ok(rIgnore.test('Merged feature into main'));
  });

  it('should match Revert', () => {
    assert.ok(rIgnore.test('Revert "some commit"'));
    assert.ok(rIgnore.test('revert some commit'));
  });

  it('should match fixup', () => {
    assert.ok(rIgnore.test('fixup! feat: something'));
  });

  it('should match squash', () => {
    assert.ok(rIgnore.test('squash! feat: something'));
  });

  it('should not match regular commit', () => {
    assert.ok(!rIgnore.test('feat: new feature'));
    assert.ok(!rIgnore.test('fix: bug fix'));
  });
});

describe('rRepo', () => {
  it('should match github https URL with .git', () => {
    const m = rRepo.exec('https://github.com/user/repo.git');
    assert.ok(m);
    assert.equal(m[1], 'user');
    assert.equal(m[2], 'repo');
  });

  it('should match github https URL without .git', () => {
    const m = rRepo.exec('https://github.com/user/repo');
    assert.ok(m);
    assert.equal(m[1], 'user');
    assert.equal(m[2], 'repo');
  });

  it('should match SSH URL (colon included in user)', () => {
    const m = rRepo.exec('git@github.com:user/repo.git');
    assert.ok(m);
    assert.equal(m[1], 'com:user');
    assert.equal(m[2], 'repo');
  });

  it('should match gitlab URL', () => {
    const m = rRepo.exec('https://gitlab.com/org/project.git');
    assert.ok(m);
    assert.equal(m[1], 'org');
    assert.equal(m[2], 'project');
  });
});

describe('whitelist', () => {
  it('should have all expected commit types', () => {
    const types = [
      'break',
      'feat',
      'build',
      'chore',
      'ci',
      'docs',
      'fix',
      'perf',
      'refactor',
      'revert',
      'style',
      'test',
    ];
    for (const type of types) {
      assert.ok(type in whitelist, `missing type: ${type}`);
      assert.equal(typeof whitelist[type], 'string');
    }
  });

  it('should map break to Breaking changes', () => {
    assert.equal(whitelist.break, 'Breaking changes');
  });

  it('should map feat to Features', () => {
    assert.equal(whitelist.feat, 'Features');
  });

  it('should map fix to Bug Fixes', () => {
    assert.equal(whitelist.fix, 'Bug Fixes');
  });
});

describe('constants', () => {
  it('OTHERS should be defined', () => {
    assert.equal(OTHERS, 'Others changes');
  });

  it('TITLE should contain Changelog header', () => {
    assert.ok(TITLE.startsWith('# Changelog'));
  });

  it('CHANGELOG_FILE should be CHANGELOG.md', () => {
    assert.equal(CHANGELOG_FILE, 'CHANGELOG.md');
  });
});
