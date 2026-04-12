import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { arg, formatTitle, getDate, getRepo, getURL, isNumber, isText, parseRepo } from '../src/utils';

describe('isText', () => {
  it('should return true for non-empty strings', () => {
    assert.equal(isText('hello'), true);
    assert.equal(isText('0'), true);
    assert.equal(isText(' '), true);
  });

  it('should return false for empty string', () => {
    assert.equal(isText(''), false);
  });

  it('should return false for non-strings', () => {
    assert.equal(isText(undefined), false);
    assert.equal(isText(null), false);
    assert.equal(isText(0), false);
    assert.equal(isText(false), false);
    assert.equal(isText({}), false);
  });
});

describe('isNumber', () => {
  it('should return true for numbers', () => {
    assert.equal(isNumber(0), true);
    assert.equal(isNumber(1), true);
    assert.equal(isNumber(-1), true);
    assert.equal(isNumber(1.5), true);
    assert.equal(isNumber(NaN), true);
  });

  it('should return false for non-numbers', () => {
    assert.equal(isNumber('1'), false);
    assert.equal(isNumber(undefined), false);
    assert.equal(isNumber(null), false);
    assert.equal(isNumber(true), false);
  });
});

describe('formatTitle', () => {
  it('should return v-prefixed version by default', () => {
    assert.equal(formatTitle('1.0.0'), 'v1.0.0');
  });

  it('should return v-prefixed version for undefined title', () => {
    assert.equal(formatTitle('1.0.0', undefined), 'v1.0.0');
  });

  it('should return v-prefixed version for empty string title', () => {
    assert.equal(formatTitle('1.0.0', ''), 'v1.0.0');
  });

  it('should replace {VERSION} in custom title', () => {
    assert.equal(formatTitle('1.0.0', 'v{VERSION}'), 'v1.0.0');
    assert.equal(formatTitle('1.0.0', 'release-{VERSION}'), 'release-1.0.0');
    assert.equal(formatTitle('2.0.0', '{VERSION}-rc'), '2.0.0-rc');
  });

  it('should replace multiple {VERSION} occurrences', () => {
    assert.equal(formatTitle('1.0.0', '{VERSION}+{VERSION}'), '1.0.0+1.0.0');
  });
});

describe('parseRepo', () => {
  it('should parse github https URL', () => {
    assert.deepEqual(parseRepo('https://github.com/user/repo.git'), { user: 'user', repository: 'repo' });
  });

  it('should parse URL without .git', () => {
    assert.deepEqual(parseRepo('https://github.com/user/repo'), { user: 'user', repository: 'repo' });
  });

  it('should parse SSH URL (colon included in user)', () => {
    assert.deepEqual(parseRepo('git@github.com:user/repo.git'), { user: 'com:user', repository: 'repo' });
  });

  it('should return undefined for undefined', () => {
    assert.equal(parseRepo(undefined), undefined);
  });

  it('should return undefined for empty string', () => {
    assert.equal(parseRepo(''), undefined);
  });
});

describe('getRepo', () => {
  it('should extract repo from pack with object repository', () => {
    assert.deepEqual(getRepo({ repository: { url: 'https://github.com/user/repo.git' } }), {
      user: 'user',
      repository: 'repo',
    });
  });

  it('should return undefined for pack without repository', () => {
    assert.equal(getRepo({}), undefined);
  });

  it('should return undefined for string repository', () => {
    assert.equal(getRepo({ repository: 'not-an-object' }), undefined);
  });
});

describe('getURL', () => {
  it('should return github URL with repo', () => {
    const result = getURL({ user: 'myuser', repository: 'myrepo' });
    assert.equal(result, 'https://github.com/myuser/myrepo');
  });

  it('should return github URL without repo (uses env default)', () => {
    const result = getURL(undefined);
    assert.ok(result.startsWith('https://github.com'));
  });
});

describe('getDate', () => {
  it('should return date in YYYY-MM-DD format', () => {
    const date = getDate();
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('should return current UTC date', () => {
    const date = getDate();
    const now = new Date();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    assert.equal(date, `${now.getUTCFullYear()}-${m}-${d}`);
  });
});

describe('arg', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('should return defaults with no args', () => {
    process.argv = ['node', 'script'];
    const result = arg({ flag: false, '--option': '' });
    assert.equal(result.flag, false);
    assert.equal(result['--option'], '');
  });

  it('should parse boolean flag', () => {
    process.argv = ['node', 'script', 'flag'];
    const result = arg({ flag: false });
    assert.equal(result.flag, true);
  });

  it('should parse string option with next arg', () => {
    process.argv = ['node', 'script', '--option', 'value'];
    const result = arg({ '--option': '' });
    assert.equal(result['--option'], 'value');
  });

  it('should parse string option with = syntax', () => {
    process.argv = ['node', 'script', '--option=value'];
    const result = arg({ '--option': '' });
    assert.equal(result['--option'], 'value');
  });

  it('should parse array option', () => {
    process.argv = ['node', 'script', '--items', 'a', '--items', 'b'];
    const result = arg({ '--items': [] as string[] });
    assert.deepEqual(result['--items'], ['a', 'b']);
  });

  it('should parse boolean with =value syntax (prerelease)', () => {
    process.argv = ['node', 'script', 'prerelease=next'];
    const result = arg<{ prerelease: boolean | string }>({ prerelease: false });
    assert.equal(result.prerelease, 'next');
  });

  it('should ignore unknown args', () => {
    process.argv = ['node', 'script', 'unknown', '--other', 'val'];
    const result = arg({ flag: false });
    assert.equal(result.flag, false);
  });

  it('should handle array with = syntax', () => {
    process.argv = ['node', 'script', '--items=a', '--items=b'];
    const result = arg({ '--items': [] as string[] });
    assert.deepEqual(result['--items'], ['a', 'b']);
  });

  it('should ignore string option at end without value', () => {
    process.argv = ['node', 'script', '--option'];
    const result = arg({ '--option': 'default' });
    assert.equal(result['--option'], 'default');
  });

  it('should ignore array option at end without value', () => {
    process.argv = ['node', 'script', '--items'];
    const result = arg({ '--items': [] as string[] });
    assert.deepEqual(result['--items'], []);
  });

  it('should parse string option followed by another option at end', () => {
    process.argv = ['node', 'script', '--option', 'value', '--flag'];
    const result = arg({ '--option': '', '--flag': false });
    assert.equal(result['--option'], 'value');
    assert.equal(result['--flag'], true);
  });

  it('should parse --workspace array', () => {
    process.argv = ['node', 'script', '--workspace', '@org/pkg-a', '--workspace', 'pkg-b'];
    const result = arg({ '--workspace': [] as string[] });
    assert.deepEqual(result['--workspace'], ['@org/pkg-a', 'pkg-b']);
  });

  it('should parse no-workspace boolean', () => {
    process.argv = ['node', 'script', 'no-workspace'];
    const result = arg({ 'no-workspace': false });
    assert.equal(result['no-workspace'], true);
  });

  it('should parse --contents string', () => {
    process.argv = ['node', 'script', '--contents', 'dist'];
    const result = arg({ '--contents': '' });
    assert.equal(result['--contents'], 'dist');
  });

  it('should parse --cascade with = syntax', () => {
    process.argv = ['node', 'script', '--cascade=all'];
    const result = arg({ '--cascade': 'full' });
    assert.equal(result['--cascade'], 'all');
  });

  it('should default --cascade to auto', () => {
    process.argv = ['node', 'script'];
    const result = arg({ '--cascade': 'full' });
    assert.equal(result['--cascade'], 'full');
  });

  it('should parse dry-run flag', () => {
    process.argv = ['node', 'script', 'dry-run'];
    const result = arg({ 'dry-run': false });
    assert.equal(result['dry-run'], true);
  });

  it('should default dry-run to false', () => {
    process.argv = ['node', 'script'];
    const result = arg({ 'dry-run': false });
    assert.equal(result['dry-run'], false);
  });

  it('should parse verbose flag', () => {
    process.argv = ['node', 'script', 'verbose'];
    const result = arg({ verbose: false });
    assert.equal(result.verbose, true);
  });

  it('should default verbose to false', () => {
    process.argv = ['node', 'script'];
    const result = arg({ verbose: false });
    assert.equal(result.verbose, false);
  });
});
