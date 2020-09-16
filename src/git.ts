import { RawLog } from './types';
import { ex } from './utils';

const DELIM = '###DELIM%!@^%$###';
const ESCAPE = '###ESCAPE%!@^%$###';

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
  ex(
    `git log ${from}..${to} --pretty=format:'{ "short": ${ESCAPE}%h${ESCAPE}, "hash": ${ESCAPE}%H${ESCAPE}, "title": ${ESCAPE}%s${ESCAPE}, "body": ${ESCAPE}%b${ESCAPE} }${DELIM}'`
  );

const escaper = (str: string) => JSON.stringify(str);

const esc = (str: string) =>
  str
    .trim()
    .split(ESCAPE)
    .map((s, i) => (i % 2 ? escaper(s) : s))
    .join('');

const parse = (str: string) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    // tslint:disable-next-line: no-console
    console.log(str);
    throw e;
  }
};

export const getCommits = () =>
  getCommitsRaw(getTag(), getHash()).split(DELIM).map(esc).filter(Boolean).map(parse) as RawLog[];

export const writeGit = (version: string) => {
  ex('git add .');
  ex(`git commit -m "chore(release): ${version} [skip ci]"`);
  ex(`git tag -a ${version} -m 'Release ${version}'`);
};

export const pushGit = () => {
  ex(`git push`);
  ex(`git push --tags`);
};
