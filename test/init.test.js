import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const binPath = fileURLToPath(new URL("../bin/index.js", import.meta.url));

test("CLI --help prints usage information", async () => {
  const { stdout } = await execFileAsync(process.execPath, [binPath, "--help"]);
  assert.match(stdout, /Usage: create-rapid-stack/);
  assert.match(stdout, /Single-command scaffolding tool/);
});

test("CLI --version prints package version", async () => {
  const { stdout } = await execFileAsync(process.execPath, [binPath, "--version"]);
  assert.equal(stdout.trim(), "0.1.0");
});
