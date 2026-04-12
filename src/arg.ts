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
  '--mode': 'publish' | 'current-version' | 'next-version' | 'has-changes';
  '--publish-custom': string[];
  '--match'?: string;
  '--file': string[];
  '--version'?: string;
  '--source-repo'?: string;
  '--release-repo'?: string;
  '--workspace': string[];
  'no-workspace': boolean;
  '--contents'?: string;
  '--cascade': 'full' | 'lazy' | 'none';
  'dry-run': boolean;
  verbose: boolean;
  provenance: boolean;
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
  '--mode': 'publish',
  '--publish-custom': [],
  '--match': undefined,
  '--file': [],
  '--version': undefined,
  '--source-repo': undefined,
  '--release-repo': undefined,
  '--workspace': [],
  'no-workspace': false,
  '--contents': undefined,
  '--cascade': 'full',
  'dry-run': false,
  verbose: false,
  provenance: false,
});

if (ARG.help) {
  log('ok', 'Commands');
  log('info', 'help', 'Get command list');
  log('info', 'prerelease', 'Only up version');
  log('info', 'prerelease=SOME.NEW.VERSION', 'Only up version with custom ID');
  log('info', 'enable-prerelease', 'Force full process');
  log('info', 'disable-push', 'Prevent git push');
  log('info', 'disable-git', 'Prevent git commit and tag');
  log('info', 'disable-md', 'Prevent write CHANGELOG.md');
  log('info', 'disable-github', 'Prevent github release');
  log('info', 'publish-github', 'Publish in github registry');
  log('info', 'publish-npmjs', 'Publish in npmjs registry');
  log(
    'info',
    '--mode',
    `Mode: 
- publish (default);
- current-version (return current version);
- next-version (return next version);
- has-changes (return true | false).`
  );
  log('info', '--publish-custom', 'Publish in any custom registry');
  log('info', '--match', "Match only needed tags, for example: --match 'v[0-9]*'");
  log('info', '--file', "Filter files for include/exclude, for example: --file=src --file=types --file ':!dist'");
  log('info', '--version', 'Custom format for version, for example: --version v{VERSION}');
  log('info', '--source-repo', 'Custom path to links for sourcecode: --source-repo myorg/somepackage');
  log('info', '--release-repo', 'Custom path to links for release notes: --release-repo myorg/somepackage');
  log('info', '--workspace', 'Select specific packages in monorepo: --workspace @org/pkg1 --workspace pkg2');
  log('info', 'no-workspace', 'Force single-package mode even in monorepo');
  log('info', '--contents', 'Publish from subdirectory: --contents dist');
  log('info', '--cascade', 'Cross-package deps: auto (default), lazy, none');
  log('info', 'dry-run', 'Show what would happen without making changes');
  log('info', 'verbose', 'Show detailed output');
  log('info', 'provenance', 'Generate provenance attestation when publishing (npm/npmjs.org)');
  process.exit(0);
}
