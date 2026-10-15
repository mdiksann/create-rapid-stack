import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ScaffoldError } from "./errors.js";

export const MARKERS = [
  "PROJECT_NAME",
  "DATABASE_URL",
  "DATABASE_SERVICE",
  "NEXT_PUBLIC_API_URL",
  "API_URL",
  "PORT",
];

export const TEMPLATE_ROOT = fileURLToPath(new URL("../templates", import.meta.url));

/**
 * Returns default database URL connection string based on db choice.
 * @param {string} database
 * @returns {string}
 */
export function getDefaultDatabaseUrl(database) {
  if (database === "mongodb") {
    return "mongodb://mongo:mongo@localhost:27017/app_db?authSource=admin";
  }
  return "postgresql://postgres:postgres@localhost:5432/app_db?schema=public";
}

/**
 * Recursively lists all file paths in a directory.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
export async function walkFiles(dir) {
  if (!(await fs.pathExists(dir))) {
    return [];
  }
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

/**
 * Scaffolds project files into target directory according to context.
 * @param {object} context
 * @returns {Promise<void>}
 */
export async function scaffoldFiles(context) {
  const { projectName, targetDir, database, docker, force } = context;

  // 1. Target directory validation
  const exists = await fs.pathExists(targetDir);
  if (exists) {
    const contents = await fs.readdir(targetDir);
    if (contents.length > 0 && !force) {
      throw new ScaffoldError(
        `Directory not empty: ${targetDir}`,
        "Choose an empty folder, pass a different name, or use --force."
      );
    }
  } else {
    await fs.ensureDir(targetDir);
  }

  try {
    // 2. Layer 1: Base templates
    await fs.copy(path.join(TEMPLATE_ROOT, "base"), targetDir);

    // 3. Layer 2: Database overlay
    const dbOverlayPath = path.join(TEMPLATE_ROOT, "overlays/db", database);
    if (await fs.pathExists(dbOverlayPath)) {
      await fs.copy(dbOverlayPath, targetDir, { overwrite: true });
    }

    // 4. Layer 3: Docker overlay or cleanup
    if (docker) {
      const dockerOverlayPath = path.join(TEMPLATE_ROOT, "overlays/docker");
      await fs.copy(dockerOverlayPath, targetDir, { overwrite: true });

      // Compose DATABASE_SERVICE substitution
      const dbComposeFile = path.join(targetDir, "docker-compose.db.yml");
      let dbServiceBlock = "";
      if (await fs.pathExists(dbComposeFile)) {
        dbServiceBlock = (await fs.readFile(dbComposeFile, "utf8")).trimEnd();
        await fs.remove(dbComposeFile);
      }

      const mainComposeFile = path.join(targetDir, "docker-compose.yml");
      if (await fs.pathExists(mainComposeFile)) {
        let composeContent = await fs.readFile(mainComposeFile, "utf8");
        composeContent = composeContent.replace("{{DATABASE_SERVICE}}", dbServiceBlock);
        await fs.writeFile(mainComposeFile, composeContent, "utf8");
      }
    } else {
      // Remove any Docker-related artifacts if docker is false
      const dockerFiles = [
        path.join(targetDir, "docker-compose.yml"),
        path.join(targetDir, "docker-compose.db.yml"),
        path.join(targetDir, ".dockerignore"),
        path.join(targetDir, "frontend/Dockerfile"),
        path.join(targetDir, "frontend/.dockerignore"),
        path.join(targetDir, "backend/Dockerfile"),
        path.join(targetDir, "backend/.dockerignore"),
      ];
      for (const f of dockerFiles) {
        if (await fs.pathExists(f)) {
          await fs.remove(f);
        }
      }
    }

    // 5. Build marker replacements map
    const vars = {
      PROJECT_NAME: projectName,
      DATABASE_URL: getDefaultDatabaseUrl(database),
      NEXT_PUBLIC_API_URL: "http://localhost:4000",
      API_URL: "http://localhost:4000",
      PORT: "4000",
    };

    // 6. Tree walk: apply structured edits to package.json and token replacements to configs/docs
    const allFiles = await walkFiles(targetDir);

    for (const file of allFiles) {
      const base = path.basename(file);

      if (base === "package.json") {
        const pkg = await fs.readJson(file);
        if (file.includes(path.join(targetDir, "backend"))) {
          pkg.name = `${projectName}-backend`;
        } else if (file.includes(path.join(targetDir, "frontend"))) {
          pkg.name = `${projectName}-frontend`;
        } else {
          pkg.name = projectName;
        }
        await fs.writeJson(file, pkg, { spaces: 2 });
      } else if (
        base.endsWith(".md") ||
        base.startsWith(".env") ||
        base.startsWith("docker-compose")
      ) {
        let content = await fs.readFile(file, "utf8");
        for (const [key, value] of Object.entries(vars)) {
          content = content.replaceAll(`{{${key}}}`, value);
        }
        await fs.writeFile(file, content, "utf8");
      }
    }

    // 7. Post-injection assertion: zero leftover {{...}} tokens
    const refreshedFiles = await walkFiles(targetDir);
    for (const file of refreshedFiles) {
      const content = await fs.readFile(file, "utf8");
      const leftover = content.match(/\{\{[A-Z_]+\}\}/g);
      if (leftover) {
        throw new ScaffoldError(
          `Scaffold template error: leftover marker(s) ${leftover.join(", ")} found in ${path.relative(targetDir, file)}`,
          "Check template files for unregistered or missing marker variables."
        );
      }
    }
  } catch (err) {
    throw err;
  }
}
