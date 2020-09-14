import { RawLog } from './types';
import { ex } from './utils';

const delim = '###END%!@^%$';

export const fetchAll = () => ex(`git fetch remote --tags`);

export const getHash = () => ex('git rev-parse HEAD');

export const getTag = (): string => {
  try {
    return ex(`git describe --tags --abbrev=0 --first-parent`);
  } catch {
    return ex('git rev-list --max-parents=0 HEAD');
  }
};

export const getCommitsRaw = (from: string, to: string) =>
  ex(`git log ${from}..${to} --pretty=format:'{ "short": "%h", "hash": "%H", "title": "%s", "body": "%b" }${delim}'`);

export const getCommits = () =>
  getCommitsRaw(getTag(), getHash())
    .split(delim)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => JSON.parse(s.replace(/\n/g, '\\n')) as unknown) as RawLog[];

export const writeGit = (version: string) => {
  ex('git add .');
  ex(`git commit -m "chore(release): ${version} [skip ci]"`);
  ex(`git tag -a ${version} -m 'Release ${version}'`);
};

export const pushGit = () => {
  ex(`git push`);
  ex(`git push --tags`);
};
