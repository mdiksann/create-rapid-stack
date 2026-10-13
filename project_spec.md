# Project Specification: `create-rapid-stack`

## 1. Vision and Goals

### Vision

`create-rapid-stack` is a single-command scaffolding tool that turns an empty directory into a production-ready, fullstack application in under two minutes. Instead of spending a day wiring up a Next.js frontend, an Express backend, a database ORM, Docker orchestration, and environment configuration, a developer runs one command and gets a coherent, pre-integrated monorepo they can immediately build on.

### The Problem

Initial project setup is the most repeated, least valuable work in modern web development. A typical fullstack kickoff requires:

- Manually initializing two separate applications (frontend and backend)
- Installing and configuring dozens of dependencies across both
- Writing Dockerfiles and `docker-compose.yml` by hand
- Setting up an ORM, defining the first schema, and generating a client
- Creating and reconciling `.env` files, `.gitignore`, and shared scripts
- Debugging version mismatches between tools that were never tested together

This work is identical across projects, poorly documented, and error-prone. It commonly consumes hours on day one — hours that should go toward the actual product.

### Goals

| # | Goal | Measure |
|---|------|---------|
| G1 | Reduce project kickoff from hours to minutes | Cold start to `npm run dev` in < 2 minutes |
| G2 | Deliver a *coherent* stack, not a bag of parts | Frontend, backend, DB, and Docker run with zero manual edits |
| G3 | Make the tool approachable at any skill level | A student can complete setup without reading source code |
| G4 | Stay transparent and hackable | All templates are plain, readable, and inspectable in the repo |
| G5 | Support real database choices | PostgreSQL and MongoDB both first-class |

### Non-Goals

- Runtime deployment or hosting (out of scope; templates must be deploy-*ready*, not deploy-*automated*)
- A plugin/extension ecosystem in v1
- Backend frameworks beyond Express.js in v1
- Frontend frameworks beyond Next.js in v1

---

## 2. Target Audience

| Segment | Profile | What they need |
|---------|---------|----------------|
| **Frontend developers** | Strong in React/Next.js, weaker in server and infra setup | A backend and Docker layer that "just works" without needing to learn ops |
| **Backend developers** | Strong in Node/Express, want a modern UI fast | A Next.js frontend pre-wired to their API and database |
| **Students & learners** | First fullstack project; following a tutorial or class | Sensible defaults, clear naming, no configuration decisions they can't yet evaluate |
| **Hackers & tinkerers** | Prototype an idea tonight, ship a demo tomorrow | Speed, zero ceremony, easy to rip apart and modify |
| **Open-source contributors** | Want to improve a small, readable CLI | Clean architecture, obvious template layout, good `CONTRIBUTING` docs |

**Primary persona — "the weekend hacker":** has an idea Saturday morning, wants a working fullstack demo by Saturday night, and will abandon any tool that makes them read a configuration file first.

**Secondary persona — "the student":** has never configured Docker or Prisma, and needs the generated project to run on the first `npm run dev` with no hidden setup steps.

---

## 3. Key Features

### 3.1 Interactive CLI Menu

Running the tool without flags launches a guided prompt sequence. Every decision is presented as a clear, keyboard-navigable menu with an opinionated default pre-selected, so pressing <kbd>Enter</kbd> through the whole flow yields a working project.

- Project name (validated: npm-safe, lowercase, no spaces)
- Database choice (PostgreSQL / MongoDB)
- Include Docker? (Yes / No)
- Install dependencies now? (Yes / No)

Power users can skip the prompts entirely with flags (see §3.5).

### 3.2 Database Choice: PostgreSQL / MongoDB

The selected database drives a coordinated set of template substitutions:

| Layer | PostgreSQL | MongoDB |
|-------|-----------|---------|
| ORM | Prisma with `postgresql` provider | Prisma with `mongodb` provider |
| Schema | `id Int @id @default(autoincrement())`, relations, scalar types | `id String @id @default(auto())`, `@map("_id")`, no autoincrement |
| `docker-compose.yml` | `postgres:16-alpine` service, volume, healthcheck | `mongo:7` service, volume, healthcheck |
| `.env` | `DATABASE_URL=postgresql://...` | `DATABASE_URL=mongodb://...` |
| Backend | Prisma client with Postgres driver adapters as needed | Prisma client tuned for Mongo (replica set notes in README) |

The user never edits a Prisma datasource block or a compose file by hand — the choice is made once, at the prompt, and applied everywhere consistently.

### 3.3 Docker Integration

When enabled, the scaffold includes:

- `Dockerfile` for the backend (multi-stage, non-root user, production-only deps)
- `Dockerfile` for the frontend (Next.js standalone output)
- `docker-compose.yml` wiring frontend, backend, and the chosen database together
- Named volumes for database persistence
- Healthchecks and an `depends_on` ordering so `docker compose up` boots cleanly
- Matching `.dockerignore` files

When Docker is declined, the compose file and Dockerfiles are simply omitted — the project still runs natively via `npm run dev`.

### 3.4 Auto-Dependency Installation

After files are copied and variables injected, the CLI can run `npm install` (or `npm install` in both `frontend/` and `backend/`) with a live spinner. Failures are reported with the exact command to re-run, never swallowed. Users who prefer to review `package.json` first can decline and install later.

### 3.5 Non-Interactive Mode (Flags)

```bash
npx create-rapid-stack my-app --db postgres --docker --install
```

All prompt answers have flag equivalents, enabling CI usage, scripted scaffolding, and reproducible demos.

### 3.6 Post-Setup Handoff

On completion the CLI prints a styled summary:

```
✔ Project my-app created in 1.8s

  cd my-app
  npm run dev        # frontend :3000  backend :4000
  docker compose up  # full stack with database
```

The generated `README.md` is also rewritten with the project's actual name and run instructions.

---

## 4. User Flow

### Happy path: `npx create-rapid-stack`

```
1.  USER        Executes `npx create-rapid-stack` in an empty (or new) directory.
2.  CLI         Prints branded welcome banner (chalk-styled, ASCII or logo).
3.  CLI         Prompts: "Project name?"  (defaults to directory name; validated)
4.  CLI         Prompts: "Database?"      → PostgreSQL | MongoDB  (default: PostgreSQL)
5.  CLI         Prompts: "Add Docker?"    → Yes | No               (default: Yes)
6.  CLI         Prompts: "Install deps?"  → Yes | No               (default: Yes)
7.  CLI         Shows a confirmation summary of all choices.
8.  CLI         Starts spinner: "Scaffolding project files…"
9.  ENGINE      Creates target directory; aborts with a clear error if non-empty.
10. ENGINE      Copies the base template set (frontend + backend + configs).
11. ENGINE      Applies database-specific overlay (Prisma schema, compose service, .env).
12. ENGINE      Conditionally includes or excludes Docker files.
13. ENGINE      Injects variables: project name into package.json files, README,
                .env, docker-compose, and display strings.
14. CLI         Updates spinner: "Installing dependencies…"
15. ENGINE      Runs `npm install` in each workspace via child_process, streamed output.
16. CLI         Stops spinner with success checkmark.
17. CLI         Prints next-steps summary (cd, dev commands, Docker command, .env note).
18. CLI         Exits with code 0.
```

### Branch scenarios

- **Non-empty target directory** → prompt to continue anyway or abort; abort exits `1` without modifying files.
- **`--skip-install`** → step 14–15 replaced with a printed "run npm install" instruction.
- **Install failure** → spinner fails with `✖`, prints the failing command and stderr tail, exits `1`; scaffolded files are **retained** so the user can retry manually.
- **Invalid project name** (e.g., uppercase, spaces) → inline validation error, re-prompt.

---

## 5. Success Criteria

Success is measured almost entirely by **Developer Experience (DX)**.

### 5.1 Ease of Use

- [ ] A new user scaffolds a running fullstack app with **zero documentation lookups**, only the interactive prompts.
- [ ] `npx create-rapid-stack` with no arguments never asks a question that lacks a sensible, pre-selected default.
- [ ] The generated project reaches `npm run dev` running state **with no manual file edits**.
- [ ] Docker path requires **no** editing of compose files, ports, or connection strings.
- [ ] Errors are actionable: every failure message states *what happened* and *what to run next*.

### 5.2 Developer Experience

- [ ] Cold start (empty dir → running app) in **under 2 minutes** on a typical laptop with warm npm cache.
- [ ] Total interactive time ≤ **30 seconds** for a user pressing <kbd>Enter</kbd> on defaults.
- [ ] CLI output is scannable: spinners while working, no wall of raw npm logs unless requested (`--verbose`).
- [ ] The generated codebase reads cleanly — a student can open any file and understand it.
- [ ] Templates contain **no leftover placeholders**, debug logs, or example code unrelated to the chosen stack.

### 5.3 Reliability

- [ ] Both database paths (PostgreSQL, MongoDB) produce a project that boots without errors — verified in CI for every release.
- [ ] Scaffold is **idempotent-safe**: rerunning in a non-empty directory never silently destroys user data.
- [ ] Works on macOS, Linux, and Windows (path handling, no bash-only syntax in core paths).

### 5.4 Adoption Signals (post-launch)

- [ ] README conveys the value proposition above the fold (screenshot/GIF within first screen).
- [ ] Time-to-first-success for a first-time user < 5 minutes including `npx` download.
- [ ] Issue templates surface real DX friction (confusing prompts, broken defaults) as the primary feedback category.
