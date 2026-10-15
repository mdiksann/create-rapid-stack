import inquirer from "inquirer";
import { validateProjectName } from "./validate.js";

export const DEFAULTS = {
  projectName: "rapid-app",
  database: "postgres",
  docker: true,
  install: true,
  verbose: false,
  force: false,
};

/**
 * Builds the list of inquirer questions only for options not already satisfied by flags.
 * @param {object} flags
 * @param {string} [defaultProjectName]
 * @returns {Array<object>}
 */
export function buildQuestions(flags = {}, defaultProjectName = DEFAULTS.projectName) {
  const questions = [];

  if (flags.projectName === undefined) {
    questions.push({
      type: "input",
      name: "projectName",
      message: "Project name:",
      default: defaultProjectName,
      validate: (input) => validateProjectName(input),
      filter: (input) => (input ? input.trim() : ""),
    });
  }

  if (flags.database === undefined) {
    questions.push({
      type: "list",
      name: "database",
      message: "Database:",
      choices: [
        { name: "PostgreSQL (Prisma)", value: "postgres" },
        { name: "MongoDB (Prisma)", value: "mongodb" },
      ],
      default: DEFAULTS.database,
    });
  }

  if (flags.docker === undefined) {
    questions.push({
      type: "confirm",
      name: "docker",
      message: "Add Docker setup?",
      default: DEFAULTS.docker,
    });
  }

  if (flags.install === undefined) {
    questions.push({
      type: "confirm",
      name: "install",
      message: "Install dependencies now?",
      default: DEFAULTS.install,
    });
  }

  return questions;
}

/**
 * Merges defaults, inquirer answers, and commander flags (flags take highest precedence).
 * @param {object} flags
 * @param {object} answers
 * @returns {object}
 */
export function mergeAnswersAndFlags(flags = {}, answers = {}) {
  const merged = { ...DEFAULTS };

  for (const [key, val] of Object.entries(answers)) {
    if (val !== undefined) {
      merged[key] = val;
    }
  }

  for (const [key, val] of Object.entries(flags)) {
    if (val !== undefined) {
      merged[key] = val;
    }
  }

  return merged;
}

/**
 * Collects answers via Inquirer, skipping questions already provided by flags or if --yes is set.
 * @param {object} flags
 * @param {string} [defaultProjectName]
 * @returns {Promise<object>}
 */
export async function collectAnswers(flags = {}, defaultProjectName = DEFAULTS.projectName) {
  if (flags.yes) {
    return mergeAnswersAndFlags(flags, {
      projectName: flags.projectName || defaultProjectName,
    });
  }

  const questions = buildQuestions(flags, defaultProjectName);
  const answers = questions.length > 0 ? await inquirer.prompt(questions) : {};

  if (!flags.yes && questions.length > 0) {
    const summary = mergeAnswersAndFlags(flags, answers);
    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message: `Proceed with creating ${summary.projectName} (${summary.database}, Docker: ${summary.docker ? "yes" : "no"}, Install: ${summary.install ? "yes" : "no"})?`,
        default: true,
      },
    ]);

    if (!confirmed) {
      const err = new Error("Project scaffolding aborted by user.");
      err.aborted = true;
      throw err;
    }
  }

  return mergeAnswersAndFlags(flags, answers);
}

