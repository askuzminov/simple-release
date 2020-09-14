import { execSync } from 'child_process';
import { Pack, Repo } from './types';

const rRepo = /([^/.]+)[/.]+([^/.]+)[/.]+[^/.]+$/;

export function getRepo(pack: Pack) {
  const parsed = rRepo.exec((typeof pack.repository === 'object' && pack.repository?.url) || '');

  return parsed ? { user: parsed[1], repository: parsed[2] } : undefined;
}

export function getURL(repo: Repo): string {
  return repo ? `https://github.com/${repo.user}/${repo.repository}` : '';
}

export function getDate() {
  const date = new Date();
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
}

export const ex = (cmd: string) => execSync(cmd, { encoding: 'utf8' }).trim();

export function arg<T extends Record<string, string | boolean>>(def: T): T {
  const ar = process.argv.slice(2);
  const argv: Record<string, string | boolean> = { ...def };

  for (const item of ar) {
    const [key, val] = item.split('=');

    argv[key] = val ?? true;
  }

  return argv as T;
}
