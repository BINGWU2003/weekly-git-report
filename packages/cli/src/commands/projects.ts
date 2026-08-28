import {
  getDefaultRepositoryPath,
  getRepositoryId,
  getRepositoryName,
  inspectRemoteRepository,
  loadConfig,
  loadProjectsIndex,
  loadProjectsIndexSnapshot,
  normalizeAbsolutePath,
  normalizeRepositoryUrl,
  removeRepositoryProject,
  syncRepositories,
  syncRepository,
  writeProjectsIndex,
} from "@weekly-git-report/core";
import type { Config, Identity, RepositoryProject } from "@weekly-git-report/shared";

import { assertInteractive, promptIdentities } from "./init.js";
import { intro, outro, promptOptions, prompts } from "../utils/prompt.js";

export async function runAddProjectCommand(): Promise<void> {
  assertInteractive();
  const config = await loadConfig();
  const index = await loadProjectsIndex();
  intro("add repository");
  const repository = await promptProject(config);
  assertUniqueProject(repository, index.projects);
  await confirmProject(repository);
  await syncRepository(repository);
  await writeProjectsIndex({
    ...index,
    projects: [...index.projects, repository],
  });
  outro(`Added ${repository.name}: ${repository.localPath}`);
}

export async function runEditProjectCommand(): Promise<void> {
  assertInteractive();
  const config = await loadConfig();
  const index = await loadProjectsIndex();
  const current = await selectProject(index.projects, "Repository to edit");
  const repository = await promptProject(config, current);
  assertUniqueProject(
    repository,
    index.projects.filter((item) => item.id !== current.id),
  );
  await confirmProject(repository);
  await syncRepository(repository);
  await writeProjectsIndex({
    ...index,
    projects: index.projects.map((item) => (item.id === current.id ? repository : item)),
  });
  outro(`Updated ${repository.name}`);
}

export async function runRemoveProjectCommand(): Promise<void> {
  assertInteractive();
  const config = await loadConfig();
  const snapshot = await loadProjectsIndexSnapshot();
  const repository = await selectProject(snapshot.index.projects, "Repository to remove");
  const cacheAnswer = await prompts(
    {
      type: "confirm",
      name: "deleteCache",
      message: "Also permanently delete the bare Git cache?",
      initial: false,
    },
    promptOptions(),
  );
  const deleteCache = Boolean(cacheAnswer.deleteCache);
  const confirmAnswer = await prompts(
    {
      type: "confirm",
      name: "remove",
      message: deleteCache
        ? `Permanently delete ${repository.localPath} and remove ${repository.name}?`
        : `Remove ${repository.name} from projects.json? Local files will be kept.`,
      initial: false,
    },
    promptOptions(),
  );
  if (!confirmAnswer.remove) return;

  await removeRepositoryProject({
    id: repository.id,
    deleteCache,
    expectedRevision: snapshot.revision,
    config,
  });
  outro(
    deleteCache
      ? `Removed configuration and cache: ${repository.localPath}`
      : `Removed configuration. Repository kept at ${repository.localPath}`,
  );
}

export async function runListProjectsCommand(): Promise<void> {
  console.log(JSON.stringify(await loadProjectsIndex(), null, 2));
}

export async function runSyncProjectsCommand(projectId?: string): Promise<void> {
  const index = await loadProjectsIndex();
  let projects = index.projects.filter((project) => project.enabled);
  if (projectId) {
    projects = projects.filter((project) => project.id === projectId || project.name === projectId);
  } else if (process.stdin.isTTY && process.stdout.isTTY && projects.length > 1) {
    const answer = await prompts(
      {
        type: "select",
        name: "id",
        message: "Repositories to sync",
        choices: [
          { title: "All enabled repositories", value: "*" },
          ...projects.map((project) => ({
            title: project.name,
            value: project.id,
          })),
        ],
      },
      promptOptions(),
    );
    if (answer.id !== "*") projects = projects.filter((project) => project.id === answer.id);
  }

  if (projects.length === 0) throw new Error("No matching enabled repositories.");
  const result = await syncRepositories(projects);
  console.log(
    JSON.stringify(
      {
        synced: result.projects.map((project) => project.id),
        errors: result.errors,
      },
      null,
      2,
    ),
  );
  if (result.errors.length > 0) process.exitCode = 1;
}

async function promptProject(
  config: Config,
  initial?: RepositoryProject,
): Promise<RepositoryProject> {
  const urlAnswer = await prompts(
    {
      type: "text",
      name: "url",
      message: "Repository URL",
      initial: initial?.url ?? "",
      validate: (value: string) => (value.trim() ? true : "Repository URL is required"),
    },
    promptOptions(),
  );
  const url = String(urlAnswer.url).trim();
  console.log("Checking remote repository...");
  const remote = await inspectRemoteRepository(url);
  if (remote.branches.length === 0) throw new Error("Remote repository has no branches.");

  const defaultBranch = initial?.branch ?? remote.defaultBranch ?? remote.branches[0];
  const answer = await prompts(
    [
      {
        type: "select",
        name: "branch",
        message: "Branch",
        choices: remote.branches.map((branch) => ({
          title: branch,
          value: branch,
        })),
        initial: Math.max(0, remote.branches.indexOf(defaultBranch ?? "")),
      },
      {
        type: "text",
        name: "name",
        message: "Repository name",
        initial: initial?.name ?? getRepositoryName(url),
        validate: (value: string) => (value.trim() ? true : "Name is required"),
      },
      {
        type: "text",
        name: "localPath",
        message: "Local path",
        initial: initial?.localPath ?? getDefaultRepositoryPath(config, url),
        validate: (value: string) => (value.trim() ? true : "Local path is required"),
      },
      {
        type: "confirm",
        name: "inheritAuthors",
        message: "Use global Git identities?",
        initial: initial?.authors === undefined,
      },
      {
        type: "confirm",
        name: "enabled",
        message: "Enable this repository?",
        initial: initial?.enabled ?? true,
      },
    ],
    promptOptions(),
  );
  const authors = answer.inheritAuthors
    ? undefined
    : await promptIdentities(initial?.authors ?? [], "Repository Git identity");

  return {
    id: getRepositoryId(url),
    name: String(answer.name).trim(),
    url,
    branch: String(answer.branch),
    localPath: normalizeAbsolutePath(String(answer.localPath).trim()),
    ...(authors ? { authors } : {}),
    enabled: Boolean(answer.enabled),
  };
}

async function selectProject(
  projects: RepositoryProject[],
  message: string,
): Promise<RepositoryProject> {
  if (projects.length === 0) throw new Error("No repositories configured.");
  const answer = await prompts(
    {
      type: "select",
      name: "id",
      message,
      choices: projects.map((project) => ({
        title: `${project.name} (${project.branch})`,
        value: project.id,
      })),
    },
    promptOptions(),
  );
  const project = projects.find((item) => item.id === answer.id);
  if (!project) throw new Error("Repository not found.");
  return project;
}

async function confirmProject(project: RepositoryProject): Promise<void> {
  console.log(`URL: ${project.url}`);
  console.log(`Branch: ${project.branch}`);
  console.log(`Local path: ${project.localPath}`);
  console.log(`Authors: ${formatAuthors(project.authors)}`);
  const answer = await prompts(
    {
      type: "confirm",
      name: "confirm",
      message: "Save and sync this repository?",
      initial: true,
    },
    promptOptions(),
  );
  if (!answer.confirm) throw new Error("Operation cancelled.");
}

function assertUniqueProject(project: RepositoryProject, existing: RepositoryProject[]): void {
  if (existing.some((item) => item.id === project.id)) {
    throw new Error(`Repository URL already configured: ${project.url}`);
  }
  const localPath = normalizeAbsolutePath(project.localPath).toLowerCase();
  if (existing.some((item) => normalizeAbsolutePath(item.localPath).toLowerCase() === localPath)) {
    throw new Error(`Local path already used by another repository: ${project.localPath}`);
  }
  if (
    existing.some(
      (item) => normalizeRepositoryUrl(item.url) === normalizeRepositoryUrl(project.url),
    )
  ) {
    throw new Error(`Repository URL already configured: ${project.url}`);
  }
}

function formatAuthors(authors: Identity[] | undefined): string {
  if (!authors) return "global identities";
  return authors.map((author) => `${author.name} <${author.email}>`).join(", ");
}
