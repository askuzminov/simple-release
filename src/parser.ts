import { Message, RawLog } from './types';

export const rParse = /^(\w*)(?:\(([\w$.\-*/ ]*)\))?(!)?: (.*)$/m;
const rBreak = /BREAKING CHANGES?:/i;

export function parseItem(log: RawLog): Message {
  const parsed = rParse.exec(log.title);

  return parsed
    ? {
        type: parsed[1],
        scope: parsed[2],
        content: parsed[4],
        shortHash: log.short,
        hash: log.hash,
        body: log.body,
        major: parsed[3] === '!',
      }
    : {
        type: 'others',
        content: log.title,
        shortHash: log.short,
        hash: log.hash,
        body: log.body,
        major: false,
      };
}

export function parse(commits: RawLog[], url: string) {
  let isMajor = false;
  let isMinor = false;
  let isEmpty = true;
  const groupsRaw: Record<string, string[]> = {};

  for (const commit of commits) {
    const item = parseItem(commit);

    if (item.major || item.type === 'break' || rBreak.test(item.content) || rBreak.test(item.body)) {
      isMajor = true;
    }

    if (item.type === 'feat') {
      isMinor = true;
    }

    (groupsRaw[item.type] ??= []).push(
      `${item.scope ? `**${item.scope}**: ` : ''}${item.content}${
        url ? ` ([${item.shortHash}](${url}/commit/${item.hash}))` : ''
      }${item.body ? `\n\n\`\`\`md\n${item.body}\n\`\`\`\n` : ''}`
    );

    isEmpty = false;
  }

  const groups = Object.keys(groupsRaw)
    .sort()
    .reduce((obj, key) => {
      obj[key] = groupsRaw[key];
      return obj;
    }, {} as Record<string, string[]>);

  return {
    groups,
    isMajor,
    isMinor,
    isEmpty,
  };
}
