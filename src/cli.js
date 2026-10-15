import { Command, Option } from "commander";
import fs from "fs-extra";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectAnswers } from "./prompts.js";
import { validateProjectName, validateTargetDirectory, resolveTarget } from "./validate.js";
import { ScaffoldError } from "./errors.js";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
const pkg = fs.readJsonSync(pkgPath);

/**
 * Creates and configures the Commander program.
 * @returns {Command}
 */
export function createProgram() {
  const program = new Command();

  program
    .name("create-rapid-stack")
    .description(pkg.description)
    .version(pkg.version, "-V, --version", "output the version number")
    .argument("[project-name]", "Name of the project to scaffold")
    .addOption(
      new Option("--db <database>", "Database engine to use").choices(["postgres", "mongodb"])
    )
    .option("--docker", "Include Docker configuration")
    .option("--no-docker", "Exclude Docker configuration")
    .option("--skip-install", "Skip dependency installation")
    .option("-y, --yes", "Skip interactive prompts and use default options")
    .option("--verbose", "Show verbose output")
    .option("-f, --force", "Overwrite existing directory files if non-empty");

  return program;
}

/**
 * Main orchestration entry point.
 * @param {string[]} [argv=process.argv]
 * @returns {Promise<object>} The resolved context object
 */
export async function run(argv = process.argv) {
  const program = createProgram();

  let parsedArg = null;
  let parsedOpts = {};

  program.action((projectName, options) => {
    parsedArg = projectName;
    parsedOpts = options;
  });

  await program.parseAsync(argv);

  const flags = {};
  if (parsedArg !== null && parsedArg !== undefined) {
    flags.projectName = parsedArg;
  }
  if (parsedOpts.db !== undefined) {
    flags.database = parsedOpts.db;
  }
  if (parsedOpts.docker !== undefined) {
    flags.docker = parsedOpts.docker;
  }
  if (parsedOpts.skipInstall !== undefined) {
    flags.install = !parsedOpts.skipInstall;
  }
  if (parsedOpts.yes !== undefined) {
    flags.yes = Boolean(parsedOpts.yes);
  }
  if (parsedOpts.verbose !== undefined) {
    flags.verbose = Boolean(parsedOpts.verbose);
  }
  if (parsedOpts.force !== undefined) {
    flags.force = Boolean(parsedOpts.force);
  }

  // Determine initial fallback name from argument or current working directory
  const { projectName: initialName, targetDir } = resolveTarget(flags.projectName, process.cwd());

  // Collect and merge answers with flags
  const answers = await collectAnswers(flags, initialName);

  const finalProjectName = answers.projectName || initialName;
  const nameValidation = validateProjectName(finalProjectName);
  if (nameValidation !== true) {
    throw new ScaffoldError(
      nameValidation,
      "Provide a valid npm package name (lowercase, no spaces, url-safe)."
    );
  }

  const finalTargetDir = flags.projectName
    ? path.resolve(process.cwd(), finalProjectName)
    : targetDir;

  await validateTargetDirectory(finalTargetDir, answers.force);

  const context = {
    projectName: finalProjectName,
    targetDir: finalTargetDir,
    database: answers.database,
    docker: answers.docker,
    install: answers.install,
    verbose: answers.verbose,
    force: answers.force,
    flagsProvided: Object.keys(flags).length > 0,
  };

  // Phase 3 exit criteria: print resolved context as JSON
  console.log(JSON.stringify(context, null, 2));

  return context;
}
