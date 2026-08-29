import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { FeishuConfig, ReportType, SummaryMetadata } from "@weekly-git-report/shared";

import { inspectSummaryMetadata } from "@weekly-git-report/core";

const MAX_CARD_BYTES = 20 * 1024;

export interface PublishFeishuResult {
  attempts: number;
  messageId?: string;
}

export async function publishSummaryToFeishu(
  config: FeishuConfig,
  summaryFile: string,
): Promise<PublishFeishuResult> {
  const content = await readFile(summaryFile, "utf8");
  const identity = parseSummaryIdentity(summaryFile);
  const inspection = await inspectSummaryMetadata(summaryFile, identity.period, content, identity);
  if (inspection.status !== "valid" || !inspection.metadata) {
    throw new Error(inspection.message ?? "Only a summary with a valid sidecar can be published.");
  }
  return publishMarkdownCard(config, inspection.metadata, content);
}

export async function testFeishuConfiguration(config: FeishuConfig): Promise<void> {
  try {
    await postWithRetry(config, {
      msg_type: "text",
      content: { text: "weekly-git-report 飞书连接测试成功" },
    });
  } catch (error) {
    throw new Error(redact(getMessage(error), [config.webhookUrl, config.signingSecret]), {
      cause: error,
    });
  }
}

async function publishMarkdownCard(
  config: FeishuConfig,
  metadata: SummaryMetadata,
  content: string,
): Promise<PublishFeishuResult> {
  if (Buffer.byteLength(content, "utf8") > MAX_CARD_BYTES) {
    throw new Error(
      "Report exceeds the Feishu card size limit; it was not truncated or published.",
    );
  }
  const title = `${metadata.title ?? reportTypeLabel(metadata.reportType)} ${metadata.period.start} ~ ${metadata.period.end}`;
  return postWithRetry(config, {
    msg_type: "interactive",
    card: {
      schema: "2.0",
      config: { wide_screen_mode: true },
      header: { title: { tag: "plain_text", content: title } },
      body: { elements: [{ tag: "markdown", content }] },
    },
  });
}

async function postWithRetry(
  config: FeishuConfig,
  body: Record<string, unknown>,
): Promise<PublishFeishuResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const payload = withSignature(config, body);
      const response = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        code?: number;
        StatusCode?: number;
        msg?: string;
        StatusMessage?: string;
        data?: { message_id?: string };
      };
      const code = result.code ?? result.StatusCode ?? (response.ok ? 0 : response.status);
      if (!response.ok || code !== 0) {
        const error = new Error(
          result.msg ?? result.StatusMessage ?? `Feishu HTTP ${response.status}`,
        );
        if (response.status < 500 && response.status !== 429)
          throw new PermanentFeishuError(error.message);
        throw error;
      }
      return {
        attempts: attempt,
        ...(result.data?.message_id ? { messageId: result.data.message_id } : {}),
      };
    } catch (error) {
      if (error instanceof PermanentFeishuError) throw error;
      lastError = error;
      if (attempt < 4) await delay([300, 800, 1_600][attempt - 1] ?? 1_600);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function withSignature(
  config: FeishuConfig,
  body: Record<string, unknown>,
): Record<string, unknown> {
  if (!config.signingSecret) return body;
  const timestamp = Math.floor(Date.now() / 1_000).toString();
  const sign = createHmac("sha256", `${timestamp}\n${config.signingSecret}`)
    .update("")
    .digest("base64");
  return { timestamp, sign, ...body };
}

function parseSummaryIdentity(file: string): {
  period: { start: string; end: string };
  reportType: ReportType;
  reportId?: string;
} {
  const match =
    /(?:^|[\\/])(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.(daily|weekly|monthly|custom)(?:\.([a-zA-Z0-9_-]+))?\.md$/i.exec(
      file,
    );
  if (!match?.[1] || !match[2] || !match[3])
    throw new Error("Summary file name does not contain a valid period.");
  const reportType = match[3].toLowerCase() as ReportType;
  if (reportType === "custom" && !match[4]) throw new Error("Custom report id is missing.");
  return {
    period: { start: match[1], end: match[2] },
    reportType,
    ...(match[4] ? { reportId: match[4] } : {}),
  };
}

function reportTypeLabel(reportType: ReportType): string {
  if (reportType === "daily") return "日报";
  if (reportType === "weekly") return "周报";
  if (reportType === "monthly") return "月报";
  return "自定义报告";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function redact(message: string, secrets: Array<string | undefined>): string {
  let result = message;
  for (const secret of secrets) {
    if (secret) result = result.replaceAll(secret, "[REDACTED]");
  }
  return result;
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class PermanentFeishuError extends Error {}
