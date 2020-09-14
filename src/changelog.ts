import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export const getChangelog = (title: string, path = 'CHANGELOG.md') => {
  let changelog = '';
  try {
    changelog = readFileSync(join(process.cwd(), path), 'utf8');
  } catch {
    //
  }

  if (changelog.startsWith(title)) {
    changelog = changelog.slice(title.length);
  }

  return changelog;
};

export function writeChangelog(text: string, path = 'CHANGELOG.md') {
  writeFileSync(join(process.cwd(), path), text, 'utf8');
}
