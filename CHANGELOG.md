# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file is not edited by hand. Every change writes its own fragment under
`.changes/unreleased/` with [chlog](https://github.com/luizjhonata/chlog), and a release compiles
the pending fragments into a version section here — so two branches each adding an entry no
longer touch the same lines, and a rebase that used to conflict on this file now conflicts on
nothing.

When a new release is proposed:

1. Create a new branch `bump/x.x.x` (this isn't a long-lived branch!!!);
2. The fragments pending under `.changes/unreleased/` are compiled into a version section by `chlog batch auto && chlog merge` (AutoBump does this for you — it reads the fragments directly);
3. Open a Pull Request with the bump version changes targeting the `main` branch;
4. When the Pull Request is merged, a new Git tag must be created using [GitHub environment](https://github.com/rios0rios0/scaled/tags).

Releases to productive environments should run from a tagged version.
Exceptions are acceptable depending on the circumstances (critical bug fixes that can be cherry-picked, etc.).

## [Unreleased]

## [0.4.1] - 2026-09-06

### Security

- closed the two remaining Dependabot alerts that its grouped `npm_and_yarn` security update could not fix by itself -- both packages are transitive, so the updater bailed with `NoChangeError` rather than touch a manifest it had no entry for. `serialize-javascript` carried GHSA-qj8w-gfj5-8c6v (CPU-exhaustion denial of service via crafted array-like objects, fixed in 7.0.5) and reaches the tree through `mocha`, which asks for `^6.0.2`; the `resolutions` floor that already overrides that request moved from `^7.0.3` to `^7.0.5`, which resolves to 7.1.1. `uuid` carried GHSA-w5hq-g745-h8pq (missing buffer bounds check in v3/v5/v6 when `buf` is provided, patched only in 11.1.1) and reached the tree solely through `nyc@14`, which imports it as `require('uuid/v4')` -- a deep path uuid removed in v7, so a `resolutions` entry forcing 11.1.1 would have left the coverage runner unable to load. `nyc` moved to 18.0.0 instead, which dropped the `uuid` dependency outright and takes the package out of the tree entirely. No advisory was suppressed and no direct dependency was upgraded beyond the one that pinned the vulnerable version.

## [0.4.0] - 2026-08-28

### Added

- added the Claude automated code review and `@claude` mention responder workflows, `claude-review.yaml` and `claude-mention.yaml`, matching the `reusable-claude-review.yaml` / `reusable-claude-mention.yaml` definitions they call in `rios0rios0/pipelines`, authenticating with the `CLAUDE_CODE_OAUTH_TOKEN` secret

### Fixed

- restored the `.changes/unreleased/` directory with a `.gitkeep`, so the release tooling keeps recognising this project as [chlog](https://github.com/luizjhonata/chlog)-based after a release consumes the last fragment. Git tracks files rather than directories, so the bump commit that removed the final fragment removed the directory too, and the next run read the empty `[Unreleased]` section as "nothing to release"
- restored the `id-token: write` permission on both Claude workflow callers. Without it the caller grants less than the reusable workflow declares, which GitHub rejects before the job starts -- runs ended in `startup_failure`. The action needs the scope because `setupGitHubToken()` exchanges a GitHub OIDC token for the GitHub App token it posts with, unless a `github_token` is passed explicitly.

### Removed

- removed the unused `id-token: write` permission from the Claude workflow callers, and changed `claude-review.yaml`'s display name to `Claude Review` so it matches its file name and its `Claude Mention` sibling. `anthropics/claude-code-action` needs `id-token: write` only for workload identity federation or the Bedrock / Vertex / Foundry OIDC paths; these authenticate with `claude_code_oauth_token`, so the scope allowed minting OIDC tokens for any audience without ever being used.

## [0.3.0] - 2026-08-26

### Added

- added a tailored `code-review` skill under `.github/skills/` so GitHub Copilot reviews changes against the [rios0rios0/guide](https://github.com/rios0rios0/guide/wiki) standards and this repository's own load-bearing invariants

### Changed

- changed the changelog to [chlog](https://github.com/luizjhonata/chlog) fragments: a change now writes its own YAML file under `.changes/unreleased/` through `chlog new --kind <Kind> --body "..."`, and `CHANGELOG.md` is GENERATED from them at release time by `chlog batch auto && chlog merge`. That is the one thing a single shared file cannot do — two branches each adding an entry no longer touch the same lines, so a rebase that used to conflict on `CHANGELOG.md` now conflicts on nothing. The single entry standing under `[Unreleased]` was carried across as a fragment of its own, word for word; the migration was verified by compiling the fragments back with `chlog batch` and diffing the result against the file they came from, so the next release renders the same document. AutoBump already reads the fragments directly, so the release flow is unchanged.
- refreshed `CLAUDE.md` and `.github/copilot-instructions.md` to correct the Docker-first claim: only `tools/nmap/` has a `docker-compose.yml`, while `tools/nikto/` and `tools/sqlmap/` are empty placeholders, so only `nmap` is runnable today
- updated `.github/copilot-instructions.md` and `CLAUDE.md` to match the dependency cleanup: dropped `axios` and `yaml` from the technology stack table, recorded that `.mocharc.json` is what loads TypeScript specs through ts-node, and wrote down which CI gates actually fail the run and which are `continue-on-error` -- along with the `npmMinimalAgeGate` rule, which is the one that will surprise anyone trying to bump to a release published this week

### Fixed

- fixed the `main` pipeline's `quality:knip` job, which reported thirteen of the sixteen files under `src/` as dead code. They are not: oclif discovers commands by reading a directory at run time, so nothing ever imports `src/commands/start.ts`, and the whole graph hanging off it looked unreachable. A `knip.jsonc` now declares the command files as entry points and enables knip's oclif plugin, which this project's pre-`@oclif/core` layout did not trigger on its own. The genuinely unused dependencies it also found -- `axios`, `sudo-prompt`, `yaml`, `@oclif/test` and `globby` -- were removed. Removing `@oclif/test` exposed that `@types/lodash` had only ever reached the build as a phantom dependency of one of its transitive packages, even though `tsconfig.json` requires it, so it is now declared directly. `ts-node` was likewise dangling: the `test` script globs `test/**/*.test.ts` but nothing taught mocha to load TypeScript, so a `.mocharc.json` now wires it up and the script can actually run a TypeScript test.
- fixed the `main` pipeline's `sast:hadolint` job, which had been failing on `tools/nmap/Dockerfile` for two reasons: the image switched to a user named `appuser`, whose name a host cannot resolve to an id when the container filesystem is mounted elsewhere (DL3066), and the healthcheck was written in shell form, so it depended on whatever `/bin/sh` the base image happened to ship (DL3025). The user and group are now created with an explicit id of `10001` and `USER` names that number, and the healthcheck is spelled in exec form. The container still runs unprivileged and still reports healthy the same way.
- fixed the `main` pipeline's `sast:semgrep` job by setting `npmMinimalAgeGate: "7d"` in `.yarnrc.yml`. Yarn now refuses to resolve any package version published less than seven days ago, which is the window in which a compromised maintainer account or a typosquat is still unreported -- the single most direct npm supply-chain path, closed without pinning anything by hand.
- fixed the `main` pipeline's `sca:yarn-audit` job, which reported fifteen high-severity advisories against six transitive packages. Every fixed version was already inside the ranges the dependents ask for, so the lockfile was simply stale: `brace-expansion` moved to 1.1.18/2.1.4/5.0.9, `js-yaml` to 3.15.1/4.3.1, `flatted` to 3.4.4, `tmp` to 0.2.7 and `lodash` to 4.18.1. `fast-xml-parser` was the exception -- `@aws-sdk/xml-builder` pinned it exactly -- and it left the dependency tree entirely when that package moved to 3.972.39, which dropped the dependency upstream. No advisory was suppressed and no `resolutions` entry was added.
- fixed the `main` pipeline, which every repository's `sast:gitleaks` job had been failing since the code-review skill landed: the skill's own security bullet listed credential prefixes verbatim to warn against writing them, and the scanner's second pass matches those prefixes on their own, so the warning tripped the rule it was describing. The bullet now names the vendors instead, and the commit that carried the original wording is allowlisted by fingerprint in `.gitleaksignore`, because the scan walks the whole history reachable from `HEAD` and no edit at the tip can clear a past commit. No credential was ever committed.

## [0.2.2] - 2026-06-22

### Changed

- refreshed `CLAUDE.md` and `.github/copilot-instructions.md` to correct the strategy-pattern description (only `LocalResolver` ships; there is no remote strategy)

## [0.2.1] - 2026-05-19

### Changed

- refreshed `CLAUDE.md` and `.github/copilot-instructions.md` to fix CI reusable workflow name (`javascript.yaml` → `yarn-library.yaml`)

## [0.2.0] - 2026-04-28

### Added

- added `CLAUDE.md` with build commands, architecture overview, and repo conventions

### Changed

- refreshed `.github/copilot-instructions.md` to fix TypeScript (3.3+ → 5.x) and Yarn (1.x → 4.x Berry) versions, and document the `--build` CLI flag

## [0.1.0] - 2026-03-13

### Added

- added GitHub Actions workflow for CI/CD pipeline

### Changed

- changed the JavaScript dependencies to their latest versions

### Fixed

- fixed CI workflow to use Yarn-based pipeline instead of NPM-based pipeline

### Security

- fixed `aws-sdk` `v2` region validation vulnerability by migrating to `@aws-sdk/client-sqs` `v3`
- fixed `minimatch` ReDoS vulnerability by upgrading `mocha` to `v11`
- fixed `tmp` symlink vulnerability by adding Yarn resolution to force `v0.2.x`
