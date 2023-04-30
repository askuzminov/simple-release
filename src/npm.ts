import { inc } from 'semver';

import { log } from './log';
import { getVersion } from './package';
import { ParseConfig } from './types';
import { isText, sp } from './utils';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export async function nextVersion(config: ParseConfig, preid?: string | boolean) {
  const version = `${isText(preid) || preid === true ? 'pre' : ''}${
    config.isMajor ? 'major' : config.isMinor ? 'minor' : 'patch'
  }`;
  log('ok', 'Version', version);
  const params = ['version', version];

  if (typeof preid === 'string') {
    log('ok', 'Version', `preid ${preid}`);
    params.push(`--preid=${preid}`);
  }

  params.push('--no-git-tag-version');

  await sp(npmCmd, params, { stdio: 'inherit' });
}

export async function getNextVersion(config: ParseConfig, preid?: string | boolean): Promise<string> {
  const current = await getVersion();
  const version = `${isText(preid) || preid === true ? 'pre' : ''}${
    config.isMajor ? 'major' : config.isMinor ? 'minor' : 'patch'
  }` as const;

  return inc(current, version, isText(preid) ? preid : preid === true ? 'pre' : undefined) ?? current;
}

export async function publish(registry: string, preid?: string | boolean) {
  log('ok', 'Publish', `Start publish in registry ${registry}`);
  await sp(
    npmCmd,
    ['publish', '--tag', isText(preid) || preid === true ? 'canary' : 'latest', '--registry', registry],
    { stdio: 'inherit' }
  );
}
