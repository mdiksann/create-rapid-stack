import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const binPath = fileURLToPath(new URL("../bin/index.js", import.meta.url));

test("CLI parses flags fully and prints resolved context as JSON without file writes", async () => {
  const args = [binPath, "my-app", "--db", "postgres", "--docker", "--skip-install"];

  const { stdout } = await execFileAsync(process.execPath, args);
  const context = JSON.parse(stdout.trim());

  assert.equal(context.projectName, "my-app");
  assert.equal(context.database, "postgres");
  assert.equal(context.docker, true);
  assert.equal(context.install, false);
  assert.equal(context.flagsProvided, true);
  assert(context.targetDir.endsWith("/my-app"));
});

test("CLI handles mongodb and --no-docker with --skip-install", async () => {
  const args = [binPath, "mongo-test-app", "--db", "mongodb", "--no-docker", "--skip-install"];

  const { stdout } = await execFileAsync(process.execPath, args);
  const context = JSON.parse(stdout.trim());

  assert.equal(context.projectName, "mongo-test-app");
  assert.equal(context.database, "mongodb");
  assert.equal(context.docker, false);
  assert.equal(context.install, false);
});

test("CLI with -y/--yes defaults properly", async () => {
  const args = [binPath, "quick-app", "-y"];

  const { stdout } = await execFileAsync(process.execPath, args);
  const context = JSON.parse(stdout.trim());

  assert.equal(context.projectName, "quick-app");
  assert.equal(context.database, "postgres");
  assert.equal(context.docker, true);
  assert.equal(context.install, true);
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
