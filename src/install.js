import { spawn } from "node:child_process";
import fs from "fs-extra";
import path from "node:path";
import { ScaffoldError } from "./errors.js";

/**
 * Runs a shell command inside cwd using child_process.spawn.
 * @param {string} cmd
 * @param {string[]} args
 * @param {string} cwd
 * @param {boolean} verbose
 * @returns {Promise<void>}
 */
export function runSpawn(cmd, args, cwd, verbose = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: verbose ? "inherit" : "pipe",
      shell: process.platform === "win32",
      env: { ...process.env, ADBLOCK: "1", DISABLE_OPENCOLLECTURE: "1" },
    });

    let stderr = "";
    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", (err) => {
      reject(
        new ScaffoldError(
          `Failed to start ${cmd}: ${err.message}`,
          `Ensure ${cmd} is installed and available in your PATH.`
        )
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const stderrSnippet = stderr.trim().split("\n").slice(-8).join("\n");
        const hint = `cd ${cwd} && ${cmd} ${args.join(" ")}\n${stderrSnippet ? `\nError tail:\n${stderrSnippet}` : ""}`;
        reject(
          new ScaffoldError(`Command "${cmd} ${args.join(" ")}" exited with code ${code}`, hint)
        );
      }
    });
  });
}

/**
 * Installs dependencies across the scaffolded project workspaces.
 * @param {object} context
 * @param {function} [spawnFn] - Optional mockable spawn runner
 * @returns {Promise<void>}
 */
export async function installDependencies(context, spawnFn = runSpawn) {
  if (!context.install) {
    return;
  }

  const { targetDir, verbose } = context;

  // Root install if root package.json exists
  if (await fs.pathExists(path.join(targetDir, "package.json"))) {
    await spawnFn("npm", ["install"], targetDir, verbose);
  }

  // Backend install
  const backendDir = path.join(targetDir, "backend");
  if (await fs.pathExists(path.join(backendDir, "package.json"))) {
    await spawnFn("npm", ["install"], backendDir, verbose);
  }

  // Frontend install
  const frontendDir = path.join(targetDir, "frontend");
  if (await fs.pathExists(path.join(frontendDir, "package.json"))) {
    await spawnFn("npm", ["install"], frontendDir, verbose);
  }
}
