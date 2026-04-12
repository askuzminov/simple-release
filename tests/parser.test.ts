import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { OTHERS } from '../src/config';
import { parse, parseItem } from '../src/parser';
import { RawLog } from '../src/types';

function makeLog(title: string, body = ''): RawLog {
  return { short: 'abc1234', hash: 'abc1234567890abcdef', title, body };
}

describe('parseItem', () => {
  it('should parse standard conventional commit', () => {
    const result = parseItem(makeLog('feat: add new feature'));
    assert.equal(result.type, 'feat');
    assert.equal(result.scope, undefined);
    assert.equal(result.content, 'add new feature');
    assert.equal(result.major, false);
    assert.equal(result.shortHash, 'abc1234');
    assert.equal(result.hash, 'abc1234567890abcdef');
  });

  it('should parse scoped commit', () => {
    const result = parseItem(makeLog('fix(core): fix bug'));
    assert.equal(result.type, 'fix');
    assert.equal(result.scope, 'core');
    assert.equal(result.content, 'fix bug');
    assert.equal(result.major, false);
  });

  it('should parse breaking change with !', () => {
    const result = parseItem(makeLog('feat!: breaking feature'));
    assert.equal(result.type, 'feat');
    assert.equal(result.major, true);
    assert.equal(result.content, 'breaking feature');
  });

  it('should parse scoped breaking change with !', () => {
    const result = parseItem(makeLog('fix(api)!: breaking fix'));
    assert.equal(result.type, 'fix');
    assert.equal(result.scope, 'api');
    assert.equal(result.major, true);
  });

  it('should parse non-conventional commit as OTHERS', () => {
    const result = parseItem(makeLog('random text'));
    assert.equal(result.type, OTHERS);
    assert.equal(result.content, 'random text');
    assert.equal(result.major, false);
  });

  it('should preserve body', () => {
    const result = parseItem(makeLog('feat: add feature', 'Some details'));
    assert.equal(result.body, 'Some details');
  });
});

describe('parse', () => {
  const URL = 'https://github.com/user/repo';

  it('should return isEmpty for empty commits', () => {
    const result = parse([], URL);
    assert.equal(result.isEmpty, true);
    assert.equal(result.isMajor, false);
    assert.equal(result.isMinor, false);
    assert.deepEqual(result.groups, {});
  });

  it('should detect minor (feat) commits', () => {
    const result = parse([makeLog('feat: new feature')], URL);
    assert.equal(result.isEmpty, false);
    assert.equal(result.isMinor, true);
    assert.equal(result.isMajor, false);
    assert.ok('feat' in result.groups);
    assert.equal(result.groups.feat.length, 1);
  });

  it('should detect major via ! marker', () => {
    const result = parse([makeLog('feat!: breaking')], URL);
    assert.equal(result.isMajor, true);
  });

  it('should detect major via break type', () => {
    const result = parse([makeLog('break: removed API')], URL);
    assert.equal(result.isMajor, true);
    assert.ok('break' in result.groups);
  });

  it('should detect major via BREAKING CHANGES in content', () => {
    const result = parse([makeLog('chore: BREAKING CHANGE: removed feature')], URL);
    assert.equal(result.isMajor, true);
  });

  it('should detect major via BREAKING CHANGES in body', () => {
    const result = parse([makeLog('feat: new api', 'BREAKING CHANGES: old api removed')], URL);
    assert.equal(result.isMajor, true);
  });

  it('should include commit hash link when URL provided', () => {
    const result = parse([makeLog('fix: bug')], URL);
    const item = result.groups.fix[0];
    assert.ok(item.includes('[abc1234]'));
    assert.ok(item.includes(`${URL}/commit/abc1234567890abcdef`));
  });

  it('should not include link when URL is empty', () => {
    const result = parse([makeLog('fix: bug')], '');
    const item = result.groups.fix[0];
    assert.ok(!item.includes('[abc1234]'));
  });

  it('should include scope in output', () => {
    const result = parse([makeLog('fix(core): bug')], URL);
    const item = result.groups.fix[0];
    assert.ok(item.startsWith('**core**: bug'));
  });

  it('should include body indented', () => {
    const result = parse([makeLog('fix: bug', 'line1\nline2')], URL);
    const item = result.groups.fix[0];
    assert.ok(item.includes('\n\n  line1\n  line2\n'));
  });

  it('should group commits by type', () => {
    const commits = [makeLog('feat: feature'), makeLog('fix: bugfix'), makeLog('feat: another feature')];
    const result = parse(commits, URL);
    assert.equal(result.groups.feat.length, 2);
    assert.equal(result.groups.fix.length, 1);
  });

  it('should sort groups alphabetically with OTHERS last', () => {
    const commits = [makeLog('random text'), makeLog('fix: bug'), makeLog('feat: feature')];
    const result = parse(commits, URL);
    const keys = Object.keys(result.groups);
    assert.equal(keys[0], 'feat');
    assert.equal(keys[1], 'fix');
    assert.equal(keys[2], OTHERS);
  });

  it('should handle patch-only commits (no feat, no break)', () => {
    const result = parse([makeLog('fix: bugfix'), makeLog('docs: update readme')], URL);
    assert.equal(result.isMajor, false);
    assert.equal(result.isMinor, false);
    assert.equal(result.isEmpty, false);
  });
});
