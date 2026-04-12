import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getChangelog, writeChangelog } from '../src/changelog';

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await mkdtemp(join(tmpdir(), 'sr-test-'));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe('getChangelog', () => {
  const TITLE = '# Changelog\n';

  it('should return empty string when file does not exist', async () => {
    const result = await getChangelog(TITLE);
    assert.equal(result, '');
  });

  it('should return content without title when file starts with title', async () => {
    const content = `${TITLE}\n## v1.0.0\n- feature`;
    await fs.writeFile(join(tempDir, 'CHANGELOG.md'), content, 'utf8');
    const result = await getChangelog(TITLE);
    assert.equal(result, '\n## v1.0.0\n- feature');
  });

  it('should return full content when file does not start with title', async () => {
    const content = '## v1.0.0\n- feature';
    await fs.writeFile(join(tempDir, 'CHANGELOG.md'), content, 'utf8');
    const result = await getChangelog(TITLE);
    assert.equal(result, content);
  });

  it('should accept custom dir', async () => {
    const subDir = join(tempDir, 'sub');
    await fs.mkdir(subDir, { recursive: true });
    const content = 'custom changelog';
    await fs.writeFile(join(subDir, 'CHANGELOG.md'), content, 'utf8');
    const result = await getChangelog('', subDir);
    assert.equal(result, content);
  });
});

describe('writeChangelog', () => {
  it('should write content to CHANGELOG.md', async () => {
    const content = '# Changelog\n\n## v1.0.0\n- feature\n';
    await writeChangelog(content);
    const written = await fs.readFile(join(tempDir, 'CHANGELOG.md'), 'utf8');
    assert.equal(written, content);
  });

  it('should overwrite existing content', async () => {
    await fs.writeFile(join(tempDir, 'CHANGELOG.md'), 'old content', 'utf8');
    await writeChangelog('new content');
    const written = await fs.readFile(join(tempDir, 'CHANGELOG.md'), 'utf8');
    assert.equal(written, 'new content');
  });

  it('should accept custom dir', async () => {
    const subDir = join(tempDir, 'sub');
    await fs.mkdir(subDir, { recursive: true });
    await writeChangelog('custom content', subDir);
    const written = await fs.readFile(join(subDir, 'CHANGELOG.md'), 'utf8');
    assert.equal(written, 'custom content');
  });
});
