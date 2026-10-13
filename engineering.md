# Engineering Specification: `create-rapid-stack`

Technical reference for contributors. Companion documents: `project_spec.md` (product), `tasks.md` (implementation checklist).

---

## 1. Tech Stack

### 1.1 Runtime & Language

| Concern | Choice | Notes |
|---------|--------|-------|
| Runtime | Node.js ≥ 18.17 | Native `fetch`, stable `node:` imports; declared in `engines` |
| Language | JavaScript (ESM) | `"type": "module"` — templates and CLI both ESM to avoid dual-module friction |
| Package manager (CLI dev) | npm | Templates may use any PM at runtime; CLI runs `npm` for installs by default |

### 1.2 Core Dependencies

| Package | Role | Usage detail |
|---------|------|--------------|
| **`commander`** | Argument parsing | Defines the program, version, description, and flags (`--db`, `--docker`, `--skip-install`, `--verbose`, `--yes`). Parses `argv` and exposes validated options to the prompt layer. Also handles `npx create-rapid-stack <name>` positional argument. |
| **`inquirer`** | Interactive prompts | Presents the menu when flags are absent. Responsible for project-name validation, list prompts (database, Docker, install), and the final confirmation. Answers are merged with commander flags (flags win). |
| **`fs-extra`** | Filesystem operations | `copy()` for template trees (preserves structure, supports `filter` to exclude files), `ensureDir()`, `pathExists()`, `readJson()` / `writeJson()` for `package.json` edits, `readFile()` / `writeFile()` for text injection, `remove()` for cleanup on abort. |
| **`ora`** | Loading spinners | One spinner per long-running stage (`Scaffolding files…`, `Installing dependencies…`). `succeed()` / `fail()` / `stop()` transitions drive the final status line. |
| **`chalk`** | Terminal styling | Banner, headings, flag names, next-steps block, and error emphasis. Styled via a shared `src/ui/theme.js` so colors stay consistent. |
| **`child_process`** (Node built-in) | Shell execution | `spawn()` (not `exec`) for `npm install` to stream output without buffering the whole log and to avoid shell-injection on project paths. Used with `{ shell: process.platform === 'win32' }` for Windows `npm.cmd` resolution. |

### 1.3 Supporting Utilities

| Package | Role |
|---------|------|
| `validate-npm-package-name` | Project name validation against npm rules |
| `picocolors` (optional) | Only if chalk's ESM story is a problem — not planned for v1 |

### 1.4 Deliberate Exclusions

- **No** `yeoman`/`plop` — full template control is simpler than a generator framework.
- **No** `execa` — `child_process.spawn` covers our needs with zero deps.
- **No** remote template fetching in v1 — templates ship inside the npm package for offline, version-pinned scaffolds.

---

## 2. CLI Architecture

### 2.1 Folder Structure (source repo)

```
create-rapid-stack/
├── bin/
│   └── index.js              # Executable entry; shebang, imports src/cli.js, runs .parseAsync()
├── src/
│   ├── cli.js                # commander program definition + orchestration pipeline
│   ├── prompts.js            # inquirer question flow; merges flags + prompt answers
│   ├── scaffold.js           # core: copy templates, filter overlays, inject variables
│   ├── install.js            # spawn npm install across workspaces
│   ├── logger.js             # ora spinners + chalk-styled output helpers
│   ├── validate.js           # project name / directory checks
│   └── ui/
│       └── theme.js          # centralized chalk colors, banner, next-steps formatter
├── templates/
│   └── ...                   # see §3
├── test/
│   ├── scaffold.test.js
│   └── prompts.test.js
├── package.json
├── README.md
└── CONTRIBUTING.md
```

### 2.2 Entry Point

`bin/index.js`:

```js
#!/usr/bin/env node
import { run } from "../src/cli.js";

run(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
```

`package.json` declares `"bin": { "create-rapid-stack": "./bin/index.js" }`. The shebang plus the bin mapping is what makes `npx create-rapid-stack` work after publish.

### 2.3 Orchestration Pipeline

`src/cli.js` executes a strict linear pipeline; each stage is a pure-ish function receiving a `context` object:

```
parseArgs (commander)
   → collectAnswers (inquirer, skipped for flags provided with --yes)
   → validateContext
   → scaffoldFiles (fs-extra)      [spinner: "Scaffolding files…"]
   → installDependencies (spawn)   [spinner: "Installing dependencies…"]
   → printSummary (chalk)
```

The `context` object is the single source of truth:

```js
{
  projectName: "my-app",
  targetDir:  "/abs/path/my-app",
  database:    "postgres" | "mongodb",
  docker:      true,
  install:     true,
  verbose:     false,
  flagsProvided: false
}
```

**Rule:** flags from `commander` always override `inquirer` answers; `inquirer` never asks about a value already supplied by a flag.

### 2.4 Error Handling

- Every stage throws `ScaffoldError` with a `hint` field; the top-level catch prints `✖ message` + `hint` via chalk and exits `1`.
- Partial state is cleaned up only if the failure occurs **before** any files were copied. After copying begins, files are retained and the error explains how to remove/retry (`rm -rf my-app`).
- Process signals (`SIGINT`) stop spinners and exit cleanly with code `130`.

---

## 3. Template Architecture

### 3.1 Design Principle

Templates are **plain, runnable codebases** — not string-templated blobs. Variable injection is limited to a small, documented set of markers, so every template folder can be opened and run on its own during development.

### 3.2 Directory Layout

```
templates/
├── base/                        # always copied
│   ├── README.md                # contains {{PROJECT_NAME}} marker
│   ├── .gitignore
│   ├── frontend/                # Next.js app
│   │   ├── package.json         # contains {{PROJECT_NAME}}
│   │   ├── next.config.js
│   │   ├── app/
│   │   │   ├── layout.js
│   │   │   ├── page.js
│   │   │   └── api/health/route.js
│   │   ├── components/
│   │   └── .env.example         # {{NEXT_PUBLIC_API_URL}}
│   └── backend/                 # Express app
│       ├── package.json         # contains {{PROJECT_NAME}}
│       ├── src/
│       │   ├── index.js
│       │   ├── routes/
│       │   └── prisma/          # placeholder dir; schema comes from overlay
│       └── .env.example         # {{DATABASE_URL}}, {{PORT}}
│
├── overlays/                    # copied ON TOP of base, per choice
│   ├── db/
│   │   ├── postgres/
│   │   │   ├── backend/prisma/schema.prisma      # datasource postgresql
│   │   │   ├── backend/prisma/seed.js
│   │   │   └── docker-compose.db.yml             # postgres service block
│   │   └── mongodb/
│   │       ├── backend/prisma/schema.prisma      # datasource mongodb
│   │       ├── backend/prisma/seed.js
│   │       └── docker-compose.db.yml             # mongo service block
│   └── docker/
│       ├── frontend/Dockerfile
│       ├── backend/Dockerfile
│       ├── docker-compose.yml                   # imports/includes db overlay content
│       └── .dockerignore
│
└── partials/                    # optional snippet files assembled at scaffold time
    └── env/
        ├── backend.env          # full .env content with markers
        └── frontend.env
```

### 3.3 Layering Model

Copy order (later overwrites earlier):

1. **`base/`** — always
2. **`overlays/db/<database>/`** — always one of the two
3. **`overlays/docker/`** — only when `docker: true`

This "base + overlay" model avoids combinatorial template explosion: `1 base + 2 db + 1 docker` directories cover all four feature combinations, instead of 4 duplicated full trees.

### 3.4 Docker Compose Assembly

`docker-compose.yml` in `overlays/docker/` contains a `{{DATABASE_SERVICE}}` marker. During injection, the service block is read from the chosen DB overlay's `docker-compose.db.yml` and substituted. This keeps the database definition in exactly one place per engine.

### 3.5 Marker Convention

All injectable values use double-curly markers: `{{PROJECT_NAME}}`, `{{DATABASE_URL}}`, `{{DATABASE_SERVICE}}`, `{{NEXT_PUBLIC_API_URL}}`, `{{API_URL}}`, `{{PORT}}`. The full list lives in one exported constant (`MARKERS`) in `src/scaffold.js` — adding a variable is a one-line change plus a template edit.

| Marker | Default / Example Value | Target Files |
|--------|-------------------------|--------------|
| `{{PROJECT_NAME}}` | `<projectName>` (e.g. `my-app`) | `README.md`, `package.json`, `frontend/package.json`, `backend/package.json` |
| `{{DATABASE_URL}}` | `postgresql://postgres:postgres@localhost:5432/app_db?schema=public` or `mongodb://mongo:mongo@localhost:27017/app_db?authSource=admin` | `README.md`, `backend/.env.example`, `backend/.env`, `partials/env/backend.env`, `docker-compose.yml` |
| `{{DATABASE_SERVICE}}` | Contents of `overlays/db/<db>/docker-compose.db.yml` | `docker-compose.yml` |
| `{{NEXT_PUBLIC_API_URL}}` | `http://localhost:4000` | `frontend/.env.example`, `partials/env/frontend.env`, `docker-compose.yml` |
| `{{API_URL}}` | `http://localhost:4000` | `README.md` |
| `{{PORT}}` | `4000` | `README.md`, `backend/.env.example`, `backend/.env`, `partials/env/backend.env`, `docker-compose.yml` |

**Markers are forbidden outside of:**
- `README.md`, `.env.example`/`.env`, `docker-compose.yml`, `package.json`
- Anything a human reads for *configuration* (never inside business logic)

A CI test asserts that after scaffolding, **zero** `{{...}}` tokens remain in the output tree.

---

## 4. Core Logic

### 4.1 Reading User Input

```
commander.parseAsync(argv)
        │
        ├─ positional  <name>        → context.projectName
        ├─ --db <postgres|mongodb>    → context.database
        ├─ --docker / --no-docker     → context.docker
        ├─ --skip-install             → context.install = false
        └─ --yes                      → skip ALL prompts, use defaults
        │
        ▼
prompts.js: build only the questions NOT answered by flags
        │
        ▼
inquirer.prompt(questions)  →  answers
        │
        ▼
{ ...defaults, ...answers, ...flags }   // flags win
```

`src/prompts.js` exports `collectAnswers(flags)`; it never touches the filesystem, which keeps it unit-testable.

### 4.2 Copying Template Folders

```js
import fs from "fs-extra";

// 1. Resolve template roots relative to the package (works under npx cache)
const TEMPLATE_ROOT = fileURLToPath(new URL("../templates", import.meta.url));

// 2. Refuse non-empty target unless user confirmed
if (await fs.pathExists(targetDir) && (await fs.readdir(targetDir)).length > 0) {
  throw new ScaffoldError(`Directory not empty: ${targetDir}`, "Choose an empty folder or pass --force.");
}

// 3. Layer copies
await fs.copy(path.join(TEMPLATE_ROOT, "base"), targetDir);
await fs.copy(path.join(TEMPLATE_ROOT, "overlays/db", context.database), targetDir, { overwrite: true });
if (context.docker) {
  await fs.copy(path.join(TEMPLATE_ROOT, "overlays/docker"), targetDir, { overwrite: true });
} else {
  // ensure base didn't ship docker files; strip any that did
  await fs.remove(path.join(targetDir, "docker-compose.yml"));
}
```

**Path resolution is critical:** templates must be located via `import.meta.url`, never `process.cwd()`, because `npx` runs the package from a cache directory far from the user's shell.

### 4.3 String Injection

Two mechanisms, chosen per file type:

**A. Token replacement (README, `.env`, `docker-compose.yml`)**

```js
async function inject(file, vars) {
  let content = await fs.readFile(file, "utf8");
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  await fs.writeFile(file, content, "utf8");
}
```

**B. Structured edit (`package.json`)**

Never regex JSON. Use `readJson` / `writeJson`:

```js
const pkgPath = path.join(targetDir, "backend/package.json");
const pkg = await fs.readJson(pkgPath);
pkg.name = context.projectName + "-backend";        // npm-safe: scoped naming
pkg.version = "0.1.0";
await fs.writeJson(pkgPath, pkg, { spaces: 2 });
```

Same for `frontend/package.json` (`${projectName}-frontend`) and the root `package.json` if the scaffold is a workspace root.

**Injection walk:** `src/scaffold.js` walks the copied tree once (`fs.readdir` recursive) and applies the rule table:

| Path matches | Mechanism |
|--------------|-----------|
| `**/package.json` | Structured edit (name) |
| `**/*.md`, `**/.env*`, `docker-compose*.yml` | Token replacement |
| everything else | untouched |

**Post-check:** the same walk asserts no `/\{\{[A-Z_]+\}\}/` matches remain; if found, throw (catches template bugs before users see them).

### 4.4 Executing `npm install`

```js
import { spawn } from "node:child_process";

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: context.verbose ? "inherit" : "pipe",
      shell: process.platform === "win32",   // resolves npm.cmd on Windows
      env: { ...process.env, ADBLOCK: "1", DISABLE_OPENCOLLECTURE: "1" },
    });
    let stderr = "";
    child.stderr?.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new ScaffoldError(
        `${cmd} ${args.join(" ")} exited ${code}`,
        `cd ${cwd} && ${cmd} ${args.join(" ")} — then re-run.`
      ))
    );
  });
}
```

Install targets:
- `docker: false` → `npm install` in `frontend/` and `backend/`
- workspace layout (if adopted) → single root `npm install`

`spawn` over `exec` because: (1) no 1 MB default buffer limit, (2) no shell interpolation of user-provided paths, (3) output can be streamed or captured cleanly.

### 4.5 Summary Output

`src/logger.js` owns all `ora` instances (single active spinner at a time) and exposes `printSummary(context)` which renders the next-steps block from `src/ui/theme.js`, substituting the real project name, DB choice, and Docker command.

---

## 5. Testing & Deployment

### 5.1 Local Testing with `npm link`

Standard contributor loop:

```bash
git clone <repo> && cd create-rapid-stack
npm install
npm link              # symlinks bin/ into global node_modules/.bin

# anywhere on your machine:
create-rapid-stack test-app --db mongodb --docker --skip-install
cd test-app && ls -R && cat docker-compose.yml

npm unlink --global create-rapid-stack   # cleanup
```

`npm link` creates a global symlink to the working tree, so **edits to `src/` are live** on the next invocation — no rebuild or republish step.

> During development, test against a scratch dir (e.g., `/tmp/crs-smoke`) so a buggy `remove()` can't touch real work.

### 5.2 Automated Tests

| Layer | Approach |
|-------|----------|
| Unit | Node's built-in `node:test` + `node:assert` (zero dev-dep churn) for `prompts.js` merging logic, `validate.js`, marker replacement |
| Integration | Run the real pipeline into a temp dir (`fs.mkdtemp`), assert: expected files exist, no `{{MARKERS}}` remain, `package.json` names correct, docker files present/absent per flags |
| Smoke (CI matrix) | Scaffold both DB choices × docker on/off → `npm install` → `npm run build` in generated app. Runs on Ubuntu + Windows runners |
| Lint | `eslint` + `prettier` on `bin/`, `src/`, `test/` |

**Template contract tests** are the highest-value suite: they fail the build the moment a template edit breaks injection or leaves a stale marker.

### 5.3 Versioning & Release

- **SemVer**, driven by conventional commits (`feat:` → minor, `fix:` → patch, `BREAKING CHANGE:` → major).
- `npm version minor` creates the tag; CI publishes on tag push.
- Templates ship **inside** the package (see §1.4), so a template fix is a patch release — no separate template versioning in v1.
- `.npmignore` / `files` field restricts the published tarball to `bin/`, `src/`, `templates/`, `README.md`, `LICENSE`. Tests and scratch dirs never ship.

### 5.4 Publish Strategy (npm registry)

**Pre-publish checklist:**
1. `npm test` green locally and in CI (full matrix).
2. `npm pack --dry-run` — verify tarball contents (templates included, no `.env` secrets, no `test/` fixtures).
3. Global smoke: `npm link` → scaffold all 4 combinations → generated app builds.
4. Update `CHANGELOG.md`; bump version via `npm version`.
5. Confirm package name availability: `npm view create-rapid-stack` should 404.

**Publish:**
```bash
npm login                 # or NPM_TOKEN in CI
npm publish --access public
```

**CI pipeline (tag-triggered):**
```
checkout → setup-node (18/20 matrix) → npm ci → npm test
  → npm pack --dry-run → smoke-scaffold (4 combos)
  → npm publish (with provenance: --provenance) → GitHub Release + changelog
```

**Post-publish verification:**
```bash
npx create-rapid-stack@latest verify-app
```
Run from a clean directory on a machine/runner without the repo checked out — this validates the *actual* published artifact, catching packaging mistakes that `npm link` cannot (the most common class of CLI release bug).

**Rollback:** `npm deprecate create-rapid-stack@<bad> "broken templates"` then publish a patch. Never `unpublish` versions others may have cached.
