import { ARG } from './arg';
import { CI_JOB_TOKEN, CI_PROJECT_ID, CI_SERVER_HOST, GH_TOKEN, isGITLAB } from './config';
import { log } from './log';
import { GithubRelease, GitlabRelease } from './types';
import { http, isText } from './utils';

export async function release(
  releaseRepo: { user: string; repository: string } | undefined,
  version: string,
  md: string
) {
  if (isGITLAB) {
    if (!isText(CI_JOB_TOKEN)) {
      log('warn', 'Gitlab', 'ENV `CI_JOB_TOKEN` not found');
    } else if (!isText(CI_SERVER_HOST)) {
      log('warn', 'Gitlab', 'ENV `CI_SERVER_HOST` not found');
    } else if (!isText(CI_PROJECT_ID)) {
      log('warn', 'Gitlab', 'ENV `CI_PROJECT_ID` not found');
    } else if (!releaseRepo) {
      log('warn', 'Package', 'No repository.url in package.json');
    } else {
      try {
        log('ok', 'Gitlab', `Run release for ${releaseRepo.user}/${releaseRepo.repository}/`);
        const out = await gitlabRelease({
          domain: CI_SERVER_HOST,
          token: CI_JOB_TOKEN,
          projectID: CI_PROJECT_ID,
          setup: {
            tag_name: version,
            name: version + (ARG['enable-prerelease'] ? '-pre' : ''),
            description: md,
          },
        });
        log('ok', 'Gitlab', out);
      } catch (e) {
        log('error', 'Gitlab', e);
      }
    }
  } else {
    if (!isText(GH_TOKEN)) {
      log('warn', 'Github', 'ENV `GH_TOKEN` not found');
    } else if (!releaseRepo) {
      log('warn', 'Package', 'No repository.url in package.json');
    } else {
      try {
        log('ok', 'Github', `Run release for ${releaseRepo.user}/${releaseRepo.repository}/`);
        const out = await githubRelease({
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

const ghHeaders = (token: string) => ({
  Authorization: `token ${token}`,
  Accept: 'application/json',
  'user-agent': 'Github-Releaser',
});

export async function githubRelease({ token, path, setup }: GithubRelease) {
  try {
    return await http({ host: 'api.github.com', port: 443, path, method: 'POST', headers: ghHeaders(token) }, setup);
  } catch (e) {
    // Release may already exist — try to update
    const tagPath = `${path}/tags/${encodeURIComponent(setup.tag_name)}`;
    try {
      const existing = await http(
        { host: 'api.github.com', port: 443, path: tagPath, method: 'GET', headers: ghHeaders(token) },
        {}
      );
      const id = (JSON.parse(String(existing)) as { id: number }).id;
      log('info', 'Github', `Release exists, updating ${setup.tag_name}`);
      return await http(
        { host: 'api.github.com', port: 443, path: `${path}/${id}`, method: 'PATCH', headers: ghHeaders(token) },
        setup
      );
    } catch {
      throw e;
    }
  }
}

export async function gitlabRelease({ domain, token, projectID, setup }: GitlabRelease) {
  const glHeaders = {
    'Content-Type': 'application/json',
    'PRIVATE-TOKEN': token,
    Accept: 'application/json',
    'user-agent': 'Gitlab-Releaser',
  };
  const path = `/api/v4/projects/${projectID}/releases`;

  try {
    return await http({ host: domain, port: 443, path, method: 'POST', headers: glHeaders }, setup);
  } catch (e) {
    // Release may already exist — try to update
    const tagPath = `${path}/${encodeURIComponent(setup.tag_name)}`;
    try {
      log('info', 'Gitlab', `Release exists, updating ${setup.tag_name}`);
      return await http({ host: domain, port: 443, path: tagPath, method: 'PUT', headers: glHeaders }, setup);
    } catch {
      throw e;
    }
  }
}
