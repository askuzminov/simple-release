# Simple release

Full auto pipeline for simple releases your packages.

- Collect git history for auto release
- Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit guidelines
- Generate CHANGELOG.md
- Update package.json, package-lock.json
- Parse body commits as Markdown, support utf-8 and emoji 🚀
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

  ```bash
  simple-release help
  ```

- **prerelease** -> only up version, not git changes and release

  ```bash
  simple-release prerelease
  ```

- **prerelease=SOME.NEW.VERSION** -> only up version with custom ID

  ```bash
  simple-release prerelease=1.2.0
  ```

- **enable-prerelease** -> force full process

  ```bash
  simple-release enable-prerelease
  ```

- **disable-push** -> prevent git push

  ```bash
  simple-release disable-push
  ```

- **disable-git** -> prevent git commit and tag

  ```bash
  simple-release disable-git
  ```

- **disable-md** -> prevent write CHANGELOG.md

  ```bash
  simple-release disable-md
  ```

- **disable-github** -> prevent github release

  ```bash
  simple-release disable-github
  ```

- **publish-github** -> publish in github registry

  ```bash
  simple-release publish-github
  ```

- **publish-npmjs** -> publish in npmjs registry

  ```bash
  simple-release publish-npmjs
  ```

- **--match** -> Match only needed tags in git history

  Using [glob(7)](https://man7.org/linux/man-pages/man7/glob.7.html)

  ```bash
  simple-release --match 'v[0-9]*'
  simple-release --match='v[0-9]*'
  ```

- **--file** -> Filter files for include/exclude

  By default, all files are included except those described in `.gitignore`

  Include:

  - folder
  - folder/file
  - folder/\*.css

  Exclude:

  - :!folder
  - :!folder/\*file
  - :(exclude)folder
  - :(exclude,icase)SUB

  ```bash
  simple-release --file src --file types --file 'folder/*.css' --file ':!dist'
  simple-release --file=src --file=types --file='folder/*.css' --file=':!dist'
  ```

- **--version** -> Custom format for version, default `v{VERSION}`

  ```bash
  simple-release --version v{VERSION}
  simple-release --version=v{VERSION}
  simple-release --version @my-org/my-lib@{VERSION}
  ```

- **--source-repo** -> Custom path to links for sourcecode

  Default from `package.json`: `repository.url`

  ```bash
  simple-release --source-repo myorg/somepackage
  simple-release --source-repo https://github.com/askuzminov/simple-release
  simple-release --source-repo https://github.com/askuzminov/simple-release.git
  ```

- **--release-repo** -> Custom path to links for release notes

  Default from `package.json`: `repository.url`

  ```bash
  simple-release --release-repo myorg/somepackage
  simple-release --release-repo https://github.com/askuzminov/simple-release
  simple-release --release-repo https://github.com/askuzminov/simple-release.git
  ```

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

Example with body

```bash
feat(ABC-123): New solution

- Add [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- **Some** *specs* added...
```

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

### Github actions

Use fetch-depth for full

```yml
- name: Checkout
  uses: actions/checkout@v2
  with: { fetch-depth: 0 }
```

### Setup GIT example

Setup branch for push

```bash
git config --global push.default current
git config --local user.email "bot@ci.com"
git config --local user.name "CI"
mkdir -p ~/.ssh
ssh-keyscan github.com > ~/.ssh/known_hosts
```
