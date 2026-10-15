import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "fs-extra";

const execFileAsync = promisify(execFile);
const binPath = fileURLToPath(new URL("../bin/index.js", import.meta.url));

test("CLI parses flags fully and scaffolds with JSON output", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crs-cli-test-"));
  const targetAppDir = path.join(tmpDir, "my-app");

  try {
    const args = [binPath, targetAppDir, "--db", "postgres", "--docker", "--skip-install", "-y"];

    const { stdout } = await execFileAsync(process.execPath, args);
    const context = JSON.parse(stdout.trim());

    assert.equal(context.projectName, path.basename(targetAppDir));
    assert.equal(context.database, "postgres");
    assert.equal(context.docker, true);
    assert.equal(context.install, false);
    assert.equal(context.flagsProvided, true);
    assert.equal(await fs.pathExists(path.join(targetAppDir, "package.json")), true);
  } finally {
    await fs.remove(tmpDir);
  }
});

test("CLI handles mongodb and --no-docker with --skip-install", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crs-cli-mongo-"));
  const targetAppDir = path.join(tmpDir, "mongo-test-app");

  try {
    const args = [binPath, targetAppDir, "--db", "mongodb", "--no-docker", "--skip-install", "-y"];

    const { stdout } = await execFileAsync(process.execPath, args);
    const context = JSON.parse(stdout.trim());

    assert.equal(context.projectName, "mongo-test-app");
    assert.equal(context.database, "mongodb");
    assert.equal(context.docker, false);
    assert.equal(context.install, false);
    assert.equal(await fs.pathExists(path.join(targetAppDir, "docker-compose.yml")), false);
  } finally {
    await fs.remove(tmpDir);
  }
});

test("CLI with -y/--yes defaults properly", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crs-cli-quick-"));
  const targetAppDir = path.join(tmpDir, "quick-app");

  try {
    const args = [binPath, targetAppDir, "-y", "--skip-install"];

    const { stdout } = await execFileAsync(process.execPath, args);
    const context = JSON.parse(stdout.trim());

    assert.equal(context.projectName, "quick-app");
    assert.equal(context.database, "postgres");
    assert.equal(context.docker, true);
    assert.equal(context.install, false);
  } finally {
    await fs.remove(tmpDir);
  }
});

test("CLI errors on invalid project name with clear hint", async () => {
  const args = [binPath, "INVALID_NAME", "--skip-install", "-y"];

  await assert.rejects(
    () => execFileAsync(process.execPath, args),
    (err) => {
      assert.equal(err.code, 1);
      assert.match(err.stderr, /Invalid project name/);
      assert.match(err.stderr, /Hint:/);
      return true;
    }
  );
});
