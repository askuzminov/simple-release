export const TITLE = `# Changelog\n\nAll notable changes to this project will be documented in this file. See [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit guidelines.\n`;

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

export const rIgnore = /^((Merge pull request)|(Merge remote-tracking branch)|(Automatic merge)|((Auto-merged|Merged) (.*?) (in|into) )|(Merge branch)|(R|r)evert|fixup|squash)/;
