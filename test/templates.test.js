import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";

const TEMPLATE_ROOT = fileURLToPath(new URL("../templates", import.meta.url));
const ALLOWED_MARKER_FILES = new Set([
  "README.md",
  "package.json",
  ".env",
  ".env.example",
  "backend.env",
  "frontend.env",
  "docker-compose.yml",
  "docker-compose.db.yml",
]);

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

test("All required template files exist in base, db overlays, and docker overlay", async () => {
  const requiredPaths = [
    "base/README.md",
    "base/.gitignore",
    "base/package.json",
    "base/backend/package.json",
    "base/backend/src/index.js",
    "base/backend/src/prisma/client.js",
    "base/backend/src/routes/items.js",
    "base/backend/.env.example",
    "base/frontend/package.json",
    "base/frontend/next.config.js",
    "base/frontend/app/layout.js",
    "base/frontend/app/page.js",
    "base/frontend/app/api/health/route.js",
    "base/frontend/components/StatusCard.js",
    "base/frontend/.env.example",
    "overlays/db/postgres/backend/prisma/schema.prisma",
    "overlays/db/postgres/backend/prisma/seed.js",
    "overlays/db/postgres/docker-compose.db.yml",
    "overlays/db/postgres/backend/.env",
    "overlays/db/mongodb/backend/prisma/schema.prisma",
    "overlays/db/mongodb/backend/prisma/seed.js",
    "overlays/db/mongodb/docker-compose.db.yml",
    "overlays/db/mongodb/backend/.env",
    "overlays/docker/frontend/Dockerfile",
    "overlays/docker/backend/Dockerfile",
    "overlays/docker/docker-compose.yml",
    "overlays/docker/.dockerignore",
  ];

  for (const relPath of requiredPaths) {
    const fullPath = path.join(TEMPLATE_ROOT, relPath);
    const exists = await fs.pathExists(fullPath);
    assert.equal(exists, true, `Expected template file to exist: ${relPath}`);
  }
});

test("Markers only appear in allowed configuration/documentation files", async () => {
  const allFiles = await walkFiles(TEMPLATE_ROOT);
  const markerRegex = /\{\{[A-Z_]+\}\}/g;

  for (const file of allFiles) {
    const content = await fs.readFile(file, "utf8");
    const matches = content.match(markerRegex);
    if (matches) {
      const baseName = path.basename(file);
      assert.equal(
        ALLOWED_MARKER_FILES.has(baseName),
        true,
        `Forbidden marker ${matches.join(", ")} found in ${path.relative(TEMPLATE_ROOT, file)}`
      );
    }
  }
});

test("Manual overlay copy and marker replacement leaves zero {{...}} tokens for both DB variants", async () => {
  for (const db of ["postgres", "mongodb"]) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `crs-template-${db}-`));

    try {
      await fs.copy(path.join(TEMPLATE_ROOT, "base"), tmpDir);
      await fs.copy(path.join(TEMPLATE_ROOT, "overlays/db", db), tmpDir, {
        overwrite: true,
      });
      await fs.copy(path.join(TEMPLATE_ROOT, "overlays/docker"), tmpDir, {
        overwrite: true,
      });

      const dbServiceBlock = (
        await fs.readFile(
          path.join(TEMPLATE_ROOT, "overlays/db", db, "docker-compose.db.yml"),
          "utf8"
        )
      ).trimEnd();
      await fs.remove(path.join(tmpDir, "docker-compose.db.yml"));

      const vars = {
        PROJECT_NAME: `sample-${db}-app`,
        PORT: "4000",
        API_URL: "http://localhost:4000",
        NEXT_PUBLIC_API_URL: "http://localhost:4000",
        DATABASE_URL:
          db === "postgres"
            ? "postgresql://postgres:postgres@localhost:5432/app_db?schema=public"
            : "mongodb://mongo:mongo@localhost:27017/app_db?authSource=admin",
        DATABASE_SERVICE: dbServiceBlock,
      };

      const files = await walkFiles(tmpDir);
      for (const file of files) {
        const base = path.basename(file);
        if (
          base === "package.json" ||
          base.endsWith(".md") ||
          base.startsWith(".env") ||
          base.startsWith("docker-compose")
        ) {
          let content = await fs.readFile(file, "utf8");
          for (const [k, v] of Object.entries(vars)) {
            content = content.replaceAll(`{{${k}}}`, v);
          }
          await fs.writeFile(file, content, "utf8");
        }
      }

      // Assert zero leftover markers
      for (const file of files) {
        const content = await fs.readFile(file, "utf8");
        const leftover = content.match(/\{\{[A-Z_]+\}\}/g);
        assert.equal(
          leftover,
          null,
          `Leftover marker(s) ${leftover} in ${path.relative(tmpDir, file)} for ${db}`
        );
      }

      // Verify docker-compose contains the database service block
      const composeContent = await fs.readFile(path.join(tmpDir, "docker-compose.yml"), "utf8");
      if (db === "postgres") {
        assert.match(composeContent, /image: postgres:16-alpine/);
      } else {
        assert.match(composeContent, /image: mongo:7/);
      }
    } finally {
      await fs.remove(tmpDir);
    }
  }
});
