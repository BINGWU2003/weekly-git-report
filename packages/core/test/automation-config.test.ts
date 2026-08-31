import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  content: "",
  getFileRevision: vi.fn<(file: string) => Promise<string | null>>(),
  readVersionedText: vi.fn<(file: string) => Promise<{ content: string; revision: string }>>(),
  writeJsonAtomic: vi.fn<(file: string, value: unknown) => Promise<void>>(),
}));

vi.mock("../src/utils/path.js", () => ({
  getAiConfigFilePath: () => "C:/test/ai.json",
  getFeishuConfigFilePath: () => "C:/test/feishu.json",
  getTasksFilePath: () => "C:/test/tasks.json",
}));
vi.mock("../src/utils/versioned-json.js", () => ({
  assertFileRevision: vi.fn<() => Promise<void>>(),
  getFileRevision: mocks.getFileRevision,
  readVersionedText: mocks.readVersionedText,
  writeJsonAtomic: mocks.writeJsonAtomic,
}));

import { loadOptionalAiConfig } from "../src/config/automation-config.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getFileRevision.mockResolvedValue("revision");
  mocks.readVersionedText.mockImplementation(async () => ({
    content: mocks.content,
    revision: "revision",
  }));
});

describe("loadOptionalAiConfig", () => {
  it("把旧版 AI 配置安全地视为未配置", async () => {
    mocks.content = JSON.stringify({
      version: 1,
      provider: "openai",
      apiKey: "old-secret",
      dataSharingAcceptedAt: "2026-08-30T00:00:00.000Z",
    });

    await expect(loadOptionalAiConfig()).resolves.toBeNull();
  });

  it("读取包含 Base URL 和模型的新版配置", async () => {
    mocks.content = JSON.stringify({
      version: 2,
      provider: "custom",
      baseUrl: "https://example.com/v1/",
      model: "custom-model",
      apiKey: "new-secret",
      dataSharingAcceptedAt: "2026-08-31T00:00:00.000Z",
    });

    await expect(loadOptionalAiConfig()).resolves.toMatchObject({
      version: 2,
      provider: "custom",
      baseUrl: "https://example.com/v1",
      model: "custom-model",
    });
  });
});
