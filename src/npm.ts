import { ParseConfig } from './types';
import { ex } from './utils';

export function nextVersion(config: ParseConfig, preid?: string | boolean) {
  return ex(
    `npm version ${
      preid
        ? `prerelease${typeof preid === 'string' ? ` --preid=${preid}` : ''}`
        : config.isMajor
        ? 'major'
        : config.isMinor
        ? 'minor'
        : 'patch'
    } --no-git-tag-version`
  );
}

export function publish(registry: string, preid?: string | boolean) {
  ex(`npm publish --tag ${preid ? 'canary' : 'latest'} --registry ${registry}`);
}
