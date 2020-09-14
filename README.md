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

## Commands

- **help** -> get command list
- **prerelease** -> only up version, not git changes and release
- **prerelease=SOME.NEW.VERSION** -> only up version with custom ID
- **disable-push** -> prevent git push
- **disable-git** -> prevent git commit and tag
- **disable-md** -> prevent write CHANGELOG.md
- **disable-github** -> prevent github release
- **publish-github** -> publish in github registry
- **publish-npmjs** -> publish in npmjs registry

## Lint

Check commit message on

```json
"husky": {
  "hooks": {
    "commit-msg": "simple-release-lint"
  }
},
```

Schema of message:

```bash
<type>: <description>
```

or

```bash
<type>(scope): <description>
```

or

```bash
<type>!: <description>
```

or

```bash
<type>(scope)!: <description>
```

## Available types

- break - MAJOR
- feat - MINOR
- build - PATCH
- chore - PATCH
- ci - PATCH
- docs - PATCH
- fix - PATCH
- perf - PATCH
- refactor - PATCH
- revert - PATCH
- style - PATCH
- test - PATCH

For MAJOR can be used `!` (example `refactor!: new lib`).

For MAJOR also can be used `BREAKING CHANGES:` or `BREAKING CHANGE:` in description of commit.

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
