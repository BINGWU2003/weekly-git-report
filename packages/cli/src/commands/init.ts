import { initConfig } from "@weekly-git-report/core";

export async function runInitCommand(): Promise<void> {
  const result = await initConfig();

  if (result.createdConfig) {
    console.log(`Created config: ${result.configFile}`);
  } else {
    console.log(`Config already exists: ${result.configFile}`);
  }

  console.log(`Work dir: ${result.workDir}`);
  console.log(`Output root: ${result.outputRoot}`);
  console.log(`Raw dir: ${result.rawDir}`);
  console.log(`Summary dir: ${result.summaryDir}`);
}
