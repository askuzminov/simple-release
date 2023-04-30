export const {
  CI_JOB_ID,
  GH_TOKEN,
  CI_JOB_TOKEN,
  CI_SERVER_HOST,
  CI_PROJECT_ID,
  CI_SERVER_URL = '',
  CI_PROJECT_NAMESPACE = '',
  CI_PROJECT_NAME = '',
  GITHUB_SERVER_URL = 'https://github.com',
  GITHUB_REPOSITORY = '',
} = process.env;

export const isGITLAB = typeof CI_JOB_ID === 'string' && CI_JOB_ID !== '';

export const TITLE =
  // eslint-disable-next-line max-len
  '# Changelog\n\nAll notable changes to this project will be documented in this file. See [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit guidelines.\n';

export const CHANGELOG_FILE = 'CHANGELOG.md';

export const whitelist: Record<string, string> = {
  break: 'Breaking changes',
  feat: 'Features',
  build: 'Build system or external dependencies',
  chore: 'Chore',
  ci: 'Continuous Integration',
  docs: 'Documentation',
  fix: 'Bug Fixes',
  perf: 'Performance',
  refactor: 'Refactoring',
  revert: 'Revert code',
  style: 'Styles and formatting',
  test: 'Tests',
};

export const OTHERS = 'Others changes';

export const rIgnore =
  // eslint-disable-next-line max-len
  /^((Merge pull request)|(Merge remote-tracking branch)|(Automatic merge)|((Auto-merged|Merged) (.*?) (in|into) )|(Merge branch)|(R|r)evert|fixup|squash)/;

export const rRepo = /([^/.]+)[/.]+([^/.]+)(?:\.[^/.]+)?$/;

export const rParse = /^(\w*)(?:\(([\w$.\-*/ ]*)\))?(!)?: (.*)$/m;

export const rBreak = /BREAKING CHANGES?:/i;
