import { Command } from "commander";
import fs from "fs-extra";
import { fileURLToPath } from "node:url";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
const pkg = fs.readJsonSync(pkgPath);

export async function run(argv = process.argv) {
  const program = new Command();

  program
    .name("create-rapid-stack")
    .description(pkg.description)
    .version(pkg.version)
    .argument("[project-name]", "Name of the project to scaffold")
    .action(() => {
      console.log("create-rapid-stack initialized.");
    });

  await program.parseAsync(argv);
}

