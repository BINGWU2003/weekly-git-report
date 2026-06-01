import {
  buildProjectIndex,
  getProjectsFilePath,
  loadConfig,
  writeProjectsIndex,
} from "@weekly-git-report/core";
import { ScanProjectsInputSchema } from "@weekly-git-report/shared";

export async function runScanCommand(args: string[]): Promise<void> {
  const config = await loadConfig();
  const options = ScanProjectsInputSchema.parse(parseScanArgs(args));
  const result = await buildProjectIndex(config, options);

  await writeProjectsIndex(result.index);

  for (const warning of result.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  console.log(`Scanned projects: ${result.index.projects.length}`);
  console.log(`Projects file: ${getProjectsFilePath()}`);
}

function parseScanArgs(args: string[]): unknown {
  const roots: string[] = [];
  let maxDepth: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --root");
      }
      roots.push(value);
      index += 1;
      continue;
    }

    if (arg === "--max-depth") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --max-depth");
      }
      maxDepth = Number(value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown scan option: ${arg}`);
  }

  return {
    ...(roots.length > 0 ? { roots } : {}),
    ...(maxDepth !== undefined ? { maxDepth } : {}),
  };
}
