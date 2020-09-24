import { log } from './log';
import { arg } from './utils';

export const ARG = arg<{
  help: boolean;
  prerelease: boolean | string;
  'enable-prerelease': boolean;
  'disable-push': boolean;
  'disable-git': boolean;
  'disable-md': boolean;
  'disable-github': boolean;
  'publish-github': boolean;
  'publish-npmjs': boolean;
}>({
  help: false,
  prerelease: false,
  'enable-prerelease': false,
  'disable-push': false,
  'disable-git': false,
  'disable-md': false,
  'disable-github': false,
  'publish-github': false,
  'publish-npmjs': false,
});

if (ARG.help) {
  log('info', 'Help', 'Commands:');
  log('info', 'Help', 'help -> get command list');
  log('info', 'Help', 'prerelease -> only up version');
  log('info', 'Help', 'prerelease=SOME.NEW.VERSION -> only up version with custom ID');
  log('info', 'Help', 'enable-prerelease -> force full process');
  log('info', 'Help', 'disable-push -> prevent git push');
  log('info', 'Help', 'disable-git -> prevent git commit and tag');
  log('info', 'Help', 'disable-md -> prevent write CHANGELOG.md');
  log('info', 'Help', 'disable-github -> prevent github release');
  log('info', 'Help', 'publish-github -> publish in github registry');
  log('info', 'Help', 'publish-npmjs -> publish in npmjs registry');
  process.exit(0);
}
