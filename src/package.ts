import { promises as fs } from 'fs';
import { join } from 'path';

import { log } from './log';
import { Pack } from './types';
import { isText, parseJSON, sp } from './utils';

export async function getPack(dir = process.cwd(), file = 'package.json'): Promise<Pack> {
  return parseJSON<Pack>(await fs.readFile(join(dir, file), 'utf8'));
}

export async function getVersion(dir = process.cwd()): Promise<string> {
  const v = (await getPack(dir)).version;

  return isText(v) ? v : '0.0.0';
}

const LOCK_FILES = ['package-lock.json', 'npm-shrinkwrap.json'] as const;

export async function writeVersion(version: string, dir = process.cwd()): Promise<void> {
  const pkgPath = join(dir, 'package.json');
  const raw = await fs.readFile(pkgPath, 'utf8');
  const pkg = parseJSON<Pack>(raw);

  await runScript(pkg, 'preversion', version, dir);

  // Re-read after preversion hook — script may have modified package.json
  const freshRaw = await fs.readFile(pkgPath, 'utf8');
  const freshIndent = detectIndent(freshRaw);
  const freshPkg = parseJSON<Pack>(freshRaw);
  freshPkg.version = version;
  await fs.writeFile(pkgPath, `${JSON.stringify(freshPkg, undefined, freshIndent)}\n`, 'utf8');

  for (const file of LOCK_FILES) {
    await updateLockfile(file, version, dir);
  }

  await runScript(freshPkg, 'version', version, dir);
}

export async function runScript(pack: Pack, name: string, version: string, cwd = process.cwd()): Promise<void> {
  const scripts = typeof pack.scripts === 'object' && pack.scripts !== null ? pack.scripts : {};
  const script = scripts[name];
  if (!isText(script)) {
    return;
  }
  log('ok', 'Version', `Running ${name}: ${script}`);
  const isWin = process.platform === 'win32';
  const env = { ...process.env, npm_package_version: version };
  await sp(isWin ? 'cmd' : 'sh', [isWin ? '/c' : '-c', script], { stdio: 'inherit', env, cwd });
}

async function updateLockfile(file: string, version: string, dir = process.cwd()): Promise<void> {
  const filePath = join(dir, file);
  let raw: string;

  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return;
  }

  const indent = detectIndent(raw);
  const lock = parseJSON<Record<string, unknown>>(raw);

  lock.version = version;

  const packages = lock.packages as Record<string, Record<string, unknown>> | undefined;
  if (typeof packages === 'object' && packages !== null && '' in packages) {
    packages[''].version = version;
  }

  await fs.writeFile(filePath, `${JSON.stringify(lock, undefined, indent)}\n`, 'utf8');
  log('ok', 'Version', `Updated ${file}`);
}

export function detectIndent(content: string): number {
  const match = /^[ ]+/m.exec(content);
  return match !== null ? match[0].length : 2;
}

export function readPackageConfig(pack: Pack): { contents?: string; cascade?: string } {
  const config = pack['simple-release'] as Record<string, unknown> | undefined;
  if (typeof config !== 'object' || config === null) {
    return {};
  }
  return {
    contents: typeof config.contents === 'string' ? config.contents : undefined,
    cascade: typeof config.cascade === 'string' ? config.cascade : undefined,
  };
}
