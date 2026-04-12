import { existsSync } from 'fs';
import { join } from 'path';

import { log } from './log';
import { getVersion, writeVersion } from './package';
import { inc } from './semver';
import { ParseConfig } from './types';
import { isText, retry, sp } from './utils';

export async function nextVersion(config: ParseConfig, preid?: string | boolean) {
  const next = await getNextVersion(config, preid);
  log('ok', 'Version', next);
  await writeVersion(next);
}

export async function getNextVersion(config: ParseConfig, preid?: string | boolean): Promise<string> {
  const current = await getVersion();
  const version = getVersionType(config, preid);

  return inc(current, version, isText(preid) ? preid : preid === true ? 'pre' : undefined) ?? current;
}

export function getVersionType(config: ParseConfig, preid?: string | boolean) {
  return `${isText(preid) || preid === true ? 'pre' : ''}${
    config.isMajor ? 'major' : config.isMinor ? 'minor' : 'patch'
  }` as const;
}

function cmd(name: string): string {
  return process.platform === 'win32' && name !== 'bun' ? `${name}.cmd` : name;
}

export function detectPM(): string {
  const cwd = process.cwd();
  if (existsSync(join(cwd, 'package-lock.json')) || existsSync(join(cwd, 'npm-shrinkwrap.json'))) {
    return cmd('npm');
  }
  if (existsSync(join(cwd, 'bun.lock')) || existsSync(join(cwd, 'bun.lockb'))) {
    return cmd('bun');
  }
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) {
    return cmd('pnpm');
  }
  if (existsSync(join(cwd, 'yarn.lock'))) {
    return cmd('yarn');
  }
  return cmd('npm');
}

export async function publish(registry: string, preid?: string | boolean, cwd?: string, provenance?: boolean) {
  const pm = detectPM();
  const pmName = pm.replace(/\.cmd$/, '');
  log('ok', 'Publish', `Start publish via ${pmName} to ${registry}`);
  const tag = isText(preid) || preid === true ? 'canary' : 'latest';
  const args = ['publish', '--tag', tag];

  if (provenance === true) {
    args.push('--provenance');
  }

  const env = { ...process.env };

  switch (pmName) {
    case 'npm':
    case 'pnpm':
    case 'bun':
      args.push('--registry', registry);
      break;
    case 'yarn':
      env.YARN_REGISTRY = registry;
      env.YARN_NPM_REGISTRY_SERVER = registry;
      break;
    default:
      args.push('--registry', registry);
      break;
  }

  await retry(() => sp(pm, args, { stdio: 'inherit', cwd, env }));
}
