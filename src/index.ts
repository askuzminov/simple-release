#!/usr/bin/env node

process.on('unhandledRejection', error => {
  log('error', 'Error', error);
  process.exit(1);
});

import { ARG } from './arg';
import { getChangelog, writeChangelog } from './changelog';
import { cascadeDeps, detectPackageChanges, PackageChanges } from './changes';
import { TITLE } from './config';
import {
  addChangelog,
  checkBranch,
  getCommitsRaw,
  getHash,
  getTag,
  parseCommits,
  pushGit,
  writeGit,
  writeWorkspaceGit,
} from './git';
import { log } from './log';
import { makeMD } from './markdown';
import { getNextVersion, getVersionType, nextVersion } from './npm';
import { getPack, getVersion, readPackageConfig, runScript, writeVersion } from './package';
import { parse } from './parser';
import { publishPackage } from './publish';
import { release } from './release';
import { inc } from './semver';
import { PackageContext } from './types';
import { formatTitle, getDate, getRepo, getURL, isText, parseRepo } from './utils';
import { discoverWorkspaces } from './workspace';

const DRY = ARG['dry-run'];
const VERBOSE = ARG.verbose;

function output(value: string): void {
  process.stdout.write(process.stdout.isTTY ? `${value}\n` : value);
}

async function run() {
  if (DRY) {
    log('info', 'Dry run', 'No changes will be made');
  }

  if (ARG['--mode'] === 'current-version') {
    output(await getVersion());
    return;
  }

  const pack = await getPack();
  const repo = getRepo(pack);
  const sourceRepo = parseRepo(ARG['--source-repo']) ?? repo;
  const url = getURL(sourceRepo);

  // Read config from package.json "simple-release" field
  applyPackageConfig(pack);

  if (!ARG['disable-git'] && !DRY) {
    await checkBranch();
  }

  if (!ARG['no-workspace']) {
    const workspaces = await discoverWorkspaces(process.cwd());
    if (workspaces !== null) {
      await runWorkspace(workspaces, pack, url);
      return;
    }
  }

  await runSingle(pack, url);
}

function applyPackageConfig(pack: Awaited<ReturnType<typeof getPack>>): void {
  const config = readPackageConfig(pack);
  if (isText(config.contents) && !isText(ARG['--contents'])) {
    ARG['--contents'] = config.contents;
  }
  if (isText(config.cascade) && ARG['--cascade'] === 'full') {
    ARG['--cascade'] = config.cascade as (typeof ARG)['--cascade'];
  }
  if (VERBOSE) {
    log('info', 'Config', `Loaded from package.json: ${JSON.stringify(config)}`);
  }
}

async function runSingle(pack: Awaited<ReturnType<typeof getPack>>, url: string) {
  const tag = await getTag(ARG['--match']);
  const hash = await getHash();
  const date = getDate();
  const rawCommits = await getCommitsRaw(tag, hash, ARG['--file']);
  const commits = parseCommits(rawCommits);
  const repo = getRepo(pack);
  const releaseRepo = parseRepo(ARG['--release-repo']) ?? repo;
  const config = parse(commits, url);

  if (VERBOSE) {
    log('info', 'Git', `Tag: ${tag}, Hash: ${hash.slice(0, 7)}, Commits: ${commits.length}`);
  }

  if (ARG['--mode'] === 'has-changes') {
    output(config.isEmpty ? 'false' : 'true');
    return;
  }

  if (ARG['--mode'] === 'next-version') {
    output(await getNextVersion(config, ARG.prerelease));
    return;
  }

  if (config.isEmpty) {
    log('warn', 'Git', 'No change found in GIT');
  } else {
    if (DRY) {
      const next = await getNextVersion(config, ARG.prerelease);
      const version = formatTitle(next, ARG['--version']);
      const md = makeMD({ config, version, tag, date, url });
      const current = await getVersion();
      log('ok', 'Dry run', `${current} → ${next} (${getVersionType(config, ARG.prerelease)})`);
      if (VERBOSE) {
        log('info', 'Dry run', `Changelog:\n${md}`);
      }
      return;
    }

    await nextVersion(config, ARG.prerelease);
    const version = formatTitle(await getVersion(), ARG['--version']);
    const md = makeMD({ config, version, tag, date, url });
    const errors: string[] = [];
    const pkgName = isText(pack.name) ? (pack.name as string) : 'root';
    const publishCtx: PackageContext = {
      dir: process.cwd(),
      name: pkgName,
      version: '',
      pack,
      tagPrefix: 'v',
      files: [],
    };

    log('ok', 'Version', version);
    if (VERBOSE) {
      log('info', 'Markdown', md);
    }

    if (ARG.prerelease === false || ARG['enable-prerelease']) {
      if (!ARG['disable-md']) {
        const changelog = await getChangelog(TITLE);
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

    await publishPackage(publishCtx, errors);

    await runScript(pack, 'postversion', await getVersion());

    if (errors.length > 0) {
      log('error', 'Publish', `Failed: ${errors.join(', ')}`);
      process.exit(1);
    }
  }
}

async function runWorkspace(packages: PackageContext[], rootPack: Awaited<ReturnType<typeof getPack>>, url: string) {
  const hash = await getHash();
  const date = getDate();
  const repo = getRepo(rootPack);
  const releaseRepo = parseRepo(ARG['--release-repo']) ?? repo;

  const selected = ARG['--workspace'].length > 0 ? packages.filter(p => ARG['--workspace'].includes(p.name)) : packages;

  if (selected.length === 0) {
    log('warn', 'Workspace', 'No packages matched');
    return;
  }

  log('ok', 'Workspace', `Found ${selected.length} package(s): ${selected.map(p => p.name).join(', ')}`);

  const changed: PackageChanges[] = [];
  for (const ctx of selected) {
    const result = await detectPackageChanges(ctx, hash, url);
    if (result !== null) {
      changed.push(result);
    }
  }

  if (ARG['--mode'] === 'has-changes') {
    output(changed.length > 0 ? 'true' : 'false');
    return;
  }

  if (changed.length === 0) {
    log('warn', 'Workspace', 'No changes in any package');
    return;
  }

  if (DRY) {
    await dryRunWorkspace(changed, packages, date, url);
    return;
  }

  const releases = await bumpPackages(changed, date, url);

  if (ARG['--cascade'] !== 'none') {
    await cascadeDeps(packages, releases, ARG['--cascade']);
  }

  if (ARG.prerelease === false || ARG['enable-prerelease']) {
    if (!ARG['disable-git']) {
      await writeWorkspaceGit(releases);

      if (!ARG['disable-push']) {
        await pushGit();
      }
    }

    if (!ARG['disable-github']) {
      for (const r of releases) {
        await release(releaseRepo, `${r.name}@${r.version}`, r.md);
      }
    }
  }

  const publishErrors: string[] = [];
  for (const r of releases) {
    await publishPackage(r.ctx, publishErrors);
    await runScript(r.ctx.pack, 'postversion', r.version, r.ctx.dir);
  }

  if (publishErrors.length > 0) {
    log('error', 'Publish', `Failed: ${publishErrors.join(', ')}`);
    process.exit(1);
  }
}

async function dryRunWorkspace(changed: PackageChanges[], allPackages: PackageContext[], date: string, url: string) {
  const changedNames: Record<string, boolean> = {};
  for (const c of changed) {
    changedNames[c.ctx.name] = true;
  }

  log('info', 'Dry run', '--- Changed packages (will be released) ---');
  for (const { ctx, config, tag } of changed) {
    const preid = ARG.prerelease;
    const current = ctx.version;
    const bump = getVersionType(config, preid);
    const next = inc(current, bump, isText(preid) ? preid : preid === true ? 'pre' : undefined) ?? current;
    const version = formatTitle(next, ARG['--version']);
    const md = makeMD({ config, version, tag, date, url });

    log('ok', ctx.name, `${current} → ${next} (${bump})`);
    if (VERBOSE) {
      log('info', ctx.name, `Changelog:\n${md}`);
    }
  }

  const skipped = allPackages.filter(p => changedNames[p.name] !== true);
  if (skipped.length > 0) {
    log('info', 'Dry run', '--- Unchanged packages (will be skipped) ---');
    for (const pkg of skipped) {
      log('info', pkg.name, `${pkg.version} (no changes)`);
    }
  }

  log('info', 'Dry run', `${changed.length} released, ${skipped.length} skipped, ${allPackages.length} total`);
}

async function bumpPackages(changed: PackageChanges[], date: string, url: string) {
  const releases: { name: string; version: string; ctx: PackageContext; md: string }[] = [];

  for (const { ctx, config, tag } of changed) {
    const preid = ARG.prerelease;
    const current = ctx.version;
    const bump = getVersionType(config, preid);
    const next = inc(current, bump, isText(preid) ? preid : preid === true ? 'pre' : undefined) ?? current;

    log('ok', ctx.name, `${current} → ${next}`);

    await writeVersion(next, ctx.dir);

    const version = formatTitle(next, ARG['--version']);
    const md = makeMD({ config, version, tag, date, url });

    if (!ARG['disable-md']) {
      const changelog = await getChangelog(TITLE, ctx.dir);
      await writeChangelog(`${TITLE}${md}${changelog}`, ctx.dir);
    }

    releases.push({ name: ctx.name, version: next, ctx, md });
  }

  return releases;
}

void run();
