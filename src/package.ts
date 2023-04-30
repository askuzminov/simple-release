import { promises as fs } from 'fs';
import { join } from 'path';

import { Pack } from './types';
import { isText } from './utils';

export const getPack = async (file = 'package.json') =>
  JSON.parse(await fs.readFile(join(process.cwd(), file), 'utf8')) as Pack;

export const getVersion = async (): Promise<string> => {
  const v = (await getPack()).version;

  return isText(v) ? v : '0.0.0';
};
