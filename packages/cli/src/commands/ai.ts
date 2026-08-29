import { AiConfigSchema, AiProviderSchema } from "@weekly-git-report/shared";
import { clearAiConfig, loadOptionalAiConfig, saveAiConfig } from "@weekly-git-report/core";
import { DEFAULT_AI_MODELS, testAiConfiguration } from "@weekly-git-report/workflow";

import { printJson, readStdin } from "../utils/output.js";
import { promptOptions, prompts } from "../utils/prompt.js";

export async function runAiCommand(subcommand: string | undefined, args: string[]): Promise<void> {
  switch (subcommand) {
    case "configure":
      return configure(args);
    case "status":
      return status(args);
    case "test":
      return test(args);
    case "clear":
      return clear(args);
    default:
      throw new Error(`Unknown ai command: ${subcommand ?? ""}`);
  }
}

async function configure(args: string[]): Promise<void> {
  const providerOption = option(args, "--provider");
  const accepted = args.includes("--accept-data-sharing");
  rejectUnknown(args, ["--provider", "--accept-data-sharing"]);
  let provider = providerOption ? AiProviderSchema.parse(providerOption) : undefined;
  let apiKey: string;
  if (process.stdin.isTTY && process.stdout.isTTY) {
    if (!provider) {
      const selected = await prompts(
        {
          type: "select",
          name: "provider",
          message: "AI provider",
          choices: [
            { title: "OpenAI", value: "openai" },
            { title: "DeepSeek", value: "deepseek" },
          ],
        },
        promptOptions(),
      );
      provider = AiProviderSchema.parse(selected.provider);
    }
    if (!accepted) {
      const consent = await prompts(
        {
          type: "confirm",
          name: "accepted",
          message:
            "生成时将仓库名、分支、提交 Hash/时间/标题/正文和作者姓名发送给供应商；确认继续？",
          initial: false,
        },
        promptOptions(),
      );
      if (!consent.accepted) throw new Error("Data sharing was not accepted.");
    }
    const answer = await prompts(
      {
        type: "password",
        name: "apiKey",
        message: `${provider} API Key`,
        validate: (value: string) => Boolean(value.trim()) || "API Key is required",
      },
      promptOptions(),
    );
    apiKey = String(answer.apiKey).trim();
  } else {
    if (!provider || !accepted) {
      throw new Error(
        "Non-interactive configure requires --provider and --accept-data-sharing; pipe the API Key to stdin.",
      );
    }
    apiKey = (await readStdin(process.stdin, "Pipe the API Key to stdin.")).trim();
  }
  await saveAiConfig(
    AiConfigSchema.parse({
      version: 1,
      provider,
      apiKey,
      dataSharingAcceptedAt: new Date().toISOString(),
    }),
  );
  printJson({ configured: true, provider, model: DEFAULT_AI_MODELS[provider] });
}

async function status(args: string[]): Promise<void> {
  assertNoArgs(args);
  const config = await loadOptionalAiConfig();
  printJson(
    config
      ? {
          configured: true,
          provider: config.provider,
          model: DEFAULT_AI_MODELS[config.provider],
          testedAt: config.testedAt ?? null,
        }
      : { configured: false },
  );
}

async function test(args: string[]): Promise<void> {
  assertNoArgs(args);
  const config = await loadOptionalAiConfig();
  if (!config) throw new Error("AI is not configured.");
  const result = await testAiConfiguration(config);
  const testedAt = new Date().toISOString();
  await saveAiConfig({ ...config, testedAt });
  printJson({ ...result, testedAt });
}

async function clear(args: string[]): Promise<void> {
  assertNoArgs(args);
  await clearAiConfig();
  printJson({ configured: false });
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
  return value;
}

function rejectUnknown(args: string[], supported: string[]): void {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!supported.includes(arg)) throw new Error(`Unknown option: ${arg}`);
    if (arg === "--provider") index += 1;
  }
}

function assertNoArgs(args: string[]): void {
  if (args.length) throw new Error(`Unexpected option: ${args[0]}`);
}
