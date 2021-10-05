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
import { nextVersion, publish } from './npm';
import { getPack, getVersion } from './package';
import { parse } from './parser';
import { githubRelese } from './release';
import { formatTitle, getDate, getRepo, getURL, parseRepo } from './utils';

const { GH_TOKEN } = process.env;

async function run() {
  const tag = await getTag(ARG['--match']);
  const hash = await getHash();
  const date = getDate();
  const rawCommits = await getCommitsRaw(tag, hash, ARG['--file']);
  const commits = await parseCommits(rawCommits);
  const pack = await getPack();
  const repo = getRepo(pack);
  const sourceRepo = parseRepo(ARG['--source-repo']) ?? repo;
  const releaseRepo = parseRepo(ARG['--release-repo']) ?? repo;
  const url = getURL(sourceRepo);
  const config = parse(commits, url);
  const changelog = await getChangelog(TITLE);

  if (config.isEmpty) {
    log('warn', 'Git', 'No change found in GIT');
  } else {
    await nextVersion(config, ARG.prerelease);
    const version = formatTitle(await getVersion(), ARG['--version']);
    const md = makeMD({ config, version, tag, date, url });

    log('ok', 'Version', version);
    log('ok', 'Markdown', md);

    if (!ARG.prerelease || ARG['enable-prerelease']) {
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
        if (!GH_TOKEN) {
          log('warn', 'Github', 'ENV `GH_TOKEN` not found');
        } else if (!releaseRepo) {
          log('warn', 'Package', 'No repository.url in package.json');
        } else {
          try {
            log('ok', 'Github', `Run release for ${releaseRepo.user}/${releaseRepo.repository}/`);
            const out = await githubRelese({
              token: GH_TOKEN,
              path: `/repos/${releaseRepo.user}/${releaseRepo.repository}/releases`,
              setup: {
                tag_name: version,
                name: version,
                body: md,
                prerelease: ARG['enable-prerelease'],
              },
            });
            log('ok', 'Github', out);
          } catch (e) {
            log('error', 'Github', e);
          }
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
