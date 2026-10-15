import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { validateProjectName, validateTargetDirectory, resolveTarget } from "../src/validate.js";
import { ScaffoldError } from "../src/errors.js";

test("validateProjectName accepts valid npm package names", () => {
  assert.equal(validateProjectName("my-app"), true);
  assert.equal(validateProjectName("rapid-stack_2"), true);
  assert.equal(validateProjectName("cool.service"), true);
});

test("validateProjectName rejects invalid package names", () => {
  assert.match(String(validateProjectName("")), /required|empty/);
  assert.match(String(validateProjectName("   ")), /required|empty/);
  assert.match(String(validateProjectName("My-App")), /Invalid project name/);
  assert.match(String(validateProjectName("app with spaces")), /Invalid project name/);
});

test("validateTargetDirectory allows non-existent directories", async () => {
  const tmpDir = path.join(os.tmpdir(), `crs-non-existent-${Date.now()}`);
  const result = await validateTargetDirectory(tmpDir, false);
  assert.equal(result, true);
});

test("validateTargetDirectory allows empty directories", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crs-empty-"));
  try {
    const result = await validateTargetDirectory(tmpDir, false);
    assert.equal(result, true);
  } finally {
    await fs.remove(tmpDir);
  }
});

test("validateTargetDirectory throws ScaffoldError for non-empty directories unless force is true", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "crs-nonempty-"));
  try {
    await fs.writeFile(path.join(tmpDir, "file.txt"), "hello");
    await assert.rejects(
      () => validateTargetDirectory(tmpDir, false),
      (err) => {
        assert(err instanceof ScaffoldError);
        assert.match(err.message, /Directory not empty/);
        assert.match(err.hint, /--force/);
        return true;
      }
    );

    const forced = await validateTargetDirectory(tmpDir, true);
    assert.equal(forced, true);
  } finally {
    await fs.remove(tmpDir);
  }
});

test("resolveTarget resolves targetDir and default projectName", () => {
  const { projectName, targetDir } = resolveTarget("test-project", "/tmp");
  assert.equal(projectName, "test-project");
  assert.equal(targetDir, "/tmp/test-project");
});
