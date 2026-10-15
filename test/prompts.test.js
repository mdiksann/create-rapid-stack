import test from "node:test";
import assert from "node:assert/strict";
import { buildQuestions, mergeAnswersAndFlags, collectAnswers, DEFAULTS } from "../src/prompts.js";

test("buildQuestions generates all 4 questions when no flags provided", () => {
  const questions = buildQuestions({});
  assert.equal(questions.length, 4);
  const names = questions.map((q) => q.name);
  assert.deepEqual(names, ["projectName", "database", "docker", "install"]);
});

test("buildQuestions skips questions for values provided by flags", () => {
  const questions = buildQuestions({
    projectName: "my-custom-app",
    database: "mongodb",
  });
  assert.equal(questions.length, 2);
  const names = questions.map((q) => q.name);
  assert.deepEqual(names, ["docker", "install"]);
});

test("buildQuestions skips all questions when all flags are provided", () => {
  const questions = buildQuestions({
    projectName: "app",
    database: "postgres",
    docker: false,
    install: false,
  });
  assert.equal(questions.length, 0);
});

test("mergeAnswersAndFlags gives precedence to commander flags over prompt answers", () => {
  const flags = {
    database: "mongodb",
    docker: false,
  };
  const answers = {
    projectName: "user-input-app",
    database: "postgres", // Answer conflicts with flag
    docker: true, // Answer conflicts with flag
    install: true,
  };

  const result = mergeAnswersAndFlags(flags, answers);
  assert.equal(result.projectName, "user-input-app");
  assert.equal(result.database, "mongodb"); // Flag wins
  assert.equal(result.docker, false); // Flag wins
  assert.equal(result.install, true);
});

test("collectAnswers with --yes skips prompts and applies defaults", async () => {
  const flags = {
    yes: true,
    projectName: "fast-scaffold",
  };

  const result = await collectAnswers(flags, "fast-scaffold");
  assert.equal(result.projectName, "fast-scaffold");
  assert.equal(result.database, DEFAULTS.database);
  assert.equal(result.docker, DEFAULTS.docker);
  assert.equal(result.install, DEFAULTS.install);
});
