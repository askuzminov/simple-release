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

- **--publish-custom** -> publish in list of customs registries

  ```bash
  simple-release --publish-custom https://your_domain_name/npm/ --publish-custom https://other_domain_name/api/npm
  ```

- **--mode** -> Mode:

  - publish (default);
  - current-version (return current version);
  - next-version (return next version);
  - has-changes (return true | false).

  ```bash
  simple-release --mode publish # Default
  simple-release --mode current-version # Return current npm version
  simple-release --mode next-version # Return next npm version
  simple-release --mode has-changes # Return true | false
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

## Init v1.0.0

Setup package.json

```json
"version": "1.0.0-0",
```

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
  uses: actions/checkout@v3
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

### Setup custom gitlab example

Add in .gitignore

```md
.npmrc
```

Setup package.json

```json
  "scripts": {
    "release": "simple-release"
  },
```

Setup .gitlab-ci.yml

```yml
image: node:18

stages:
  - publish

deploy:
  stage: publish
  only:
    - branches
  variables:
    # Setup group or project access token with role "Maintainer"
    # https://docs.gitlab.com/ee/user/group/settings/group_access_tokens.html
    CI_JOB_TOKEN: $CI_TOKEN
    # Setup strategy for clean history
    GIT_STRATEGY: clone
    # Setup depth for full history
    GIT_DEPTH: 0
  script:
    - |
      # Setup GIT
      git config --local user.email "ci@example.com"
      git config --local user.name "ci"
      # Allow ci to push branch
      git remote set-url origin "https://ci:$CI_JOB_TOKEN@$CI_SERVER_HOST/$CI_PROJECT_NAMESPACE/$CI_PROJECT_NAME.git"
      # Avoid problem with detached branch
      git checkout "$CI_COMMIT_REF_NAME"
    - |
      # Setup .npmrc
      echo "//$CI_SERVER_HOST/api/v4/projects/$CI_PROJECT_ID/packages/npm/:_authToken=$CI_JOB_TOKEN" > .npmrc
      echo "@$CI_PROJECT_NAMESPACE:registry=https://$CI_SERVER_HOST/api/v4/projects/$CI_PROJECT_ID/packages/npm/" >> .npmrc
    - |
      # Prepare your package
      npm ci
      npm run lint
      npm test
    - |
      if [[ $CI_COMMIT_REF_NAME == 'master' ]]; then
        echo "Release production"
        npm run release -- --publish-custom "https://${CI_SERVER_HOST}/api/v4/projects/${CI_PROJECT_ID}/packages/npm/"
      else
        echo "Release canary"
        npm run release -- --publish-custom "https://${CI_SERVER_HOST}/api/v4/projects/${CI_PROJECT_ID}/packages/npm/" prerelease=$CI_COMMIT_REF_SLUG.$CI_JOB_ID
      fi
```
