#!/usr/bin/env node

// tslint:disable: no-console

import { getChangelog, writeChangelog } from './changelog';
import { TITLE } from './config';
import { getCommits, getTag, pushGit, writeGit } from './git';
import { makeMD } from './markdown';
import { nextVersion, publish } from './npm';
import { getPack } from './package';
import { parse } from './parser';
import { githubRelese } from './release';
import { arg, getDate, getRepo, getURL } from './utils';

process.on('unhandledRejection', error => {
  console.error(error);
  process.exit(1);
});

const { GH_TOKEN } = process.env;

const ARG = arg<{
  help: boolean;
  prerelease: boolean | string;
  'disable-push': boolean;
  'disable-git': boolean;
  'disable-md': boolean;
  'disable-github': boolean;
  'publish-github': boolean;
  'publish-npmjs': boolean;
}>({
  help: false,
  prerelease: false,
  'disable-push': false,
  'disable-git': false,
  'disable-md': false,
  'disable-github': false,
  'publish-github': false,
  'publish-npmjs': false,
});

if (ARG.help) {
  console.log('Commands:');
  console.log('help -> get command list');
  console.log('prerelease -> only up version');
  console.log('prerelease=SOME.NEW.VERSION -> only up version with custom ID');
  console.log('disable-push -> prevent git push');
  console.log('disable-git -> prevent git commit and tag');
  console.log('disable-md -> prevent write CHANGELOG.md');
  console.log('disable-github -> prevent github release');
  console.log('publish-github -> publish in github registry');
  console.log('publish-npmjs -> publish in npmjs registry');
  process.exit(0);
}

async function run() {
  const tag = getTag();
  const date = getDate();
  const commits = getCommits();
  const pack = getPack();
  const repo = getRepo(pack);
  const url = getURL(repo);
  const config = parse(commits, url);
  const changelog = getChangelog(TITLE);

  if (config.isEmpty) {
    console.log('No change found in GIT');
  } else {
    const version = nextVersion(config, ARG.prerelease);
    const md = makeMD({ config, version, tag, date, url });

    console.log(version);
    console.log(md);

    if (!ARG.prerelease) {
      if (!ARG['disable-md']) {
        writeChangelog(`${TITLE}${md}${changelog}`);
      }

      if (!ARG['disable-git']) {
        writeGit(version);

        if (!ARG['disable-push']) {
          pushGit();
        }
      }

      if (!ARG['disable-github']) {
        if (!GH_TOKEN) {
          console.warn('ENV `GH_TOKEN` not found');
        } else if (!repo) {
          console.warn('No repository in package.json');
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
          }).catch(console.log);
        }
      }
    }

    if (ARG['publish-github']) {
      publish('https://npm.pkg.github.com', ARG.prerelease);
    }

    if (ARG['publish-npmjs']) {
      publish('https://registry.npmjs.org', ARG.prerelease);
    }
  }
}

run();
