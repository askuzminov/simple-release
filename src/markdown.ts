import { whitelist } from './config';
import { Markdown } from './types';

export function makeMD({ url, config, version, tag, date }: Markdown) {
  let md = `\n## ${url ? `[${version}](${url}/compare/${tag}...${version})` : version} (${date})\n`;

  // tslint:disable-next-line: forin
  for (const group in config.groups) {
    md += `\n### ${whitelist[group] || group}\n\n`;

    for (const item of config.groups[group]) {
      md += `- ${item}\n`;
    }
  }

  return md;
}
