import { CHANGELOG_FILE } from './config';
import { log } from './log';
import { RawLog } from './types';
import { isText, sp } from './utils';

const DELIM = '###DELIM%!@^%$###';
const ESCAPE = '###ESCAPE%!@^%$###';

export const getHash = () => sp('git', ['rev-parse', 'HEAD']);

export async function checkBranch(): Promise<void> {
  try {
    await sp('git', ['symbolic-ref', 'HEAD']);
  } catch {
    log('warn', 'Git', 'Detached HEAD detected. Git commit/push may fail. Checkout a branch first.');
  }
}

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
    try {
      return await sp('git', ['rev-list', '--max-parents=0', 'HEAD']);
    } catch {
      log('warn', 'Tags', 'No commits found, using empty tree');
      const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null';
      return sp('git', ['hash-object', '-t', 'tree', nullDevice]);
    }
  }
};

export const getCommitsRaw = (from: string, to: string, files?: string[]) =>
  sp('git', [
    'log',
    `${from}..${to}`,
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

  await createTag(version);
};

async function createTag(tag: string): Promise<void> {
  const exists = await sp('git', ['tag', '-l', tag]).then(out => out !== '');
  if (exists) {
    log('warn', 'Git', `Tag ${tag} already exists, skipping`);
    return;
  }
  log('ok', 'Git', `Tag ${tag}`);
  await sp('git', ['tag', '-a', tag, '-m', `Release ${tag}`], { stdio: 'inherit' });
}

export const pushGit = async () => {
  log('ok', 'Git', 'Push tags');
  await sp('git', ['push'], { stdio: 'inherit' });
  await sp('git', ['push', '--tags'], { stdio: 'inherit' });
};

export async function writeWorkspaceGit(releases: { name: string; version: string }[]): Promise<void> {
  await sp('git', ['add', '-A'], { stdio: 'inherit' });

  const lines = releases.map(r => `- ${r.name}@${r.version}`).join('\n');
  const msg = `chore(release): publish [skip ci]\n\n${lines}`;
  log('ok', 'Git', `Commit workspace release`);
  await sp('git', ['commit', '-m', msg], { stdio: 'inherit' });

  for (const r of releases) {
    await createTag(`${r.name}@${r.version}`);
  }
}
