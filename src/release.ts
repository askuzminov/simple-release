import { request } from 'https';
import { GithubRelease } from './types';

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
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
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
