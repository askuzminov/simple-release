import { existsSync } from 'fs';
import { join } from 'path';

import { ARG } from './arg';
import { log } from './log';
import { publish } from './npm';
import { getVersion, syncVersion } from './package';
import { PackageContext } from './types';
import { isText } from './utils';

export function publishTargets(): [string, string][] {
  const registries: [string, string][] = [];

  if (ARG['publish-github']) {
    registries.push(['https://npm.pkg.github.com', 'npm.pkg.github.com']);
  }

  if (ARG['publish-npmjs']) {
    registries.push(['https://registry.npmjs.org', 'registry.npmjs.org']);
  }

  for (const custom of ARG['--publish-custom']) {
    registries.push([custom, custom]);
  }

  return registries;
}

export function publishDir(dir: string): string {
  const contents = ARG['--contents'];

  return isText(contents) ? join(dir, contents) : dir;
}

function checkPublishDir(ctx: PackageContext, dir: string, errors?: string[]): boolean {
  if (existsSync(join(dir, 'package.json'))) {
    return true;
  }

  log('error', 'Publish', `${ctx.name} failed: no package.json in ${dir}`);
  errors?.push(`${ctx.name} → ${dir}`);

  return false;
}

export async function publishPackage(ctx: PackageContext, errors?: string[]): Promise<void> {
  const registries = publishTargets();

  if (registries.length === 0) {
    return;
  }

  const dir = publishDir(ctx.dir);

  if (!checkPublishDir(ctx, dir, errors)) {
    return;
  }

  if (dir !== ctx.dir) {
    await syncVersion(dir, await getVersion(ctx.dir));
  }

  for (const [registry, name] of registries) {
    await publish(registry, ARG.prerelease, dir, ARG.provenance).catch(e => {
      log('error', 'Publish', `${ctx.name} failed: ${name} — ${e}`);
      errors?.push(`${ctx.name} → ${name}`);
    });
  }
}
