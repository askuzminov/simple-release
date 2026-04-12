type Release = 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease';

interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: (string | number)[];
}

function parse(version: string): SemVer | undefined {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(version.trim());
  if (m === null) {
    return undefined;
  }
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] !== undefined ? m[4].split('.').map(p => (/^\d+$/.test(p) ? Number(p) : p)) : [],
  };
}

function format(v: SemVer): string {
  const base = `${v.major}.${v.minor}.${v.patch}`;
  return v.prerelease.length > 0 ? `${base}-${v.prerelease.join('.')}` : base;
}

function pre(v: SemVer, identifier?: string): void {
  if (identifier !== undefined) {
    if (v.prerelease.length > 0 && v.prerelease[0] === identifier) {
      if (typeof v.prerelease[1] !== 'number') {
        v.prerelease = [identifier, 0];
      } else {
        v.prerelease = [identifier, v.prerelease[1] + 1];
      }
    } else {
      v.prerelease = [identifier, 0];
    }
  } else if (v.prerelease.length === 0) {
    v.prerelease = [0];
  } else {
    let found = false;
    for (let i = v.prerelease.length - 1; i >= 0; i--) {
      if (typeof v.prerelease[i] === 'number') {
        (v.prerelease[i] as number)++;
        found = true;
        break;
      }
    }
    if (!found) {
      v.prerelease.push(0);
    }
  }
}

export function inc(version: string, release: Release, identifier?: string): string | undefined {
  const v = parse(version);
  if (v === undefined) {
    return undefined;
  }

  switch (release) {
    case 'major':
      if (v.minor !== 0 || v.patch !== 0 || v.prerelease.length === 0) {
        v.major++;
      }
      v.minor = 0;
      v.patch = 0;
      v.prerelease = [];
      break;

    case 'minor':
      if (v.patch !== 0 || v.prerelease.length === 0) {
        v.minor++;
      }
      v.patch = 0;
      v.prerelease = [];
      break;

    case 'patch':
      if (v.prerelease.length === 0) {
        v.patch++;
      }
      v.prerelease = [];
      break;

    case 'premajor':
      v.prerelease = [];
      v.major++;
      v.minor = 0;
      v.patch = 0;
      pre(v, identifier);
      break;

    case 'preminor':
      v.prerelease = [];
      v.minor++;
      v.patch = 0;
      pre(v, identifier);
      break;

    case 'prepatch':
      v.prerelease = [];
      v.patch++;
      pre(v, identifier);
      break;

    case 'prerelease':
      if (v.prerelease.length === 0) {
        v.patch++;
      }
      pre(v, identifier);
      break;

    default:
      return undefined;
  }

  return format(v);
}

function gte(a: SemVer, b: SemVer): boolean {
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch >= b.patch;
}

export function satisfies(version: string, range: string): boolean {
  if (range.startsWith('workspace:')) {
    return true;
  }

  const match = /^([~^>=<]*)(.+)$/.exec(range.trim());
  if (match === null) {
    return false;
  }

  const prefix = match[1];
  const v = parse(version);
  const r = parse(match[2]);
  if (v === undefined || r === undefined) {
    return false;
  }

  if (prefix === '' || prefix === '=') {
    return v.major === r.major && v.minor === r.minor && v.patch === r.patch;
  }

  if (prefix === '>=') {
    return gte(v, r);
  }

  if (prefix === '^') {
    if (r.major === 0) {
      return v.major === 0 && v.minor === r.minor && v.patch >= r.patch;
    }
    return v.major === r.major && gte(v, r);
  }

  if (prefix === '~') {
    return v.major === r.major && v.minor === r.minor && v.patch >= r.patch;
  }

  return false;
}
