#!/usr/bin/env node
import chalk from "chalk";
import { run } from "../src/cli.js";

run(process.argv).catch((err) => {
  if (err.aborted) {
    console.log(chalk.yellow("\nOperation cancelled."));
    process.exit(130);
  }

  console.error(chalk.red(`\n✖ ${err.message}`));
  if (err.hint) {
    console.error(chalk.cyan(`  Hint: ${err.hint}`));
  }
  process.exit(1);
});
