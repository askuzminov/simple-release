import { CHANGELOG_FILE } from './config';
import { log } from './log';
import { RawLog } from './types';
import { isText, sp } from './utils';

const DELIM = '###DELIM%!@^%$###';
const ESCAPE = '###ESCAPE%!@^%$###';

export const fetchAll = () => sp('git', ['fetch', 'remote', '--tags']);

export const getHash = () => sp('git', ['rev-parse', 'HEAD']);

export const getTag = async (match?: string): Promise<string> => {
  try {
    return await sp('git', [
      'describe',
      '--tags',
      '--abbrev=0',
      '--first-parent',
      ...(isText(match) ? ['--match'].concat(match) : []),
    ]);
  } catch (e) {
    log('warn', 'Tags', 'Error getting tags', e);
    log('warn', 'Tags', 'Get all history');
    return sp('git', ['rev-list', '--max-parents=0', 'HEAD']);
  }
};

export const getCommitsRaw = (from: string, to: string, files?: string[]) =>
  sp('git', [
    'log',
    `${from}..${to}`,
    // eslint-disable-next-line max-len
    `--pretty=format:{ "short": ${ESCAPE}%h${ESCAPE}, "hash": ${ESCAPE}%H${ESCAPE}, "title": ${ESCAPE}%s${ESCAPE}, "body": ${ESCAPE}%b${ESCAPE} }${DELIM}`,
    ...(files ? ['--'].concat(files) : []),
  ]);

const escaper = (str: string) => JSON.stringify(str);

const esc = (str: string) =>
  str
    .trim()
    .split(ESCAPE)
    .map((s, i) => (i % 2 ? escaper(s) : s))
    .join('');

const parse = (str: string) => {
  try {
    return JSON.parse(str) as unknown;
  } catch (e) {
    log('error', 'Parse commits', str);
    throw e;
  }
};

export const parseCommits = (str: string) => str.split(DELIM).map(esc).filter(Boolean).map(parse).reverse() as RawLog[];

export const addChangelog = async () => {
  log('ok', 'Git', `Add ${CHANGELOG_FILE}`);
  await sp('git', ['add', CHANGELOG_FILE], { stdio: 'inherit' });
};

export const writeGit = async (version: string) => {
  log('ok', 'Git', 'Add package-lock.json');
  await sp('git', ['add', 'package-lock.json'], { stdio: 'inherit' }).catch(() => {
    log('warn', 'Git', 'File "package-lock.json" not found.');
  });

  log('ok', 'Git', 'Add package.json');
  await sp('git', ['add', 'package.json'], { stdio: 'inherit' });

  log('ok', 'Git', `Commit version ${version}`);
  await sp('git', ['commit', '-m', `chore(release): ${version} [skip ci]`], { stdio: 'inherit' });

  log('ok', 'Git', `Tag version ${version}`);
  await sp('git', ['tag', '-a', version, '-m', `Release ${version}`], { stdio: 'inherit' });
};

export const pushGit = async () => {
  log('ok', 'Git', 'Push tags');
  await sp('git', ['push'], { stdio: 'inherit' });
  await sp('git', ['push', '--tags'], { stdio: 'inherit' });
};
