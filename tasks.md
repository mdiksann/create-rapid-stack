# Implementation Checklist: `create-rapid-stack`

Actionable task list, ordered by phase. Each phase is independently verifiable — do not start a phase until the previous phase's exit criteria pass.

---

## Phase 1: Project Initialization

**Exit criteria:** `node bin/index.js --help` runs and prints usage; repo lints clean.

- [x] Create GitHub repository `create-rapid-stack` with MIT `LICENSE`
- [x] Initialize local project: `git init` in the working directory
- [x] Create `package.json` with:
  - [x] `"name": "create-rapid-stack"`
  - [x] `"version": "0.1.0"`
  - [x] `"type": "module"`
  - [x] `"bin": { "create-rapid-stack": "./bin/index.js" }`
  - [x] `"engines": { "node": ">=18.17" }`
  - [x] `"files": ["bin", "src", "templates"]`
  - [x] `"scripts"`: `test`, `lint`, `format`
- [x] Add `.gitignore` (Node defaults: `node_modules/`, `*.log`, `.env`, `coverage/`, OS files)
- [x] Install runtime dependencies:
  - [x] `npm i commander inquirer fs-extra ora chalk validate-npm-package-name`
- [x] Install dev dependencies:
  - [x] `npm i -D eslint prettier`
- [x] Configure ESLint + Prettier (flat config, ESM-aware)
- [x] Create base folder skeleton: `bin/`, `src/`, `templates/`, `test/`
- [x] Add minimal `bin/index.js` with shebang printing a placeholder
- [x] Verify `chmod +x bin/index.js` (and file mode committed)
- [x] Add `README.md` stub with project name and one-line description
- [x] Push initial commit

---

## Phase 2: Template Creation

**Exit criteria:** Each template tree runs standalone when `npm install` + `npm run dev` is executed inside it (manually verified for both DB choices).

### 2a. Shared / base templates
- [ ] Create `templates/base/` root files:
  - [ ] `README.md` with `{{PROJECT_NAME}}`, run instructions, stack overview
  - [ ] `.gitignore` covering `node_modules`, `.env`, `dist`, `.next`
- [ ] Create Express backend template (`templates/base/backend/`):
  - [ ] `package.json` with `{{PROJECT_NAME}}` marker, `dev`/`start` scripts
  - [ ] `src/index.js` — Express server, CORS, JSON body parsing, `/api/health`
  - [ ] `src/routes/` — sample CRUD route using Prisma client
  - [ ] `.env.example` with `{{DATABASE_URL}}`, `{{PORT}}`
  - [ ] Error-handling middleware + graceful shutdown
- [ ] Create Next.js frontend template (`templates/base/frontend/`):
  - [ ] `package.json` with `{{PROJECT_NAME}}` marker, `dev`/`build`/`start` scripts
  - [ ] `app/layout.js`, `app/page.js` (minimal, styled starter page)
  - [ ] `app/api/health/route.js` or fetch helper pointing at `{{API_URL}}`
  - [ ] `next.config.js` with `output: "standalone"` (required for Docker)
  - [ ] `.env.example` with `{{NEXT_PUBLIC_API_URL}}`

### 2b. Database overlays
- [ ] Create `templates/overlays/db/postgres/`:
  - [ ] `backend/prisma/schema.prisma` — `provider = "postgresql"`, Int autoincrement IDs, sample relation
  - [ ] `backend/prisma/seed.js`
  - [ ] `docker-compose.db.yml` — `postgres:16-alpine` service, volume, healthcheck, env vars
  - [ ] Mongo-specific `.env` fragment with `{{DATABASE_URL}}` postgres connection string
- [ ] Create `templates/overlays/db/mongodb/`:
  - [ ] `backend/prisma/schema.prisma` — `provider = "mongodb"`, `String @id @default(auto())`, `@map("_id")`
  - [ ] `backend/prisma/seed.js`
  - [ ] `docker-compose.db.yml` — `mongo:7` service, volume, healthcheck, `MONGO_INITDB_*`
  - [ ] `.env` fragment with mongodb `{{DATABASE_URL}}`
- [ ] Verify schema validity: run `npx prisma validate` against both schema files

### 2c. Docker overlay
- [ ] Create `templates/overlays/docker/`:
  - [ ] `frontend/Dockerfile` — multi-stage, deps → build → standalone runtime, non-root user
  - [ ] `backend/Dockerfile` — multi-stage, prod deps only, `prisma generate` in build stage
  - [ ] `docker-compose.yml` with `{{PROJECT_NAME}}`, `{{DATABASE_SERVICE}}` marker, frontend/backend services, `depends_on` with healthcheck conditions
  - [ ] `.dockerignore` for both apps (or root-level)
- [ ] Confirm compose file merges correctly with each DB overlay's service block

### 2d. Template QA
- [ ] Document every marker in a table (marker → files where it appears) — add to `engineering.md`
- [ ] Manually scaffold both DB variants by hand-copying overlays; confirm zero leftover `{{...}}` tokens
- [ ] Commit templates as a standalone, reviewable unit

---

## Phase 3: Core CLI Development

**Exit criteria:** `create-rapid-stack my-app --db postgres --docker --skip-install` parses fully and prints the resolved context as JSON (no file writes yet).

- [ ] Implement `bin/index.js`:
  - [ ] Shebang `#!/usr/bin/env node`
  - [ ] Import and invoke `run(process.argv)` with top-level error handling
- [ ] Implement `src/cli.js`:
  - [ ] Configure `commander` program: name, description, version (read from `package.json`)
  - [ ] Positional argument: `<project-name>` (optional)
  - [ ] Flags: `--db <postgres|mongodb>`, `--docker` / `--no-docker`, `--skip-install`, `--yes`, `--verbose`, `--force`
  - [ ] Wire `program.action()` to the orchestration pipeline
  - [ ] Use `parseAsync` (required for async actions)
- [ ] Implement `src/validate.js`:
  - [ ] Project name validation via `validate-npm-package-name` (lowercase, npm-safe)
  - [ ] Target directory checks: exists? empty? (respect `--force`)
- [ ] Implement `src/prompts.js`:
  - [ ] Question: project name (default = directory name, validated)
  - [ ] Question: database → list choice PostgreSQL (default) / MongoDB
  - [ ] Question: Docker → confirm (default: Yes)
  - [ ] Question: install dependencies → confirm (default: Yes)
  - [ ] Question: final confirmation summary (default: Yes)
  - [ ] Merge order implemented: defaults ← prompt answers ← commander flags
  - [ ] Skip any question already answered by a flag; skip all with `--yes`
- [ ] Build the `context` object and expose `run()` returning it (testable without I/O)
- [ ] Add unit tests: flag/prompt merge precedence, validation edge cases
- [ ] Verify both `--help` output and a full interactive session via `npm link`

---

## Phase 4: File Manipulation & Automation

**Exit criteria:** Running the CLI produces a directory tree where `grep -r "{{" ` returns nothing, `package.json` names are correct, and `npm install` completes.

- [ ] Implement `src/scaffold.js`:
  - [ ] Resolve `templates/` root via `fileURLToPath(import.meta.url)` — never `process.cwd()`
  - [ ] Guard: abort with clear error if target dir exists and is non-empty (unless `--force`)
  - [ ] Copy `templates/base/` → target dir (`fs.copy`)
  - [ ] Copy `templates/overlays/db/<database>/` → target (overwrite-on-top)
  - [ ] Conditionally copy `templates/overlays/docker/`; otherwise remove any docker artifacts
  - [ ] Recursively walk the copied tree applying the injection rule table:
    - [ ] `**/package.json` → structured edit via `fs.readJson` / `fs.writeJson` (set `name`)
    - [ ] `README.md`, `.env*`, `docker-compose*.yml` → token replacement (`replaceAll`)
    - [ ] Assemble `{{DATABASE_SERVICE}}` from the chosen DB overlay
    - [ ] All other files untouched
  - [ ] Post-injection assertion: throw if any `{{MARKER}}` remains in output
  - [ ] Handle `SIGINT`: stop spinner, optionally `fs.remove` partial dir, exit `130`
- [ ] Implement `src/install.js`:
  - [ ] `spawn()` npm install per workspace (`frontend/`, `backend/`)
  - [ ] `shell: process.platform === "win32"` for Windows `npm.cmd`
  - [ ] Capture stderr; on non-zero exit throw `ScaffoldError` with a "re-run this command" hint
  - [ ] Respect `--verbose` → `stdio: "inherit"`, otherwise `pipe`
- [ ] Implement `ScaffoldError` with `hint` field + top-level formatter in `src/cli.js`
- [ ] Write integration tests:
  - [ ] Scaffold all 4 combinations (postgres/mongodb × docker on/off) into `fs.mkdtemp`
  - [ ] Assert file presence/absence per combination
  - [ ] Assert `package.json` names and zero leftover markers
  - [ ] Assert install step runs (can be mocked with a stub script)

---

## Phase 5: Terminal UI & Finishing

**Exit criteria:** A first-time user completes setup with zero docs, and the repo is presentable enough to share publicly.

- [ ] Implement `src/logger.js`:
  - [ ] Spinner: `Scaffolding project files…` → `succeed` / `fail`
  - [ ] Spinner: `Installing dependencies…` → `succeed` / `fail` (with stderr tail on fail)
  - [ ] Ensure only one spinner active at a time; all stopped on `SIGINT`
- [ ] Implement `src/ui/theme.js` with chalk:
  - [ ] Branded welcome banner
  - [ ] Section headings, flag/option names, paths, and error emphasis styles
  - [ ] `printSummary(context)`: `✔ Project <name> created in <n>s` + next-steps block:
    - [ ] `cd <name>`
    - [ ] `npm run dev` (ports annotated)
    - [ ] `docker compose up` (only if docker enabled)
    - [ ] `.env` reminder (DB URL note)
- [ ] Wire `--verbose` to show raw npm output; default stays spinner-only
- [ ] Local testing loop with `npm link`:
  - [ ] `npm link`, then scaffold in `/tmp/crs-smoke` for all 4 combinations
  - [ ] Run generated app (`npm run dev` and `docker compose up`) — confirm it boots
  - [ ] `npm unlink --global create-rapid-stack` when done
- [ ] Cross-platform sanity pass: path separators, `npm.cmd`, spinner behavior on Windows
- [ ] Write the high-quality `README.md`:
  - [ ] Hero: one-line value prop + animated GIF/screenshot of the CLI
  - [ ] Quick start: `npx create-rapid-stack@latest`
  - [ ] Feature list (interactive menu, Postgres/Mongo, Docker, auto-install)
  - [ ] All CLI flags documented in a table
  - [ ] Architecture blurb + template customization section
  - [ ] Tech stack badges, license badge, npm version badge
  - [ ] Contributing section + link to `CONTRIBUTING.md`
- [ ] Add `CONTRIBUTING.md` (dev setup, `npm link` workflow, template conventions, marker rules)
- [ ] Add `CHANGELOG.md` (Keep a Changelog format)
- [ ] Add issue templates focused on DX friction (confusing prompt, broken default, template bug)
- [ ] Set up CI (GitHub Actions):
  - [ ] Lint + unit/integration tests on Node 18 & 20
  - [ ] Scaffold matrix: 2 DBs × docker on/off, `npm install`, `npm run build` in generated app
  - [ ] Ubuntu + Windows runners
- [ ] Final README review: does the value prop land in the first screen?

---

## Phase 6: Publication

**Exit criteria:** `npx create-rapid-stack@latest` works on a clean machine from any directory.

- [ ] Verify package name availability: `npm view create-rapid-stack` returns 404
- [ ] Audit `package.json` publish fields:
  - [ ] `"files"` includes `bin/`, `src/`, `templates/` only
  - [ ] `repository`, `bugs`, `homepage`, `keywords`, `author`, `license` populated
- [ ] Run `npm pack --dry-run` and inspect tarball contents:
  - [ ] All template files present (including dotfiles like `.env.example`, `.dockerignore`)
  - [ ] No secrets, no `test/`, no scratch dirs
- [ ] Full pre-publish checklist:
  - [ ] `npm test` green locally
  - [ ] `npm link` smoke test — all 4 combinations scaffold and build
  - [ ] Confirm zero `{{markers}}` in output for every combination
- [ ] Bump version: `npm version minor` (or `patch`/`major` per changes), creates git tag
- [ ] Push commits + tag: `git push && git push --tags`
- [ ] `npm login` (or configure `NPM_TOKEN` secret for CI publish)
- [ ] `npm publish --access public` (add `--provenance` if publishing from CI)
- [ ] Create GitHub Release from the tag with changelog notes
- [ ] **Post-publish verification:**
  - [ ] From a clean directory: `npx create-rapid-stack@latest verify-app`
  - [ ] Confirm installed artifact matches `npm pack` expectations (templates present in cache copy)
  - [ ] Verify the npm page renders README correctly
- [ ] Announce:
  - [ ] Update repo description/badges with live npm version
  - [ ] Share in relevant communities (Node/DX forums, Show HN, Reddit) with GIF
- [ ] Set up release automation for next time:
  - [ ] CI job: on tag push → test matrix → `npm publish` → GitHub Release
  - [ ] Document the release flow in `CONTRIBUTING.md`
