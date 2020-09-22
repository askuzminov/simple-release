#!/usr/bin/env node

process.on('unhandledRejection', error => {
  log('error', 'Lint', error);
  process.exit(1);
});

import { ARG } from './arg';
import { getChangelog, writeChangelog } from './changelog';
import { TITLE } from './config';
import { getCommits, getTag, pushGit, writeGit } from './git';
import { log } from './log';
import { makeMD } from './markdown';
import { nextVersion, publish } from './npm';
import { getPack, getVersion } from './package';
import { parse } from './parser';
import { githubRelese } from './release';
import { getDate, getRepo, getURL } from './utils';

const { GH_TOKEN } = process.env;

async function run() {
  const tag = await getTag();
  const date = getDate();
  const commits = await getCommits();
  const pack = await getPack();
  const repo = getRepo(pack);
  const url = getURL(repo);
  const config = parse(commits, url);
  const changelog = await getChangelog(TITLE);

  if (config.isEmpty) {
    log('warn', 'Git', 'No change found in GIT');
  } else {
    await nextVersion(config, ARG.prerelease);
    const version = await getVersion();
    const md = makeMD({ config, version, tag, date, url });

    log('info', 'Version', version);
    log('info', 'Markdown', md);

    if (!ARG.prerelease) {
      if (!ARG['disable-md']) {
        await writeChangelog(`${TITLE}${md}${changelog}`);
      }

      if (!ARG['disable-git']) {
        await writeGit(version);

        if (!ARG['disable-push']) {
          await pushGit();
        }
      }

      if (!ARG['disable-github']) {
        if (!GH_TOKEN) {
          log('warn', 'Github', 'ENV `GH_TOKEN` not found');
        } else if (!repo) {
          log('warn', 'Package', 'No repository.url in package.json');
        } else {
          await githubRelese({
            token: GH_TOKEN,
            path: `/repos/${repo.user}/${repo.repository}/releases`,
            setup: {
              tag_name: version,
              name: version,
              body: md,
              prerelease: false,
            },
          }).catch(e => log('error', 'Github', e));
        }
      }
    }

    if (ARG['publish-github']) {
      await publish('https://npm.pkg.github.com', ARG.prerelease);
    }

    if (ARG['publish-npmjs']) {
      await publish('https://registry.npmjs.org', ARG.prerelease);
    }
  }
}

run();
