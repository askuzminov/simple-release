import { log } from './log';
import { ParseConfig } from './types';
import { sp } from './utils';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export async function nextVersion(config: ParseConfig, preid?: string | boolean) {
  const version = preid ? 'prerelease' : config.isMajor ? 'major' : config.isMinor ? 'minor' : 'patch';
  log('info', 'Version', version);
  const params = ['version', version];

  if (typeof preid === 'string') {
    log('info', 'Version', `preid ${preid}`);
    params.push(`--preid=${preid}`);
  }

  params.push('--no-git-tag-version');

  await sp(npmCmd, params, { stdio: 'inherit' });
}

export async function publish(registry: string, preid?: string | boolean) {
  log('info', 'Publish', `Start publish in registry ${registry}`);
  await sp(npmCmd, ['publish', '--tag', preid ? 'canary' : 'latest', '--registry', registry], { stdio: 'inherit' });
}
