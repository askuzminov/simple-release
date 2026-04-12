import { SpawnOptions, spawn } from 'child_process';
import { RequestOptions, request } from 'https';

import { log } from './log';
import {
  CI_PROJECT_NAME,
  CI_PROJECT_NAMESPACE,
  CI_SERVER_URL,
  GITHUB_REPOSITORY,
  GITHUB_SERVER_URL,
  isGITLAB,
  rRepo,
} from './config';
import { Pack, Repo } from './types';

export function getRepo(pack: Pack) {
  return parseRepo(typeof pack.repository === 'object' ? pack.repository?.url : undefined);
}

export function parseRepo(url?: string) {
  const parsed = isText(url) ? rRepo.exec(url) : null;

  return parsed ? { user: parsed[1], repository: parsed[2] } : undefined;
}

export function getURL(repo: Repo): string {
  return isGITLAB
    ? repo
      ? `${CI_SERVER_URL}/${repo.user}/${repo.repository}/-`
      : `${CI_SERVER_URL}/${CI_PROJECT_NAMESPACE}/${CI_PROJECT_NAME}/-`
    : repo
      ? `${GITHUB_SERVER_URL}/${repo.user}/${repo.repository}`
      : `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}`;
}

export function getDate() {
  const date = new Date();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${m}-${d}`;
}

export function sp(command: string, args: string[] = [], options: SpawnOptions = {}) {
  return new Promise<string>((resolve, reject) => {
    const stream = spawn(command, args, options);
    let result = '';
    let error = '';

    stream.stdout?.on('data', (data: Buffer | string) => {
      result += data.toString();
    });

    stream.stderr?.on('data', (data: Buffer | string) => {
      error += data.toString();
    });

    stream.on('error', reject);

    stream.on('exit', code => {
      if (code === null || code === 0) {
        resolve(result.trim());
      } else {
        reject(error);
      }
    });
  });
}

type ArgVal = string | boolean | string[];

export function arg<T extends Record<string, ArgVal>>(def: T): T {
  const ar = process.argv.slice(2);
  const argv: Record<string, ArgVal> = { ...def };

  for (let i = 0; i < ar.length; i++) {
    const item = ar[i];
    const vals = item.split('=');
    const key = vals[0];

    if (vals.length > 1 || typeof argv[key] === 'boolean') {
      const val = vals[1];
      writeVal(key, val);
    } else if (key in argv && i + 1 < ar.length) {
      const val = ar[++i];
      writeVal(key, val);
    }
  }

  function writeVal(key: string, val: ArgVal) {
    const keyItem = argv[key];

    if (Array.isArray(keyItem)) {
      if (isText(val)) {
        keyItem.push(val);
      }
    } else {
      argv[key] = val ?? true;
    }
  }

  return argv as T;
}

export function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

export function parseJSON<T>(content: string): T {
  return JSON.parse(content.charCodeAt(0) === 0xfeff ? content.slice(1) : content) as T;
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

const rVersion = /{VERSION}/g;

export function formatTitle(version: string, title?: string): string {
  return isText(title) ? title.replace(rVersion, version) : `v${version}`;
}

export async function retry<T>(fn: () => Promise<T>, attempts = 3, delay = 5000): Promise<T> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i < attempts) {
        const ms = i * delay;
        log('warn', 'Retry', `Attempt ${i} failed, retrying in ${ms / 1000}s...`);
        await new Promise(r => setTimeout(r, ms));
      } else {
        throw e;
      }
    }
  }
  throw new Error('Unreachable');
}

export function http(options: RequestOptions, body: object) {
  return new Promise((resolve, reject) => {
    const req = request(options, res => {
      res.setEncoding('utf8');

      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        if (isNumber(res.statusCode) && res.statusCode >= 200 && res.statusCode < 400) {
          resolve(data);
        } else {
          reject(data);
        }
      });
    });

    req.on('error', e => {
      reject(e.message);
    });

    req.write(JSON.stringify(body));

    req.end();
  });
}
