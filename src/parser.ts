import { OTHERS, rBreak, rParse } from './config';
import { Message, RawLog } from './types';

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
        type: OTHERS,
        content: log.title,
        shortHash: log.short,
        hash: log.hash,
        body: log.body,
        major: false,
      };
}

function prepareBody(body?: string): string {
  return body ? `\n\n  > ${body.trim().split(/\n/).join('\n  > ')}\n` : '';
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
      }${prepareBody(item.body)}`
    );

    isEmpty = false;
  }

  const groups = Object.keys(groupsRaw)
    .sort((a, b) => (a === OTHERS ? 1 : b === OTHERS ? -1 : a > b ? 1 : a < b ? -1 : 0))
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
