import { promises as fs } from 'fs';
import { join } from 'path';

import { getCommitsRaw, getTag, parseCommits } from './git';
import { log } from './log';
import { detectIndent, writeVersion } from './package';
import { parse } from './parser';
import { inc, satisfies } from './semver';
import { PackageContext, ParseConfig } from './types';
import { isText } from './utils';

export function resolveWorkspace(ws: string, version: string): string {
  const protocol = ws.slice('workspace:'.length);
  if (protocol === '*') {
    return version;
  }
  if (protocol === '^' || protocol === '~') {
    return `${protocol}${version}`;
  }
  return version;
}

export function extractPrefix(range: string): string {
  const match = /^[~^>=<]*/.exec(range);
  return match !== null ? match[0] : '';
}

export interface PackageChanges {
  ctx: PackageContext;
  config: ParseConfig;
  tag: string;
}

export async function detectPackageChanges(
  ctx: PackageContext,
  hash: string,
  url: string
): Promise<PackageChanges | null> {
  const tag = await getTag(`${ctx.tagPrefix}*`);

  const rawCommits = await getCommitsRaw(tag, hash, ctx.files);
  const commits = parseCommits(rawCommits);
  const config = parse(commits, url);

  if (config.isEmpty) {
    log('info', ctx.name, 'No changes');
    return null;
  }

  log('ok', ctx.name, `Changes detected (${config.isMajor ? 'major' : config.isMinor ? 'minor' : 'patch'})`);
  return { ctx, config, tag };
}

export async function cascadeDeps(
  allPackages: PackageContext[],
  releases: { name: string; version: string; ctx: PackageContext }[],
  mode: 'full' | 'lazy' = 'full'
): Promise<void> {
  const released: Record<string, string> = {};
  for (const r of releases) {
    released[r.name] = r.version;
  }
  const oldVersions: Record<string, string> = {};
  for (const p of allPackages) {
    oldVersions[p.name] = p.version;
  }

  for (const pkg of allPackages) {
    if (pkg.name in released) {
      continue;
    }

    let fileUpdated = false;
    let needsBump = false;

    for (const depType of ['dependencies'] as const) {
      const deps = pkg.pack[depType];
      if (typeof deps !== 'object' || deps === null) {
        continue;
      }
      const depsRecord = deps as Record<string, string>;

      for (const name of Object.keys(released)) {
        const newVersion = released[name];
        const current = depsRecord[name];
        if (!isText(current)) {
          continue;
        }
        const resolved = current.startsWith('workspace:')
          ? resolveWorkspace(current, oldVersions[name] ?? '0.0.0')
          : current;
        if (mode === 'lazy' && satisfies(newVersion, resolved)) {
          log('info', pkg.name, `${depType}["${name}"] ${resolved} covers ${newVersion}, skipping`);
          continue;
        }
        if (current.startsWith('workspace:')) {
          needsBump = true;
          continue;
        }
        const prefix = extractPrefix(current);
        depsRecord[name] = `${prefix}${newVersion}`;
        fileUpdated = true;
        log('ok', pkg.name, `Updated ${depType}["${name}"] → ${prefix}${newVersion}`);
      }
    }

    if (fileUpdated) {
      const pkgPath = join(pkg.dir, 'package.json');
      const raw = await fs.readFile(pkgPath, 'utf8');
      const indent = detectIndent(raw);
      await fs.writeFile(pkgPath, `${JSON.stringify(pkg.pack, undefined, indent)}\n`, 'utf8');
    }

    if (fileUpdated || needsBump) {
      const next = inc(pkg.version, 'patch') ?? pkg.version;
      await writeVersion(next, pkg.dir);
      releases.push({ name: pkg.name, version: next, ctx: pkg });
      released[pkg.name] = next;
      log('ok', pkg.name, `Cascade bump ${pkg.version} → ${next}`);
    }
  }
}
