import { promises as fs } from 'fs';
import { join } from 'path';
import { Pack } from './types';

export const getPack = async (file = 'package.json') =>
  JSON.parse(await fs.readFile(join(process.cwd(), file), 'utf8')) as Pack;

export const getVersion = async () => `v${(await getPack()).version}`;
