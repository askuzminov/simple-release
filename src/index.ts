#!/usr/bin/env node

process.on('unhandledRejection', error => {
  log('error', 'Error', error);
  process.exit(1);
});

import { ARG } from './arg';
import { getChangelog, writeChangelog } from './changelog';
import { TITLE } from './config';
import { addChangelog, getCommitsRaw, getHash, getTag, parseCommits, pushGit, writeGit } from './git';
import { log } from './log';
import { makeMD } from './markdown';
import { getNextVersion, nextVersion, publish } from './npm';
import { getPack, getVersion } from './package';
import { parse } from './parser';
import { release } from './release';
import { formatTitle, getDate, getRepo, getURL, parseRepo } from './utils';

async function run() {
  const tag = await getTag(ARG['--match']);
  const hash = await getHash();
  const date = getDate();
  const rawCommits = await getCommitsRaw(tag, hash, ARG['--file']);
  const commits = parseCommits(rawCommits);
  const pack = await getPack();
  const repo = getRepo(pack);
  const sourceRepo = parseRepo(ARG['--source-repo']) ?? repo;
  const releaseRepo = parseRepo(ARG['--release-repo']) ?? repo;
  const url = getURL(sourceRepo);
  const config = parse(commits, url);
  const changelog = await getChangelog(TITLE);

  if (ARG['--mode'] === 'has-changes') {
    process.stdout.write(config.isEmpty ? 'false' : 'true');
    return;
  }

  if (ARG['--mode'] === 'next-version') {
    const next = await getNextVersion(config, ARG.prerelease);
    process.stdout.write(next);
    return;
  }

  if (ARG['--mode'] === 'current-version') {
    const current = await getVersion();
    process.stdout.write(current);
    return;
  }

  if (config.isEmpty) {
    log('warn', 'Git', 'No change found in GIT');
  } else {
    await nextVersion(config, ARG.prerelease);
    const version = formatTitle(await getVersion(), ARG['--version']);
    const md = makeMD({ config, version, tag, date, url });

    log('ok', 'Version', version);
    log('ok', 'Markdown', md);

    if (ARG.prerelease === false || ARG['enable-prerelease']) {
      if (!ARG['disable-md']) {
        await writeChangelog(`${TITLE}${md}${changelog}`);
      }

      if (!ARG['disable-git']) {
        if (!ARG['disable-md']) {
          await addChangelog();
        }

        await writeGit(version);

        if (!ARG['disable-push']) {
          await pushGit();
        }
      }

      if (!ARG['disable-github']) {
        await release(releaseRepo, version, md);
      }
    }

    if (ARG['publish-github']) {
      await publish('https://npm.pkg.github.com', ARG.prerelease);
    }

    if (ARG['publish-npmjs']) {
      await publish('https://registry.npmjs.org', ARG.prerelease);
    }

    for (const customPublish of ARG['--publish-custom']) {
      await publish(customPublish, ARG.prerelease);
    }
  }
}

void run();
