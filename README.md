# Simple release

Full auto pipeline for simple releases your packages.

- Collect git history for auto release
- Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit guidelines
- Generate CHANGELOG.md
- Update package.json, package-lock.json
- Parse body commits, support utf-8 and emoji 🚀
- Commit, tag and push new version
- Upload release on Github
- Upload package on Github
- Upload package on Npmjs.org
- Zero dependencies

## Install

```bash
npm i @askuzminov/simple-release
```

## CLI

package.json

```json
"scripts": {
  "release": "simple-release"
}
```

```bash
npm run release
```

## Commands

- **help** -> get command list
- **prerelease** -> only up version, not git changes and release
- **prerelease=SOME.NEW.VERSION** -> only up version with custom ID
- **enable-prerelease** -> force full process
- **disable-push** -> prevent git push
- **disable-git** -> prevent git commit and tag
- **disable-md** -> prevent write CHANGELOG.md
- **disable-github** -> prevent github release
- **publish-github** -> publish in github registry
- **publish-npmjs** -> publish in npmjs registry

## Lint

Check commit message on:

```json
"husky": {
  "hooks": {
    "commit-msg": "simple-release-lint"
  }
},
```

Schemas of message:

- `<type>: <description>` - simple variant
- `<type>(scope): <description>` - with some scope
- `<type>!: <description>` - breaking change
- `<type>(scope)!: <description>` - breaking change with scope

Example with breaking change:

```bash
refactor(core): Migrate on new solution

BREAKING CHANGES: should upgrade version
Some specs...
```

## Available types

- **break** - `MAJOR` Breaking changes
- **feat** - `MINOR` Features
- **build** - `PATCH` Build system or external dependencies
- **chore** - `PATCH` Chore
- **ci** - `PATCH` Continuous Integration
- **docs** - `PATCH` Documentation
- **fix** - `PATCH` Bug Fixes
- **perf** - `PATCH` Performance
- **refactor** - `PATCH` Refactoring
- **revert** - `PATCH` Revert code
- **style** - `PATCH` Styles and formatting
- **test** - `PATCH` Tests

For `MAJOR` can be used `!` (example `refactor!: new lib`).

For `MAJOR` also can be used `BREAKING CHANGES:` or `BREAKING CHANGE:` in description of commit.

## Ignored commits in lint

- Merge pull request
- Merge remote-tracking branch
- Automatic merge
- Auto-merged ... in ...
- Auto-merged ... into ...
- Merged ... in ...
- Merged ... into ...
- Merge branch
- Revert
- revert
- fixup
- squash

## Scripts

Used standard scripts for <https://docs.npmjs.com/cli/version>.

```json
"scripts": {
  "preversion": "npm test",
  "version": "npm run build",
  "postversion": "npm run clean"
}
```

And when enable publish, used standard scripts for <https://docs.npmjs.com/cli/publish>.

See full list of scripts in <https://docs.npmjs.com/misc/scripts#description>.

## Example CI

```bash
echo "Setup NPM"
echo 'always-auth=true' > ~/.npmrc
echo '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' >> ~/.npmrc
echo '//npm.pkg.github.com/:_authToken=${GH_TOKEN}' >> ~/.npmrc

if [[ $BRANCH_NAME == 'master' ]]; then
  echo "Release production"
  npx @askuzminov/simple-release publish-github publish-npmjs
else
  echo "Release canary"
  npx @askuzminov/simple-release publish-github publish-npmjs prerelease=$BRANCH_NAME.$BUILD_ID
fi
```
