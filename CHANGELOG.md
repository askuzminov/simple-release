# Changelog

All notable changes to this project will be documented in this file. See [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit guidelines.

## [v1.3.0](https://github.com/askuzminov/simple-release/compare/v1.2.0...v1.3.0) (2026-04-12)

### Features

- monorepo (#3) ([269b425](https://github.com/askuzminov/simple-release/commit/269b425c14c635123220d441a9ee266cd7501cdf))

  ## What's new
  
  ### Zero dependencies — for real
  
  - Removed `semver` package — implemented own `inc()` + `satisfies()` with 595 cross-validated tests against original
  - Removed `npm version` command — direct file writing for `package.json`, `package-lock.json` (v1/v2/v3), `npm-shrinkwrap.json`
  - Removed `eslint` (8 packages) — migrated to `oxlint` with type-aware linting via `tsgolint`
  - Removed `ts-node` — using `tsx`
  
  ### Workspace / Monorepo support
  
  - Auto-detect workspaces from `package.json` (npm, yarn, bun) and `pnpm-workspace.yaml` (pnpm)
  - Independent versioning — each package bumped based on its own changes
  - Topological sort — dependencies released before dependents
  - Per-package CHANGELOG.md, git tags (`@org/pkg@1.2.0`), GitHub/GitLab releases
  - Single git commit for all version bumps
  - Cross-package dependency cascade with 3 modes:
    - `--cascade full` (default) — always bump + publish dependents
    - `--cascade lazy` — bump only when version range doesn't cover new version
    - `--cascade none` — only release packages with actual code changes
  - Smart range handling: preserves `^`, `~`, exact, `>=` prefixes
  - `workspace:*` / `workspace:^` / `workspace:~` protocol support
  - `--workspace` to select specific packages, `--contents` to publish from subdirectory
  
  ### Bun / pnpm / yarn support
  
  - Auto-detect package manager by lockfile for publish
  - Registry per PM: `--registry` (npm/pnpm/bun), `YARN_REGISTRY` + `YARN_NPM_REGISTRY_SERVER` (yarn)
  - Multiple registries in one run — `publish-github publish-npmjs --publish-custom URL`
  - Lifecycle scripts (`preversion`, `version`, `postversion`) run via shell directly — no dependency on any PM
  - `npm_package_version` env variable available in scripts
  
  ### New features
  
  - `dry-run` — preview what would happen without making changes (shows changed vs skipped packages)
  - `verbose` — detailed output with commits, tags, changelog preview
  - `provenance` — npm provenance attestation support
  - Config in `package.json` — `"simple-release": { "contents": "dist", "cascade": "full" }`
  - GitHub Action — `uses: askuzminov/simple-release@v1`
  - OIDC Trusted Publishing support for npmjs.org (no tokens needed)
  - GitHub App support for protected branch bypass
  
  ### Bug fixes
  
  - `getDate()` now returns `YYYY-MM-DD` (zero-padded) instead of `YYYY-M-D`
  - `sp()` handles ENOENT errors (command not found)
  - GitLab release logs correctly say "Gitlab" instead of "Github"
  - `arg()` no longer reads out of bounds for trailing options
  - `markdown.ts` `last()` safe on empty arrays
  
  ### Robustness
  
  - Git tag already exists — skip instead of crash
  - No commits in repo — fallback to empty tree hash
  - Detached HEAD — warning before git operations
  - Partial publish failure — continue all registries, report failures, exit 1
  - Preversion script modifies package.json — re-read after hook
  - Symlink recursion in workspace discovery — cycle detection via `realpathSync`
  - BOM in package.json — `parseJSON()` strips UTF-8 BOM
  - Windows support — `cmd /c` for lifecycle scripts, `NUL` for empty tree hash
  
  ### CI / Auth
  
  - Updated workflow: `actions/checkout@v4`, `actions/setup-node@v4`, Node 22
  - GitHub App setup guide for protected branches (no service accounts needed)
  - OIDC Trusted Publishing guide for npmjs.org (no token rotation)
  - npm 2FA / passkey documentation
  
  ### Tests
  
  - 906 tests (was 0), 0 lint errors, 0 warnings
  - Unit tests: semver, workspace discovery, topological sort, cascade deps, satisfies, lifecycle scripts, CLI flags, changelog, config parsing, extractPrefix, resolveWorkspace
  - Integration tests: real git repo — getHash, getTag, getCommitsRaw, parseCommits, writeGit, writeWorkspaceGit, detectPackageChanges, checkBranch, sp(), parseJSON, full single-package flow
  - Cross-validated: 595 tests comparing our `inc()` against original `semver` package
  
  ### Documentation
  
  - Complete README rewrite with comparison table, cascade mode guide, decision tree
  - GitHub App setup guide, OIDC Trusted Publishing guide
  - Migration guide from Lerna
  - Edge cases, environment variables, generated CHANGELOG example
  - npm 2FA / passkey / security key documentation


## [v1.2.0](https://github.com/askuzminov/simple-release/compare/v1.1.0...v1.2.0) (2023-4-30)

### Features

- gitlab (#2) ([43cbd60](https://github.com/askuzminov/simple-release/commit/43cbd602cd33e05fd7342810a4200baf6b5940fa))

  * feat: gitlab
  
  * fix: push
  
  * ci: fix
  
  * fix: up
  
  * fix: up
  
  * build: eslint
  
  * fix: gitlab md
  
  * ci: fix
  
  * ci: fix
  
  * ci: fix
  
  * ci: fix
  
  * feat: changes
  
  * feat: current version
  
  * fix: optimize
  
  * docs: fix
  
  * docs: fix
  
  * fix: up
  
  * fix: up
  
  * fix: refactor


## [v1.1.0](https://github.com/askuzminov/simple-release/compare/v1.0.8...v1.1.0) (2021-10-5)

### Continuous Integration

- fix github actions ([46650f8](https://github.com/askuzminov/simple-release/commit/46650f8d45166b5a084254a9fe926b3443481cdf))

### Documentation

- update ([3fbf574](https://github.com/askuzminov/simple-release/commit/3fbf5748bf5bc13f3ad2d20c712c16d463123586))

### Features

- Add filters ([42eeb7a](https://github.com/askuzminov/simple-release/commit/42eeb7a4e79268857798ae2c7b09b2836d2a2401))

  - Filters for:
  
    - git tags
    - files (include/exclude)
  
  - Add custom version template

- add custom source links ([d96d071](https://github.com/askuzminov/simple-release/commit/d96d0719cd5104adc8047cc8653165e5a96b26fa))
- pre version ([3d657c8](https://github.com/askuzminov/simple-release/commit/3d657c8ecd2ba0bc05401badb7d615057ab6d7af))

## [v1.0.8](https://github.com/askuzminov/simple-release/compare/v1.0.7...v1.0.8) (2020-10-6)

### Bug Fixes

- remove quote body ([615260c](https://github.com/askuzminov/simple-release/commit/615260c93f487ff122459243b5ffca6c127dc34f))

## [v1.0.7](https://github.com/askuzminov/simple-release/compare/v1.0.6...v1.0.7) (2020-10-5)

### Bug Fixes

- Sort others groups ([7202221](https://github.com/askuzminov/simple-release/commit/7202221bfb89fe92d1895e540d0eefa67773857d))

## [v1.0.6](https://github.com/askuzminov/simple-release/compare/v1.0.5...v1.0.6) (2020-10-2)

### Bug Fixes

- Add package in git ([063ae26](https://github.com/askuzminov/simple-release/commit/063ae263478846e3d1d947a9ecba0a538eac7185))

## [v1.0.5](https://github.com/askuzminov/simple-release/compare/v1.0.4...v1.0.5) (2020-10-2)

### Documentation

- setup git ([1bc0ac4](https://github.com/askuzminov/simple-release/commit/1bc0ac4276e10e7ae4399c1de1aabfe6abb79321))

  - Github Actions
  - Common example

### Bug Fixes

- Parse body as markdown ([526091c](https://github.com/askuzminov/simple-release/commit/526091c9aaad0b29f1fa77c8da72325832380833))

  - Add [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
  - **Some** _specs_ added...

- Parse repository without extension ([ab3ef81](https://github.com/askuzminov/simple-release/commit/ab3ef8142bb262312a7b63eecd6bf89235a05dc7))
- Git add only changelog.md ([f5a9a41](https://github.com/askuzminov/simple-release/commit/f5a9a4182d7058eee79c05f0dfc33b21434ac492))

### Styles and formatting

- Pretty error message ([5a62e2f](https://github.com/askuzminov/simple-release/commit/5a62e2ff2249377d03d22c1a9ccc596b13cbf733))

## [v1.0.4](https://github.com/askuzminov/simple-release/compare/v1.0.3...v1.0.4) (2020-9-24)

### Bug Fixes

- log for Github release ([8b0aae9](https://github.com/askuzminov/simple-release/commit/8b0aae9c2aa9191609dbbe72ce8aed548c77d415))

## [v1.0.3](https://github.com/askuzminov/simple-release/compare/v1.0.2...v1.0.3) (2020-9-24)

### Bug Fixes

- Add ignore for lint ([8f2722f](https://github.com/askuzminov/simple-release/commit/8f2722ffe6eb67e4bb3e714f4eecd79268191b46))

## [v1.0.2](https://github.com/askuzminov/simple-release/compare/v1.0.1...v1.0.2) (2020-9-22)

### Build system or external dependencies

- update dependencies ([ce7c290](https://github.com/askuzminov/simple-release/commit/ce7c290048341f91a96f7ae4e8e5139d55a72bbe))

### Documentation

- Add scripts info ([a7be287](https://github.com/askuzminov/simple-release/commit/a7be287b17722c3c8f78f719535373dfa89120fb))

### Bug Fixes

- improve work with large git ([d7a5aa5](https://github.com/askuzminov/simple-release/commit/d7a5aa5f705e1fca55234da49342f732d253cc1c))

  - Avoid limit of buffer
  - Rewrite to non blocking code
  - Improve logging

## [v1.0.1](https://github.com/askuzminov/simple-release/compare/v1.0.0...v1.0.1) (2020-9-16)

### Documentation

- improve readme ([e08c0b4](https://github.com/askuzminov/simple-release/commit/e08c0b490fd857a42f0d1be03945722835c98320))

### Bug Fixes

- remove carriage return from git log ([3a462d4](https://github.com/askuzminov/simple-release/commit/3a462d4ec9b08f5cddfa70cd4ef95da2a66be5a8))

  add git log escaping

## [v1.0.0](https://github.com/askuzminov/simple-release/compare/202d59a9598a8395fef5acba73a87a7cf86423c5...v1.0.0) (2020-9-14)

### Features

- Init release ([a0b09e1](https://github.com/askuzminov/simple-release/commit/a0b09e1af5311f7c1e2a84d718a3982be6a70c53))
