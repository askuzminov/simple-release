import { existsSync, promises as fs, readdirSync, realpathSync } from 'fs';
import { join, resolve } from 'path';

import { Pack, PackageContext } from './types';
import { isText, parseJSON } from './utils';

export async function discoverWorkspaces(rootDir: string): Promise<PackageContext[] | null> {
  const globs = await getWorkspaceGlobs(rootDir);
  if (globs === null) {
    return null;
  }

  const dirs = resolveGlobs(rootDir, globs);
  const contexts: PackageContext[] = [];

  for (const dir of dirs) {
    const pkgPath = join(dir, 'package.json');
    if (!existsSync(pkgPath)) {
      continue;
    }

    const pack = parseJSON<Pack>(await fs.readFile(pkgPath, 'utf8'));
    const name = isText(pack.name) ? pack.name : '';
    const version = isText(pack.version) ? pack.version : '0.0.0';

    if (!isText(name)) {
      continue;
    }

    contexts.push({
      dir,
      name,
      version,
      pack,
      tagPrefix: `${name}@`,
      files: [dir],
    });
  }

  return contexts.length > 0 ? topoSort(contexts) : null;
}

export function topoSort(packages: PackageContext[]): PackageContext[] {
  const byName: Record<string, PackageContext> = {};
  for (const p of packages) {
    byName[p.name] = p;
  }
  const visited: Record<string, boolean> = {};
  const sorted: PackageContext[] = [];

  function visit(pkg: PackageContext): void {
    if (visited[pkg.name] === true) {
      return;
    }
    visited[pkg.name] = true;

    for (const depType of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
      const deps = pkg.pack[depType];
      if (typeof deps !== 'object' || deps === null) {
        continue;
      }
      for (const name of Object.keys(deps as Record<string, unknown>)) {
        const dep = byName[name];
        if (dep !== undefined) {
          visit(dep);
        }
      }
    }

    sorted.push(pkg);
  }

  for (const pkg of packages) {
    visit(pkg);
  }

  return sorted;
}

async function getWorkspaceGlobs(rootDir: string): Promise<string[] | null> {
  const pkgPath = join(rootDir, 'package.json');
  if (existsSync(pkgPath)) {
    const raw = await fs.readFile(pkgPath, 'utf8');
    const pkg = parseJSON<Record<string, unknown>>(raw);
    const ws = pkg.workspaces;

    if (Array.isArray(ws)) {
      return ws.filter((g): g is string => typeof g === 'string');
    }

    if (typeof ws === 'object' && ws !== null && 'packages' in ws) {
      const packages = (ws as Record<string, unknown>).packages;
      if (Array.isArray(packages)) {
        return packages.filter((g): g is string => typeof g === 'string');
      }
    }
  }

  const pnpmPath = join(rootDir, 'pnpm-workspace.yaml');
  if (existsSync(pnpmPath)) {
    const raw = await fs.readFile(pnpmPath, 'utf8');
    return parsePnpmWorkspace(raw);
  }

  return null;
}

export function parsePnpmWorkspace(content: string): string[] {
  const result: string[] = [];
  let inPackages = false;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (trimmed === 'packages:') {
      inPackages = true;
      continue;
    }

    if (inPackages) {
      if (trimmed.startsWith('- ')) {
        const value = trimmed.slice(2).replace(/^['"]|['"]$/g, '');
        if (isText(value)) {
          result.push(value);
        }
      } else if (trimmed !== '' && !trimmed.startsWith('#')) {
        break;
      }
    }
  }

  return result;
}

export function resolveGlobs(rootDir: string, globs: string[]): string[] {
  const dirs: string[] = [];

  for (const glob of globs) {
    if (glob.includes('**')) {
      resolveDeep(rootDir, glob, dirs);
    } else if (glob.includes('*')) {
      const parts = glob.split('*');
      const prefix = parts[0];
      const parentDir = resolve(rootDir, prefix);
      if (!existsSync(parentDir)) {
        continue;
      }
      for (const entry of readdirSync(parentDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          dirs.push(join(parentDir, entry.name));
        }
      }
    } else {
      const dir = resolve(rootDir, glob);
      if (existsSync(dir)) {
        dirs.push(dir);
      }
    }
  }

  return dirs.filter((d, i) => dirs.indexOf(d) === i).sort();
}

function resolveDeep(rootDir: string, glob: string, dirs: string[]): void {
  const parts = glob.split('**');
  const prefix = parts[0];
  const startDir = resolve(rootDir, prefix);
  if (!existsSync(startDir)) {
    return;
  }
  walkDirs(startDir, dirs);
}

function walkDirs(dir: string, dirs: string[], seen: Record<string, boolean> = {}): void {
  let real: string;
  try {
    real = realpathSync(dir);
  } catch {
    return;
  }
  if (seen[real] === true) {
    return;
  }
  seen[real] = true;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
      const child = join(dir, entry.name);
      dirs.push(child);
      walkDirs(child, dirs, seen);
    }
  }
}
