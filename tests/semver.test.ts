import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { inc as semverInc } from 'semver';

import { inc, satisfies } from '../src/semver';

describe('inc', () => {
  describe('invalid input', () => {
    it('should return null for invalid version', () => {
      assert.equal(inc('not-a-version', 'major'), undefined);
    });

    it('should return null for empty string', () => {
      assert.equal(inc('', 'major'), undefined);
    });
  });

  describe('major', () => {
    it('should bump major', () => {
      assert.equal(inc('1.2.3', 'major'), '2.0.0');
    });

    it('should bump major from 0.x', () => {
      assert.equal(inc('0.5.0', 'major'), '1.0.0');
    });

    it('should drop prerelease and bump major when minor or patch non-zero', () => {
      assert.equal(inc('1.2.3-beta.1', 'major'), '2.0.0');
    });

    it('should drop prerelease without bump when already at major boundary', () => {
      assert.equal(inc('1.0.0-5', 'major'), '1.0.0');
    });

    it('should drop prerelease without bump when at major boundary with identifier', () => {
      assert.equal(inc('2.0.0-beta.3', 'major'), '2.0.0');
    });
  });

  describe('minor', () => {
    it('should bump minor', () => {
      assert.equal(inc('1.2.3', 'minor'), '1.3.0');
    });

    it('should bump minor when patch is zero', () => {
      assert.equal(inc('1.2.0', 'minor'), '1.3.0');
    });

    it('should drop prerelease and bump minor when patch non-zero', () => {
      assert.equal(inc('1.2.1-alpha.0', 'minor'), '1.3.0');
    });

    it('should drop prerelease without bump when already at minor boundary', () => {
      assert.equal(inc('1.2.0-5', 'minor'), '1.2.0');
    });
  });

  describe('patch', () => {
    it('should bump patch', () => {
      assert.equal(inc('1.2.3', 'patch'), '1.2.4');
    });

    it('should drop prerelease without bump', () => {
      assert.equal(inc('1.2.3-0', 'patch'), '1.2.3');
    });

    it('should drop named prerelease without bump', () => {
      assert.equal(inc('1.2.3-beta.1', 'patch'), '1.2.3');
    });
  });

  describe('premajor', () => {
    it('should bump premajor without identifier', () => {
      assert.equal(inc('1.2.3', 'premajor'), '2.0.0-0');
    });

    it('should bump premajor with identifier', () => {
      assert.equal(inc('1.2.3', 'premajor', 'beta'), '2.0.0-beta.0');
    });

    it('should bump premajor from prerelease', () => {
      assert.equal(inc('1.0.0-beta.1', 'premajor', 'beta'), '2.0.0-beta.0');
    });
  });

  describe('preminor', () => {
    it('should bump preminor without identifier', () => {
      assert.equal(inc('1.2.3', 'preminor'), '1.3.0-0');
    });

    it('should bump preminor with identifier', () => {
      assert.equal(inc('1.2.3', 'preminor', 'beta'), '1.3.0-beta.0');
    });

    it('should bump preminor from prerelease', () => {
      assert.equal(inc('1.2.3-beta.1', 'preminor', 'alpha'), '1.3.0-alpha.0');
    });
  });

  describe('prepatch', () => {
    it('should bump prepatch without identifier', () => {
      assert.equal(inc('1.2.3', 'prepatch'), '1.2.4-0');
    });

    it('should bump prepatch with identifier', () => {
      assert.equal(inc('1.2.3', 'prepatch', 'beta'), '1.2.4-beta.0');
    });

    it('should bump prepatch from prerelease', () => {
      assert.equal(inc('1.2.3-beta.1', 'prepatch'), '1.2.4-0');
    });
  });

  describe('prerelease', () => {
    it('should bump patch and add prerelease when no prerelease exists', () => {
      assert.equal(inc('1.2.3', 'prerelease'), '1.2.4-0');
    });

    it('should bump patch and add identifier when no prerelease exists', () => {
      assert.equal(inc('1.2.3', 'prerelease', 'beta'), '1.2.4-beta.0');
    });

    it('should increment numeric prerelease', () => {
      assert.equal(inc('1.2.3-0', 'prerelease'), '1.2.3-1');
    });

    it('should increment named prerelease counter', () => {
      assert.equal(inc('1.2.3-beta.0', 'prerelease', 'beta'), '1.2.3-beta.1');
    });

    it('should reset prerelease when identifier changes', () => {
      assert.equal(inc('1.2.3-alpha.0', 'prerelease', 'beta'), '1.2.3-beta.0');
    });

    it('should reset prerelease when identifier has non-numeric second part', () => {
      assert.equal(inc('1.2.3-beta.foo', 'prerelease', 'beta'), '1.2.3-beta.0');
    });

    it('should increment last numeric in prerelease without identifier', () => {
      assert.equal(inc('1.2.3-beta.1', 'prerelease'), '1.2.3-beta.2');
    });

    it('should append 0 when no numeric in prerelease and no identifier', () => {
      assert.equal(inc('1.2.3-beta', 'prerelease'), '1.2.3-beta.0');
    });
  });

  describe('v prefix', () => {
    it('should handle v prefix', () => {
      assert.equal(inc('v1.2.3', 'patch'), '1.2.4');
    });

    it('should handle v prefix with prerelease', () => {
      assert.equal(inc('v1.0.0-rc.1', 'prerelease', 'rc'), '1.0.0-rc.2');
    });
  });

  describe('whitespace', () => {
    it('should handle leading/trailing whitespace', () => {
      assert.equal(inc('  1.2.3  ', 'minor'), '1.3.0');
    });
  });
});

describe('inc matches semver package', () => {
  const versions = [
    '0.0.0',
    '0.0.1',
    '0.1.0',
    '1.0.0',
    '1.2.3',
    '1.0.0-0',
    '1.0.0-5',
    '1.2.0-5',
    '1.2.3-0',
    '1.2.3-1',
    '1.2.3-beta',
    '1.2.3-beta.0',
    '1.2.3-beta.1',
    '1.2.3-beta.foo',
    '1.2.3-alpha.0',
    '2.0.0-beta.3',
    '0.5.0',
  ];

  const releases = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'] as const;

  const identifiers = [undefined, 'beta', 'alpha', 'rc', 'pre'];

  for (const version of versions) {
    for (const release of releases) {
      for (const identifier of identifiers) {
        const label = `inc('${version}', '${release}'${identifier !== undefined ? `, '${identifier}'` : ''})`;
        it(label, () => {
          const ours = inc(version, release, identifier) ?? null;
          const original =
            identifier !== undefined ? semverInc(version, release, identifier) : semverInc(version, release);
          assert.equal(ours, original, label);
        });
      }
    }
  }
});

describe('satisfies', () => {
  describe('caret ^', () => {
    it('should satisfy minor bump', () => {
      assert.equal(satisfies('1.1.0', '^1.0.0'), true);
    });

    it('should satisfy patch bump', () => {
      assert.equal(satisfies('1.0.1', '^1.0.0'), true);
    });

    it('should not satisfy major bump', () => {
      assert.equal(satisfies('2.0.0', '^1.0.0'), false);
    });

    it('should not satisfy lower version', () => {
      assert.equal(satisfies('0.9.0', '^1.0.0'), false);
    });

    it('should handle ^0.x (minor is major)', () => {
      assert.equal(satisfies('0.1.1', '^0.1.0'), true);
      assert.equal(satisfies('0.2.0', '^0.1.0'), false);
    });
  });

  describe('tilde ~', () => {
    it('should satisfy patch bump', () => {
      assert.equal(satisfies('1.0.1', '~1.0.0'), true);
    });

    it('should not satisfy minor bump', () => {
      assert.equal(satisfies('1.1.0', '~1.0.0'), false);
    });

    it('should not satisfy major bump', () => {
      assert.equal(satisfies('2.0.0', '~1.0.0'), false);
    });
  });

  describe('exact', () => {
    it('should satisfy exact match', () => {
      assert.equal(satisfies('1.0.0', '1.0.0'), true);
    });

    it('should not satisfy different version', () => {
      assert.equal(satisfies('1.0.1', '1.0.0'), false);
    });
  });

  describe('>=', () => {
    it('should satisfy higher version', () => {
      assert.equal(satisfies('2.0.0', '>=1.0.0'), true);
    });

    it('should satisfy equal version', () => {
      assert.equal(satisfies('1.0.0', '>=1.0.0'), true);
    });

    it('should not satisfy lower version', () => {
      assert.equal(satisfies('0.9.0', '>=1.0.0'), false);
    });
  });

  describe('workspace', () => {
    it('should always satisfy workspace:*', () => {
      assert.equal(satisfies('99.0.0', 'workspace:*'), true);
    });

    it('should always satisfy workspace:^', () => {
      assert.equal(satisfies('99.0.0', 'workspace:^1.0.0'), true);
    });
  });

  describe('invalid', () => {
    it('should return false for invalid version', () => {
      assert.equal(satisfies('not-a-version', '^1.0.0'), false);
    });

    it('should return false for invalid range', () => {
      assert.equal(satisfies('1.0.0', 'not-a-range'), false);
    });
  });
});
