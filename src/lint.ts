#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join } from 'path';
import { rIgnore, whitelist } from './config';
import { rParse } from './parser';

// tslint:disable: no-console

const { GIT_PARAMS, HUSKY_GIT_PARAMS } = process.env;

const commit = readFileSync(join(process.cwd(), GIT_PARAMS || HUSKY_GIT_PARAMS || '.git/COMMIT_EDITMSG'), 'utf8');

const parsed = rParse.exec(commit);
const example =
  '<type>: <description> or <type>(scope): <description> or <type>!: <description> or <type>(scope)!: <description>';

function error(text: string): never {
  console.error(text);
  console.error(`Schema of message: ${example}`);
  console.error('Current message:');
  console.error(commit);
  process.exit(1);
}

if (!parsed) {
  if (rIgnore.test(commit)) {
    console.warn('Commit message was ignored: ', commit);
    process.exit(0);
  } else {
    error('Incorrect format of commit message');
  }
}

const [, type] = parsed;

if (!type) {
  error('Type required in commit message');
}

if (!whitelist[type]) {
  error(`Type "${type}" should be one of: ${Object.keys(whitelist).join(', ')}`);
}
