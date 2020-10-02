import { whitelist } from './config';
import { Markdown } from './types';

const last = (arr: string[]) => arr[arr.length - 1].slice(-1) !== '\n';

export function makeMD({ url, config, version, tag, date }: Markdown) {
  const md = ['', `## ${url ? `[${version}](${url}/compare/${tag}...${version})` : version} (${date})`];

  // tslint:disable-next-line: forin
  for (const group in config.groups) {
    if (last(md)) {
      md.push('');
    }

    md.push(`### ${whitelist[group] || group}`, '');

    for (const item of config.groups[group]) {
      md.push(`- ${item}`);
    }
  }

  md.push('');

  return md.join('\n');
}
