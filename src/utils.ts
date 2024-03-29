import { SpawnOptions, spawn } from 'child_process';
import { RequestOptions, request } from 'https';

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
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
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
    } else if (key in argv) {
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

export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

const rVersion = /{VERSION}/g;

export function formatTitle(version: string, title?: string): string {
  return isText(title) ? title.replace(rVersion, version) : `v${version}`;
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
