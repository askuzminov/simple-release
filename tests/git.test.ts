import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseCommits } from '../src/git';

const DELIM = '###DELIM%!@^%$###';
const ESCAPE = '###ESCAPE%!@^%$###';

function wrap(value: string): string {
  return `${ESCAPE}${value}${ESCAPE}`;
}

function makeRawCommit(short: string, hash: string, title: string, body: string): string {
  return `{ "short": ${wrap(short)}, "hash": ${wrap(hash)}, "title": ${wrap(title)}, "body": ${wrap(body)} }`;
}

describe('parseCommits', () => {
  it('should parse single commit', () => {
    const raw = makeRawCommit('abc1234', 'abc1234567890', 'feat: add feature', '') + DELIM;
    const result = parseCommits(raw);
    assert.equal(result.length, 1);
    assert.equal(result[0].short, 'abc1234');
    assert.equal(result[0].hash, 'abc1234567890');
    assert.equal(result[0].title, 'feat: add feature');
    assert.equal(result[0].body, '');
  });

  it('should parse multiple commits and reverse order', () => {
    const raw =
      makeRawCommit('aaa', 'aaa111', 'feat: first', '') +
      DELIM +
      makeRawCommit('bbb', 'bbb222', 'fix: second', '') +
      DELIM;
    const result = parseCommits(raw);
    assert.equal(result.length, 2);
    assert.equal(result[0].title, 'fix: second');
    assert.equal(result[1].title, 'feat: first');
  });

  it('should handle commit body', () => {
    const raw = makeRawCommit('abc', 'abcfull', 'feat: thing', 'some body text') + DELIM;
    const result = parseCommits(raw);
    assert.equal(result[0].body, 'some body text');
  });

  it('should handle special characters in title', () => {
    const raw = makeRawCommit('abc', 'abcfull', 'fix: handle "quoted" and \\backslash', '') + DELIM;
    const result = parseCommits(raw);
    assert.equal(result[0].title, 'fix: handle "quoted" and \\backslash');
  });

  it('should return empty array for empty input', () => {
    const result = parseCommits('');
    assert.equal(result.length, 0);
  });

  it('should handle multiline body', () => {
    const raw = makeRawCommit('abc', 'abcfull', 'feat: thing', 'line1\nline2\nline3') + DELIM;
    const result = parseCommits(raw);
    assert.equal(result[0].body, 'line1\nline2\nline3');
  });
});
