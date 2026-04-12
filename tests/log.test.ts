import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import { log } from '../src/log';

describe('log', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('should call console.info for ok type', () => {
    const fn = mock.method(console, 'info');
    log('ok', 'Test', 'message');
    assert.equal(fn.mock.callCount(), 1);
    const args = fn.mock.calls[0].arguments;
    assert.ok(String(args[0]).includes('Test:'));
    assert.equal(args[1], 'message');
  });

  it('should call console.error for error type', () => {
    const fn = mock.method(console, 'error');
    log('error', 'Err', 'details');
    assert.equal(fn.mock.callCount(), 1);
    const args = fn.mock.calls[0].arguments;
    assert.ok(String(args[0]).includes('Err:'));
  });

  it('should call console.warn for warn type', () => {
    const fn = mock.method(console, 'warn');
    log('warn', 'Warning', 'info');
    assert.equal(fn.mock.callCount(), 1);
    const args = fn.mock.calls[0].arguments;
    assert.ok(String(args[0]).includes('Warning:'));
  });

  it('should call console.info for info type', () => {
    const fn = mock.method(console, 'info');
    log('info', 'Info', 'data');
    assert.equal(fn.mock.callCount(), 1);
  });

  it('should pass multiple message arguments', () => {
    const fn = mock.method(console, 'info');
    log('ok', 'Multi', 'a', 'b', 'c');
    const args = fn.mock.calls[0].arguments;
    assert.equal(args[1], 'a');
    assert.equal(args[2], 'b');
    assert.equal(args[3], 'c');
  });

  it('should include ANSI color codes', () => {
    const fn = mock.method(console, 'error');
    log('error', 'Red', 'text');
    const args = fn.mock.calls[0].arguments;
    assert.ok(String(args[0]).includes('\x1b[31m'));
    assert.ok(String(args[0]).includes('\x1b[0m'));
  });
});
