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
        log('ok', 'Github', `Run release for ${releaseRepo.user}/${releaseRepo.repository}/`);
        const out = await gitlabRelease({
          domain: CI_SERVER_HOST,
          token: CI_JOB_TOKEN,
          projectID: CI_PROJECT_ID,
          setup: {
            // eslint-disable-next-line camelcase
            tag_name: version,
            name: version + (ARG['enable-prerelease'] ? '-pre' : ''),
            description: md,
          },
        });
        log('ok', 'Github', out);
      } catch (e) {
        log('error', 'Github', e);
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
            // eslint-disable-next-line camelcase
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

export function githubRelease({ token, path, setup }: GithubRelease) {
  return http(
    {
      host: 'api.github.com',
      port: 443,
      path,
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/json',
        'user-agent': 'Github-Releaser',
      },
    },
    setup
  );
}

export function gitlabRelease({ domain, token, projectID, setup }: GitlabRelease) {
  return http(
    {
      host: domain,
      port: 443,
      path: `/api/v4/projects/${projectID}/releases`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PRIVATE-TOKEN': token,
        Accept: 'application/json',
        'user-agent': 'Gitlab-Releaser',
      },
    },
    setup
  );
}
