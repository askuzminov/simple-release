import { promises as fs } from 'fs';
import { join } from 'path';

import { CHANGELOG_FILE } from './config';

export async function getChangelog(title: string, dir = process.cwd()) {
  let changelog = '';
  try {
    changelog = await fs.readFile(join(dir, CHANGELOG_FILE), 'utf8');
  } catch {
    //
  }

  if (changelog.startsWith(title)) {
    changelog = changelog.slice(title.length);
  }

  return changelog;
}

export async function writeChangelog(text: string, dir = process.cwd()) {
  await fs.writeFile(join(dir, CHANGELOG_FILE), text, 'utf8');
}
