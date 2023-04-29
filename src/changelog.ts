import { promises as fs } from 'fs';
import { join } from 'path';

import { CHANGELOG_FILE } from './config';

export async function getChangelog(title: string, path = CHANGELOG_FILE) {
  let changelog = '';
  try {
    changelog = await fs.readFile(join(process.cwd(), path), 'utf8');
  } catch {
    //
  }

  if (changelog.startsWith(title)) {
    changelog = changelog.slice(title.length);
  }

  return changelog;
}

export async function writeChangelog(text: string, path = CHANGELOG_FILE) {
  await fs.writeFile(join(process.cwd(), path), text, 'utf8');
}
