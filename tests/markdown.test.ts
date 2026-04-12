import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { makeMD } from '../src/markdown';

function makeConfig(groups: Record<string, string[]>, flags: { isMajor?: boolean; isMinor?: boolean } = {}) {
  return {
    groups,
    isMajor: flags.isMajor ?? false,
    isMinor: flags.isMinor ?? false,
    isEmpty: Object.keys(groups).length === 0,
  };
}

describe('makeMD', () => {
  it('should generate markdown with version link when URL provided', () => {
    const md = makeMD({
      url: 'https://github.com/user/repo',
      config: makeConfig({ feat: ['add feature'] }),
      version: 'v1.0.0',
      tag: 'v0.9.0',
      date: '2024-1-15',
    });
    assert.ok(md.includes('## [v1.0.0](https://github.com/user/repo/compare/v0.9.0...v1.0.0) (2024-1-15)'));
  });

  it('should generate markdown without link when URL is empty', () => {
    const md = makeMD({
      url: '',
      config: makeConfig({ feat: ['add feature'] }),
      version: 'v1.0.0',
      tag: 'v0.9.0',
      date: '2024-1-15',
    });
    assert.ok(md.includes('## v1.0.0 (2024-1-15)'));
  });

  it('should use whitelist title for known types', () => {
    const md = makeMD({
      url: '',
      config: makeConfig({ feat: ['feature'], fix: ['bugfix'] }),
      version: 'v1.0.0',
      tag: 'v0.9.0',
      date: '2024-1-1',
    });
    assert.ok(md.includes('### Features'));
    assert.ok(md.includes('### Bug Fixes'));
  });

  it('should use raw type name for unknown types', () => {
    const md = makeMD({
      url: '',
      config: makeConfig({ custom: ['something'] }),
      version: 'v1.0.0',
      tag: 'v0.9.0',
      date: '2024-1-1',
    });
    assert.ok(md.includes('### custom'));
  });

  it('should list items with dash prefix', () => {
    const md = makeMD({
      url: '',
      config: makeConfig({ feat: ['first feature', 'second feature'] }),
      version: 'v1.0.0',
      tag: 'v0.9.0',
      date: '2024-1-1',
    });
    assert.ok(md.includes('- first feature'));
    assert.ok(md.includes('- second feature'));
  });

  it('should separate groups with blank lines', () => {
    const md = makeMD({
      url: '',
      config: makeConfig({ feat: ['feature'], fix: ['bugfix'] }),
      version: 'v1.0.0',
      tag: 'v0.9.0',
      date: '2024-1-1',
    });
    const lines = md.split('\n');
    const featIdx = lines.findIndex(l => l.includes('### Features'));
    const fixIdx = lines.findIndex(l => l.includes('### Bug Fixes'));
    assert.ok(featIdx < fixIdx);
    assert.ok(lines.slice(featIdx, fixIdx).some(l => l === ''));
  });

  it('should produce complete markdown structure', () => {
    const md: string = makeMD({
      url: 'https://github.com/user/repo',
      config: makeConfig(
        { feat: ['add stuff ([abc](https://github.com/user/repo/commit/abc123))'] },
        { isMinor: true }
      ),
      version: 'v1.1.0',
      tag: 'v1.0.0',
      date: '2024-6-15',
    });
    assert.ok(md.startsWith('\n## '));
    assert.ok(md.endsWith('\n'));
  });

  it('should handle empty groups', () => {
    const md = makeMD({
      url: '',
      config: makeConfig({}),
      version: 'v1.0.0',
      tag: 'v0.9.0',
      date: '2024-01-01',
    });
    assert.ok(md.includes('## v1.0.0'));
    assert.ok(!md.includes('###'));
  });
});
