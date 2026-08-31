import { AI_PROVIDER_BASE_URLS, AiConfigSchema, AiProviderSchema } from "@weekly-git-report/shared";
import { clearAiConfig, loadOptionalAiConfig, saveAiConfig } from "@weekly-git-report/core";
import { testAiConfiguration } from "@weekly-git-report/workflow";

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
  const baseUrlOption = option(args, "--base-url");
  const modelOption = option(args, "--model");
  const accepted = args.includes("--accept-data-sharing");
  rejectUnknown(args, ["--provider", "--base-url", "--model", "--accept-data-sharing"]);
  let provider = providerOption ? AiProviderSchema.parse(providerOption) : undefined;
  let baseUrl = baseUrlOption?.trim();
  let model = modelOption?.trim();
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
            { title: "Custom OpenAI-compatible service", value: "custom" },
          ],
        },
        promptOptions(),
      );
      provider = AiProviderSchema.parse(selected.provider);
    }
    if (provider === "custom" && !baseUrl) {
      const answer = await prompts(
        {
          type: "text",
          name: "baseUrl",
          message: "AI API Base URL",
          validate: (value: string) => Boolean(value.trim()) || "Base URL is required",
        },
        promptOptions(),
      );
      baseUrl = String(answer.baseUrl).trim();
    }
    if (!model) {
      const answer = await prompts(
        {
          type: "text",
          name: "model",
          message: "AI model ID",
          validate: (value: string) => Boolean(value.trim()) || "Model is required",
        },
        promptOptions(),
      );
      model = String(answer.model).trim();
    }
    if (!accepted) {
      const consent = await prompts(
        {
          type: "confirm",
          name: "accepted",
          message: "生成时会将报告数据发送到你配置的 AI 服务；确认继续？",
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
    if (!provider || !model || !accepted || (provider === "custom" && !baseUrl)) {
      throw new Error(
        "Non-interactive configure requires --provider, --model and --accept-data-sharing; custom also requires --base-url. Pipe the API Key to stdin.",
      );
    }
    apiKey = (await readStdin(process.stdin, "Pipe the API Key to stdin.")).trim();
  }
  if (provider !== "custom" && baseUrlOption) {
    throw new Error("--base-url is only supported with --provider custom.");
  }
  baseUrl =
    provider === "custom"
      ? baseUrl
      : AI_PROVIDER_BASE_URLS[provider as keyof typeof AI_PROVIDER_BASE_URLS];
  const config = AiConfigSchema.parse({
    version: 2,
    provider,
    baseUrl,
    model,
    apiKey,
    dataSharingAcceptedAt: new Date().toISOString(),
  });
  await saveAiConfig(config);
  printJson({
    configured: true,
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
  });
}

async function status(args: string[]): Promise<void> {
  assertNoArgs(args);
  const config = await loadOptionalAiConfig();
  printJson(
    config
      ? {
          configured: true,
          provider: config.provider,
          baseUrl: config.baseUrl,
          model: config.model,
          testedAt: config.testedAt ?? null,
        }
      : { configured: false },
  );
}

async function test(args: string[]): Promise<void> {
  assertNoArgs(args);
  const config = await loadOptionalAiConfig();
  if (!config) throw new Error("AI is not configured.");
  const { testedAt: _testedAt, ...untested } = config;
  if (config.testedAt) await saveAiConfig(untested);
  const result = await testAiConfiguration(untested);
  const testedAt = new Date().toISOString();
  await saveAiConfig({ ...untested, testedAt });
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
    if (arg !== "--accept-data-sharing") index += 1;
  }
}

function assertNoArgs(args: string[]): void {
  if (args.length) throw new Error(`Unexpected option: ${args[0]}`);
}
