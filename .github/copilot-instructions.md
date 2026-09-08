# Copilot Instructions for Scaled

## Project Overview

**Scaled** (codename "scaled") is a TypeScript CLI tool built with the [oclif](https://oclif.io/) framework.
It orchestrates security scanning tools (Nmap, Nikto, SQLMap) by running them inside Docker containers,
parsing the resulting scan reports, and optionally distributing jobs via AWS SQS.

The npm package name is `@rios0rios0/scaled` and the CLI binary is `scaled`.

---

## Repository Structure

```
.github/
  workflows/
    default.yaml          # CI/CD pipeline (delegates to rios0rios0/pipelines)
bin/
  run                     # CLI entry-point script
src/
  commands/
    start.ts              # The only CLI command; entry-point for `scaled start`
  domain/
    entities/             # Domain entities (e.g. NmapReadableReport)
    repositories/         # Repository contracts/interfaces
    services/             # Service contracts/interfaces (e.g. ReportService)
  infrastructure/
    repositories/         # Concrete repository implementations
    services/             # Concrete service implementations (e.g. NmapReportService)
  resolver/
    strategy/             # Execution strategies (e.g. local)
    index.ts              # Resolver entry-point
    service-builder.ts    # Builds ServiceDefinition objects
  manager/
    index.ts              # ServiceManager: start / stop / report lifecycle
  helpers/
    display.ts            # Terminal display utilities
    sqs.ts                # AWS SQS integration helpers
  index.ts                # Library exports
  types.ts                # Shared TypeScript types (ServiceDefinition, NMAPReport, …)
tools/
  nmap/
    docker-compose.yml    # Dockerised Nmap configuration (Dockerfile + entrypoint.sh)
  nikto/                  # empty placeholder (.gitkeep only — not yet implemented)
  sqlmap/                 # empty placeholder (.gitkeep only — not yet implemented)
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.x |
| CLI framework | oclif v1 (`@oclif/command`, `@oclif/config`) — note: v1 is deprecated; consider migrating to oclif v3 |
| Task runner | Listr |
| Cloud | AWS SDK (SQS) |
| Process execution | execa |
| User prompts | Inquirer |
| Report rendering | marked + marked-terminal |
| Terminal UI | terminal-kit |
| Report parsing | xml2js |
| Utilities | lodash, rxjs |
| Runtime | Node.js ≥ 8.0 (as declared in `package.json`; Node.js 8 is EOL — upgrade recommended) |
| Package manager | Yarn 4.x (Berry, `node-modules` linker) |

---

## Build, Test, Lint, and Run Commands

```bash
# Install dependencies
yarn install

# Build: compile TypeScript → lib/, generate oclif manifest and update README
yarn prepack           # ~10-20 s

# Lint (ESLint with airbnb-typescript rules)
yarn lint              # ~5 s
yarn lint:fix          # auto-fix lint issues

# Test (mocha + nyc coverage; `.mocharc.json` loads TypeScript specs through ts-node)
yarn test              # ~5-10 s

# Run the CLI locally after building
./bin/run start <service> [--build] [--containers <n>] [--set-env KEY=VALUE]
```

> **Note:** `yarn prepack` must be run before `./bin/run` because the compiled output lives in `lib/`.

---

## Architecture and Design Patterns

- **Domain-Driven Design (DDD):** Code is split into `domain/` (entities, repository & service contracts) and `infrastructure/` (concrete implementations). This keeps business logic decoupled from I/O.
- **Strategy pattern:** `src/resolver/strategy/` contains pluggable service resolvers behind `ResolverInterface`; only `LocalResolver` (local-filesystem lookup) is implemented so far.
- **Service Builder:** `src/resolver/service-builder.ts` constructs `ServiceDefinition` objects which carry the name and file-system path of a tool.
- **Listr task lists:** Long-running operations are presented as an ordered list of observable tasks in the terminal.
- **Docker-first tool execution:** A scanner is defined by `tools/<name>/docker-compose.yml`. Only `nmap` ships one today; `nikto` and `sqlmap` are empty placeholders. `LocalResolver` resolves a service only when that compose file exists, so `scaled start nikto` / `sqlmap` fail with "Service not found" until they are implemented. Report parsing is likewise Nmap-only (`NMAPReportService` is the sole implementation).

---

## CI/CD Pipeline

The workflow file `.github/workflows/default.yaml` delegates all steps to the shared reusable workflow at `rios0rios0/pipelines/.github/workflows/yarn-library.yaml@main`.

Triggers:
- Push to `main`
- Any git tag
- Pull requests targeting `main`
- Manual (`workflow_dispatch`)

Required permissions: `security-events: write`, `contents: write`.

Not every gate blocks. `quality:basic-checks`, `style:format`, `sast:codeql`, `sast:semgrep`,
`sast:gitleaks` and both `tests` jobs fail the run; `style:eslint`, `quality:knip` (configured by
`knip.jsonc`), `sast:hadolint` and `sca:yarn-audit` are `continue-on-error`, so they go red in the
job list without failing the workflow. Treat a red advisory job as a real finding anyway — it is
the only signal you get before it becomes a blocking one.

`.yarnrc.yml` sets `npmMinimalAgeGate`, so a version published in the last seven days will not
resolve — bumping to a brand-new release means waiting it out.

---

## Development Workflow

1. Fork and clone the repository.
2. Create a feature branch: `git checkout -b feat/my-change`
3. `yarn install`
4. Make code changes in `src/`.
5. `yarn lint` — fix any lint errors (`yarn lint:fix` for auto-fixable ones).
6. `yarn test` — ensure all tests pass.
7. `yarn prepack` — verify the project builds cleanly.
8. Test the CLI manually: `./bin/run start <service>`
9. Commit following [Conventional Commits](https://www.conventionalcommits.org/) as described in the [Development Guide](https://github.com/rios0rios0/guide/wiki/Life-Cycle/Git-Flow).
10. Open a pull request against `main`.

---

## Coding Conventions

- **ESLint config:** `airbnb-typescript/base` extended in `.eslintrc`. Project-specific overrides:
  - `class-methods-use-this`: off
  - `no-await-in-loop`: off
  - `no-restricted-syntax`: off
  - `no-continue`: off
- **TypeScript:** Strict mode is enabled (`"strict": true` in `tsconfig.json`). Target is ES2017, output to `lib/`.
- **Imports:** Use named imports where possible. Avoid default re-exports unless the oclif convention requires it.
- **Types:** Shared types and domain types live in `src/types.ts` and domain entities respectively. Avoid `any`.
- **README:** Auto-generated by `oclif-dev readme` during `prepack` and `version` scripts — do **not** edit it manually.
- **Commit messages:** Follow the project's [Git Flow guide](https://github.com/rios0rios0/guide/wiki/Life-Cycle/Git-Flow) (Conventional Commits style).

---

## Common Tasks

### Adding a new scanner tool

1. Create `tools/<tool-name>/docker-compose.yml` with the Docker Compose configuration.
2. Implement a `ServiceDefinition` builder in `src/resolver/service-builder.ts`.
3. Add a new strategy under `src/resolver/strategy/` if needed.
4. Add a report service interface under `src/domain/services/` and an implementation under `src/infrastructure/services/`.

### Adding a new CLI flag

Edit `src/commands/start.ts` — flags are declared in the `static flags` block using the oclif `flags` helpers.

### Updating dependencies

Use `yarn add <package>` / `yarn add -D <package>`. Re-run `yarn prepack` to verify the build still succeeds.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `./bin/run` reports missing module | Run `yarn prepack` to compile TypeScript |
| ESLint errors on TypeScript files | Run `yarn lint:fix`; check `parserOptions.project` points to `tsconfig.json` |
| Docker tool not found | Ensure Docker and Docker Compose are installed and the daemon is running |
| AWS SQS errors | Verify AWS credentials are set (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`) |

<!-- chlog:start -->
## Changelog (chlog) — MANDATORY

If the repository you are working in uses chlog (a `.chlog.yaml` or `.chlog.yml`
config file, or a `.changes/` directory, exists at the project root), the
following is binding and ALWAYS applies: whenever you make ANY change, you MUST
create a changelog fragment as part of the same change — automatically, without
being asked, before committing.

- Do NOT edit CHANGELOG.md directly; it is generated from fragments.
- Create the fragment with:
  `chlog new --kind <Kind> --body '<past-tense description>'`
- Write an apostrophe inside the single-quoted body as `'\''`.
- Valid kinds: Added, Changed, Deprecated, Removed, Fixed, Security
- Choose the kind that best matches the change (e.g., new feature → Added,
  bug fix → Fixed, behavior change → Changed, removal → Removed, security fix → Security).
- If the change is backward-INCOMPATIBLE with the public API (a breaking
  change), you MUST add the `--breaking` flag:
  `chlog new --kind <Kind> --breaking --body '<past-tense description>'`.
  This is the ONLY thing that triggers a major version bump — the kind alone
  never does (per SemVer, major = incompatible change). When unsure whether a
  change breaks compatibility, ask the user instead of guessing.
- Fragments are YAML files in `.changes/unreleased/`; stage them with your commit.
- `chlog check` fails the build when a fragment is missing — never skip it.
<!-- chlog:end -->
