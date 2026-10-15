import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { scaffoldFiles, walkFiles } from "../src/scaffold.js";
import { installDependencies } from "../src/install.js";
import { ScaffoldError } from "../src/errors.js";

test("scaffoldFiles handles all 4 combinations (postgres/mongodb x docker: true/false)", async () => {
  const combinations = [
    { database: "postgres", docker: true },
    { database: "postgres", docker: false },
    { database: "mongodb", docker: true },
    { database: "mongodb", docker: false },
  ];

  for (const combo of combinations) {
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `crs-scaffold-${combo.database}-${combo.docker}-`)
    );

    try {
      const projectName = `test-${combo.database}-${combo.docker ? "docker" : "nodocker"}`;
      const context = {
        projectName,
        targetDir: tmpDir,
        database: combo.database,
        docker: combo.docker,
        install: false,
        verbose: false,
        force: false,
      };

      await scaffoldFiles(context);

      // Verify root files
      assert.equal(await fs.pathExists(path.join(tmpDir, "README.md")), true);
      assert.equal(await fs.pathExists(path.join(tmpDir, ".gitignore")), true);
      assert.equal(await fs.pathExists(path.join(tmpDir, "package.json")), true);

      // Verify root package.json name
      const rootPkg = await fs.readJson(path.join(tmpDir, "package.json"));
      assert.equal(rootPkg.name, projectName);

      // Verify backend files and package name
      assert.equal(await fs.pathExists(path.join(tmpDir, "backend/src/index.js")), true);
      assert.equal(await fs.pathExists(path.join(tmpDir, "backend/prisma/schema.prisma")), true);
      const backendPkg = await fs.readJson(path.join(tmpDir, "backend/package.json"));
      assert.equal(backendPkg.name, `${projectName}-backend`);

      // Verify schema content corresponds to DB choice
      const schema = await fs.readFile(path.join(tmpDir, "backend/prisma/schema.prisma"), "utf8");
      if (combo.database === "postgres") {
        assert.match(schema, /provider = "postgresql"/);
      } else {
        assert.match(schema, /provider = "mongodb"/);
      }

      // Verify frontend files and package name
      assert.equal(await fs.pathExists(path.join(tmpDir, "frontend/app/page.js")), true);
      assert.equal(await fs.pathExists(path.join(tmpDir, "frontend/next.config.js")), true);
      const frontendPkg = await fs.readJson(path.join(tmpDir, "frontend/package.json"));
      assert.equal(frontendPkg.name, `${projectName}-frontend`);

      // Verify Docker presence / absence
      const composeExists = await fs.pathExists(path.join(tmpDir, "docker-compose.yml"));
      const backendDockerExists = await fs.pathExists(path.join(tmpDir, "backend/Dockerfile"));
      const frontendDockerExists = await fs.pathExists(path.join(tmpDir, "frontend/Dockerfile"));

      if (combo.docker) {
        assert.equal(composeExists, true);
        assert.equal(backendDockerExists, true);
        assert.equal(frontendDockerExists, true);

        const compose = await fs.readFile(path.join(tmpDir, "docker-compose.yml"), "utf8");
        if (combo.database === "postgres") {
          assert.match(compose, /image: postgres:16-alpine/);
        } else {
          assert.match(compose, /image: mongo:7/);
        }
      } else {
        assert.equal(composeExists, false);
        assert.equal(backendDockerExists, false);
        assert.equal(frontendDockerExists, false);
      }

      // Verify temporary docker-compose.db.yml is cleaned up
      assert.equal(await fs.pathExists(path.join(tmpDir, "docker-compose.db.yml")), false);

      // Verify ZERO leftover {{...}} tokens across the entire tree
      const allFiles = await walkFiles(tmpDir);
      for (const file of allFiles) {
        const content = await fs.readFile(file, "utf8");
        const leftover = content.match(/\{\{[A-Z_]+\}\}/g);
        assert.equal(
          leftover,
          null,
          `Leftover marker(s) ${leftover} found in ${path.relative(tmpDir, file)}`
        );
      }
    } finally {
      await fs.remove(tmpDir);
    }
  }
});

test("scaffoldFiles refuses non-empty directory without force", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crs-guard-"));
  try {
    await fs.writeFile(path.join(tmpDir, "existing.txt"), "precious data");
    const context = {
      projectName: "guard-test",
      targetDir: tmpDir,
      database: "postgres",
      docker: true,
      install: false,
      force: false,
    };

    await assert.rejects(
      () => scaffoldFiles(context),
      (err) => {
        assert(err instanceof ScaffoldError);
        assert.match(err.message, /Directory not empty/);
        return true;
      }
    );
  } finally {
    await fs.remove(tmpDir);
  }
});

test("installDependencies calls spawn for root, backend, and frontend", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crs-install-test-"));
  try {
    await fs.writeJson(path.join(tmpDir, "package.json"), { name: "root" });
    await fs.ensureDir(path.join(tmpDir, "backend"));
    await fs.writeJson(path.join(tmpDir, "backend/package.json"), { name: "b" });
    await fs.ensureDir(path.join(tmpDir, "frontend"));
    await fs.writeJson(path.join(tmpDir, "frontend/package.json"), { name: "f" });

    const calls = [];
    const mockSpawn = async (cmd, args, cwd) => {
      calls.push({ cmd, args, cwd });
    };

    const context = {
      targetDir: tmpDir,
      install: true,
      verbose: false,
    };

    await installDependencies(context, mockSpawn);

    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0], { cmd: "npm", args: ["install"], cwd: tmpDir });
    assert.deepEqual(calls[1], {
      cmd: "npm",
      args: ["install"],
      cwd: path.join(tmpDir, "backend"),
    });
    assert.deepEqual(calls[2], {
      cmd: "npm",
      args: ["install"],
      cwd: path.join(tmpDir, "frontend"),
    });
  } finally {
    await fs.remove(tmpDir);
  }
});

test("installDependencies does nothing when install is false", async () => {
  const calls = [];
  const mockSpawn = async (cmd, args, cwd) => {
    calls.push({ cmd, args, cwd });
  };

  await installDependencies({ install: false }, mockSpawn);
  assert.equal(calls.length, 0);
});
