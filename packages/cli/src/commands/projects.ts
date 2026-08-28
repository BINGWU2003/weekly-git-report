import {
  getDefaultRepositoryPath,
  getRepositoryId,
  getRepositoryName,
  inspectRemoteRepository,
  importRepositoryProjects,
  loadConfig,
  loadProjectsIndexSnapshot,
  normalizeAbsolutePath,
  removeRepositoryProject,
  saveRepositoryProject,
  scanRepositoryFolder,
} from "@weekly-git-report/core";
import type { Config, Identity, RepositoryProject } from "@weekly-git-report/shared";
import { listProjects, syncProjects } from "@weekly-git-report/workflow";

import { assertInteractive, promptIdentities } from "./init.js";
import { parseProjectImportArgs, parseProjectSelectionArgs } from "../utils/args.js";
import { printOperationResult, printJson } from "../utils/output.js";
import { intro, outro, promptOptions, prompts } from "../utils/prompt.js";

export async function runAddProjectCommand(): Promise<void> {
  assertInteractive();
  const config = await loadConfig();
  const snapshot = await loadProjectsIndexSnapshot();
  intro("add repository");
  const repository = await promptProject(config);
  await confirmProject(repository);
  await saveRepositoryProject({
    project: repository,
    expectedRevision: snapshot.revision,
  });
  outro(`Added ${repository.name}: ${repository.localPath}`);
}

export async function runEditProjectCommand(): Promise<void> {
  assertInteractive();
  const config = await loadConfig();
  const snapshot = await loadProjectsIndexSnapshot();
  const current = await selectProject(snapshot.index.projects, "Repository to edit");
  const repository = await promptProject(config, current);
  await confirmProject(repository);
  await saveRepositoryProject({
    project: repository,
    currentId: current.id,
    expectedRevision: snapshot.revision,
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
  printJson(await listProjects({}));
}

export async function runSyncProjectsCommand(args: string[]): Promise<void> {
  const selection = parseProjectSelectionArgs(args);
  let projectIds = selection.projectIds;

  if (!selection.explicit && process.stdin.isTTY && process.stdout.isTTY) {
    const { projects } = await listProjects({});
    const enabledProjects = projects.filter((project) => project.enabled);
    if (enabledProjects.length > 1) {
      const answer = await prompts(
        {
          type: "select",
          name: "id",
          message: "Repositories to sync",
          choices: [
            { title: "All enabled repositories", value: "*" },
            ...enabledProjects.map((project) => ({
              title: project.name,
              value: project.id,
            })),
          ],
        },
        promptOptions(),
      );
      if (answer.id !== "*") projectIds = [String(answer.id)];
    }
  }

  printOperationResult(await syncProjects({ projectIds }));
}

export async function runImportProjectsCommand(args: string[]): Promise<void> {
  const parsed = parseProjectImportArgs(args);
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!interactive && (!parsed.folder || !parsed.all)) {
    throw new Error("Non-interactive import requires a folder and --all.");
  }

  const folder = parsed.folder ?? (await promptImportFolder());
  const [config, snapshot, scan] = await Promise.all([
    loadConfig(),
    loadProjectsIndexSnapshot(),
    scanRepositoryFolder(folder),
  ]);
  const prepared = await prepareImportCandidates(
    scan.repositories,
    config,
    snapshot.index.projects,
  );
  const ready = prepared.filter(
    (candidate): candidate is PreparedImportCandidate & { project: RepositoryProject } =>
      Boolean(candidate.project),
  );
  if (interactive) {
    console.log(
      `Scanned ${scan.repositories.length} repositories: ${ready.length} ready, ${prepared.length - ready.length} skipped.`,
    );
    for (const candidate of prepared.filter((item) => !item.project)) {
      console.log(`Skipped ${candidate.sourcePath}: ${candidate.message}`);
    }
    for (const warning of scan.warnings) {
      console.log(`Warning ${warning.path}: ${warning.message}`);
    }
  }
  const selectedIds = parsed.all
    ? new Set(ready.map((candidate) => candidate.project.id))
    : await promptImportSelection(ready);
  const selected = ready
    .map((candidate) => candidate.project)
    .filter((project): project is RepositoryProject =>
      Boolean(project && selectedIds.has(project.id)),
    );

  if (interactive && selected.length > 0 && !parsed.all) {
    const confirmation = await prompts(
      {
        type: "confirm",
        name: "value",
        message: `Sync and add ${selected.length} repositories?`,
        initial: true,
      },
      promptOptions(),
    );
    if (!confirmation.value) throw new Error("Operation cancelled.");
  }

  const result = await importRepositoryProjects({
    projects: selected,
    expectedRevision: snapshot.revision,
  });
  const skipped = prepared
    .filter((candidate) => !candidate.project || !selectedIds.has(candidate.project.id))
    .map((candidate) => ({
      path: candidate.sourcePath,
      reason: candidate.message ?? "Not selected.",
    }));
  printOperationResult({
    root: scan.root,
    scanned: scan.repositories.length,
    selected: selected.length,
    added: result.added.map((project) => ({
      id: project.id,
      name: project.name,
      branch: project.branch,
      path: project.localPath,
    })),
    skipped,
    warnings: scan.warnings,
    errors: result.errors,
    revision: result.snapshot.revision,
  });
}

interface PreparedImportCandidate {
  sourcePath: string;
  project?: RepositoryProject;
  message?: string;
}

async function prepareImportCandidates(
  discoveries: Array<{ sourcePath: string; originUrl?: string }>,
  config: Config,
  existing: RepositoryProject[],
): Promise<PreparedImportCandidate[]> {
  const candidates = new Array<PreparedImportCandidate>(discoveries.length);
  const knownIds = new Set(existing.map((project) => project.id));
  let nextIndex = 0;
  let completed = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, discoveries.length) }, async () => {
      while (nextIndex < discoveries.length) {
        const index = nextIndex;
        nextIndex += 1;
        const discovery = discoveries[index];
        if (!discovery) continue;
        if (!discovery.originUrl) {
          candidates[index] = {
            sourcePath: discovery.sourcePath,
            message: "Origin remote is missing.",
          };
        } else {
          try {
            const remote = await inspectRemoteRepository(discovery.originUrl, {
              timeoutMs: 30_000,
            });
            const branch = remote.defaultBranch ?? remote.branches[0];
            if (!branch) throw new Error("Remote repository has no branches.");
            const id = getRepositoryId(discovery.originUrl);
            if (knownIds.has(id)) {
              candidates[index] = {
                sourcePath: discovery.sourcePath,
                message: "Repository is already configured or duplicated in this import.",
              };
            } else {
              knownIds.add(id);
              const name = getRepositoryName(discovery.originUrl);
              candidates[index] = {
                sourcePath: discovery.sourcePath,
                project: {
                  id,
                  name,
                  url: discovery.originUrl,
                  branch,
                  localPath: getDefaultRepositoryPath(config, discovery.originUrl, name),
                  enabled: true,
                },
              };
            }
          } catch (error) {
            candidates[index] = {
              sourcePath: discovery.sourcePath,
              message: error instanceof Error ? error.message : String(error),
            };
          }
        }
        completed += 1;
        console.error(`Validated repositories: ${completed}/${discoveries.length}`);
      }
    }),
  );
  return candidates;
}

async function promptImportFolder(): Promise<string> {
  const answer = await prompts(
    {
      type: "text",
      name: "folder",
      message: "Folder to scan",
      validate: (value: string) => (value.trim() ? true : "Folder is required"),
    },
    promptOptions(),
  );
  return String(answer.folder).trim();
}

async function promptImportSelection(
  candidates: Array<PreparedImportCandidate & { project: RepositoryProject }>,
): Promise<Set<string>> {
  if (candidates.length === 0) return new Set();
  const answer = await prompts(
    {
      type: "multiselect",
      name: "ids",
      message: "Repositories to import",
      choices: candidates.map((candidate) => ({
        title: `${candidate.project.name} (${candidate.project.branch})`,
        description: candidate.project.url,
        value: candidate.project.id,
        selected: true,
      })),
    },
    promptOptions(),
  );
  return new Set(Array.isArray(answer.ids) ? answer.ids.map(String) : []);
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

function formatAuthors(authors: Identity[] | undefined): string {
  if (!authors) return "global identities";
  return authors.map((author) => `${author.name} <${author.email}>`).join(", ");
}
