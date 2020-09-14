import { readFileSync } from 'fs';
import { join } from 'path';
import { Pack } from './types';

export const getPack = (file = 'package.json') => JSON.parse(readFileSync(join(process.cwd(), file), 'utf8')) as Pack;
