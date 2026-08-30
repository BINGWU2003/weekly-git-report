import { FeishuConfigSchema } from "@weekly-git-report/shared";
import {
  clearFeishuConfig,
  loadOptionalFeishuConfig,
  saveFeishuConfig,
} from "@weekly-git-report/core";
import { testFeishuConfiguration } from "@weekly-git-report/workflow";

import { printJson, readStdin } from "../utils/output.js";
import { promptOptions, prompts } from "../utils/prompt.js";

export async function runFeishuCommand(
  subcommand: string | undefined,
  args: string[],
): Promise<void> {
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
      throw new Error(`Unknown feishu command: ${subcommand ?? ""}`);
  }
}

async function configure(args: string[]): Promise<void> {
  if (args.length)
    throw new Error("feishu configure does not accept secrets as command arguments.");
  let value: unknown;
  if (process.stdin.isTTY && process.stdout.isTTY) {
    const answer = await prompts(
      [
        {
          type: "password",
          name: "webhookUrl",
          message: "飞书群机器人 Webhook",
          validate: (input: string) => Boolean(input.trim()) || "Webhook is required",
        },
        { type: "password", name: "signingSecret", message: "签名密钥（可选）" },
      ],
      promptOptions(),
    );
    value = {
      version: 1,
      webhookUrl: String(answer.webhookUrl).trim(),
      ...(String(answer.signingSecret ?? "").trim()
        ? { signingSecret: String(answer.signingSecret).trim() }
        : {}),
    };
  } else {
    value = JSON.parse(
      await readStdin(
        process.stdin,
        "Pipe a JSON object with webhookUrl and optional signingSecret to stdin.",
      ),
    );
    value = { version: 1, ...(value as object) };
  }
  const config = FeishuConfigSchema.parse(value);
  await saveFeishuConfig(config);
  printJson({ configured: true, signingEnabled: Boolean(config.signingSecret) });
}

async function status(args: string[]): Promise<void> {
  assertNoArgs(args);
  const config = await loadOptionalFeishuConfig();
  printJson(
    config
      ? {
          configured: true,
          signingEnabled: Boolean(config.signingSecret),
          testedAt: config.testedAt ?? null,
        }
      : { configured: false },
  );
}

async function test(args: string[]): Promise<void> {
  assertNoArgs(args);
  const config = await loadOptionalFeishuConfig();
  if (!config) throw new Error("Feishu is not configured.");
  await testFeishuConfiguration(config);
  const testedAt = new Date().toISOString();
  await saveFeishuConfig({ ...config, testedAt });
  printJson({ testedAt });
}

async function clear(args: string[]): Promise<void> {
  assertNoArgs(args);
  await clearFeishuConfig();
  printJson({ configured: false });
}

function assertNoArgs(args: string[]): void {
  if (args.length) throw new Error(`Unexpected option: ${args[0]}`);
}
