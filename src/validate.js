import validateNpmName from "validate-npm-package-name";
import fs from "fs-extra";
import path from "node:path";
import { ScaffoldError } from "./errors.js";

/**
 * Validates a project name against npm naming rules.
 * @param {string} name
 * @returns {true|string} true if valid, error message otherwise
 */
export function validateProjectName(name) {
  if (!name || typeof name !== "string") {
    return "Project name is required.";
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "Project name cannot be empty.";
  }

  const result = validateNpmName(trimmed);
  if (!result.validForNewPackages) {
    const errors = [...(result.errors || []), ...(result.warnings || [])];
    return `Invalid project name "${trimmed}": ${errors.join(", ")}`;
  }

  return true;
}

/**
 * Validates that the target directory is empty or can be overwritten.
 * @param {string} targetDir
 * @param {boolean} force
 */
export async function validateTargetDirectory(targetDir, force = false) {
  const exists = await fs.pathExists(targetDir);
  if (!exists) {
    return true;
  }

  const stat = await fs.stat(targetDir);
  if (!stat.isDirectory()) {
    throw new ScaffoldError(
      `Target path exists and is not a directory: ${targetDir}`,
      "Please specify a different project name or directory path."
    );
  }

  const contents = await fs.readdir(targetDir);
  if (contents.length > 0 && !force) {
    throw new ScaffoldError(
      `Directory not empty: ${targetDir}`,
      "Choose an empty folder, pass a different name, or use --force."
    );
  }

  return true;
}

/**
 * Resolves project name and target directory from input.
 * @param {string} [inputName]
 * @param {string} [cwd=process.cwd()]
 * @returns {{ projectName: string, targetDir: string }}
 */
export function resolveTarget(inputName, cwd = process.cwd()) {
  const projectName = (inputName || path.basename(cwd) || "rapid-app").trim();
  const targetDir = inputName ? path.resolve(cwd, inputName) : cwd;
  return { projectName, targetDir };
}

