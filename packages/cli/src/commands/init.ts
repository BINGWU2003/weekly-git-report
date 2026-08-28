import {
  ConfigNotFoundError,
  ProjectsIndexNotFoundError,
  createDefaultConfig,
  getConfigFilePath,
  getProjectsFilePath,
  initConfig,
  loadConfig,
  loadProjectsIndex,
  writeConfig,
  writeProjectsIndex,
} from "@weekly-git-report/core";
import type { Config, Identity } from "@weekly-git-report/shared";

import { runAddProjectCommand } from "./projects.js";
import { intro, outro, promptOptions, prompts } from "../utils/prompt.js";

export async function runInitCommand(): Promise<void> {
  assertInteractive();
  let existing: Config | undefined;

  try {
    existing = await loadConfig();
  } catch (error) {
    if (!(error instanceof ConfigNotFoundError)) throw error;
  }

  if (existing) {
    const createdProjects = await ensureProjectsIndex();
    const result = await initConfig(existing);

    if (result.createdSummaryTemplate) {
      console.log(`Summary template: ${result.summaryTemplateFile}`);
    }

    if (!createdProjects) {
      console.log(`Configuration already initialized: ${getConfigFilePath()}`);
      console.log(`Default identity: ${formatIdentities(existing.identities)}`);
      return;
    }

    console.log(`Projects: ${getProjectsFilePath()}`);
    await promptAddRepository();
    return;
  }

  intro("weekly-git-report setup");
  const config = await promptConfig(createDefaultConfig());
  await writeConfig(config);
  await ensureProjectsIndex();
  const result = await initConfig(config);

  console.log(`Config: ${result.configFile}`);
  console.log(`Projects: ${getProjectsFilePath()}`);
  console.log(`Output root: ${result.outputRoot}`);
  console.log(`Summary template: ${result.summaryTemplateFile}`);
  outro("Configuration initialized.");

  await promptAddRepository();
}

async function ensureProjectsIndex(): Promise<boolean> {
  try {
    await loadProjectsIndex();
    return false;
  } catch (error) {
    if (!(error instanceof ProjectsIndexNotFoundError)) throw error;
  }

  await writeProjectsIndex({ projects: [] });
  return true;
}

async function promptAddRepository(): Promise<void> {
  const answer = await prompts(
    {
      type: "confirm",
      name: "add",
      message: "Add a repository now?",
      initial: true,
    },
    promptOptions(),
  );
  if (answer.add) await runAddProjectCommand();
}

export async function runEditConfigCommand(): Promise<void> {
  assertInteractive();
  const config = await loadConfig();
  intro("edit global configuration");
  const updated = await promptConfig(config);
  await writeConfig(updated);
  await initConfig(updated);
  outro(`Updated ${getConfigFilePath()}`);
}

export async function promptIdentities(
  initial: Identity[] = [],
  label = "Git identity",
): Promise<Identity[]> {
  const identities: Identity[] = [];
  let index = 0;
  let addMore = true;

  while (addMore) {
    const current = initial[index];
    const answer = await prompts(
      [
        {
          type: "text",
          name: "name",
          message: `${label} name`,
          initial: current?.name ?? "",
          validate: (value: string) => (value.trim() ? true : "Name is required"),
        },
        {
          type: "text",
          name: "email",
          message: `${label} email`,
          initial: current?.email ?? "",
          validate: (value: string) =>
            /^\S+@\S+\.\S+$/.test(value.trim()) || "Valid email is required",
        },
      ],
      promptOptions(),
    );
    identities.push({
      name: String(answer.name).trim(),
      email: String(answer.email).trim(),
    });
    index += 1;

    const more = await prompts(
      {
        type: "confirm",
        name: "value",
        message: "Add another identity?",
        initial: index < initial.length,
      },
      promptOptions(),
    );
    addMore = Boolean(more.value);
  }

  return identities;
}

export function assertInteractive(): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("This command requires an interactive terminal.");
  }
}

async function promptConfig(initial: Config): Promise<Config> {
  const answer = await prompts(
    [
      {
        type: "text",
        name: "outputRoot",
        message: "Weekly report output root",
        initial: initial.outputRoot,
        validate: (value: string) => (value.trim() ? true : "Output root is required"),
      },
      {
        type: "text",
        name: "repositoryCacheRoot",
        message: "Repository cache root",
        initial: initial.repositoryCacheRoot,
        validate: (value: string) => (value.trim() ? true : "Cache root is required"),
      },
      {
        type: "confirm",
        name: "includeEmptyProjects",
        message: "Include projects without matching commits?",
        initial: initial.includeEmptyProjects,
      },
    ],
    promptOptions(),
  );
  const identities = await promptIdentities(initial.identities, "Default Git identity");

  return {
    ...initial,
    outputRoot: String(answer.outputRoot).trim(),
    repositoryCacheRoot: String(answer.repositoryCacheRoot).trim(),
    includeEmptyProjects: Boolean(answer.includeEmptyProjects),
    identities,
  };
}

function formatIdentities(identities: Identity[]): string {
  return identities.map((identity) => `${identity.name} <${identity.email}>`).join(", ");
}
