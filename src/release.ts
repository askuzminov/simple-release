import { request } from 'https';

import { ARG } from './arg';
import { CI_JOB_TOKEN, CI_PROJECT_ID, CI_SERVER_HOST, GH_TOKEN } from './config';
import { log } from './log';
import { GithubRelease, GitlabRelease } from './types';
import { isNumber, isText } from './utils';

const isGITLAB = isText(CI_JOB_TOKEN) && !isText(GH_TOKEN);

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
        const out = await githubRelese({
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

export function githubRelese({ token, path, setup }: GithubRelease) {
  return new Promise((resolve, reject) => {
    const req = request(
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
      res => {
        res.setEncoding('utf8');

        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          if (isNumber(res.statusCode) && res.statusCode >= 200 && res.statusCode < 400) {
            resolve(data);
          } else {
            reject(data);
          }
        });
      }
    );

    req.on('error', e => {
      reject(e.message);
    });

    req.write(JSON.stringify(setup));

    req.end();
  });
}

export function gitlabRelease({ domain, token, projectID, setup }: GitlabRelease) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: domain,
        port: 443,
        path: `/api/v4/projects/${projectID}/releases`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PRIVATE-TOKEN': token,
          Accept: 'application/json',
          'user-agent': 'Github-Releaser',
        },
      },
      res => {
        res.setEncoding('utf8');

        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          if (isNumber(res.statusCode) && res.statusCode >= 200 && res.statusCode < 400) {
            resolve(data);
          } else {
            reject(data);
          }
        });
      }
    );

    req.on('error', e => {
      reject(e.message);
    });

    req.write(JSON.stringify(setup));

    req.end();
  });
}
