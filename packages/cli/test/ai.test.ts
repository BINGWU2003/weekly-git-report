import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  printJson: vi.fn<(value: unknown) => void>(),
  readStdin: vi.fn<(stream: NodeJS.ReadableStream, message: string) => Promise<string>>(),
  saveAiConfig: vi.fn<(config: unknown) => Promise<void>>(),
  loadOptionalAiConfig: vi.fn<() => Promise<unknown>>(),
  testAiConfiguration: vi.fn<(config: unknown) => Promise<unknown>>(),
}));

vi.mock("@weekly-git-report/core", () => ({
  clearAiConfig: vi.fn<() => Promise<void>>(),
  loadOptionalAiConfig: mocks.loadOptionalAiConfig,
  saveAiConfig: mocks.saveAiConfig,
}));
vi.mock("@weekly-git-report/workflow", () => ({
  testAiConfiguration: mocks.testAiConfiguration,
}));
vi.mock("../src/utils/output.js", () => ({
  printJson: mocks.printJson,
  readStdin: mocks.readStdin,
}));
vi.mock("../src/utils/prompt.js", () => ({
  promptOptions: vi.fn<() => object>(),
  prompts: vi.fn<(...args: unknown[]) => Promise<Record<string, unknown>>>(),
}));

import { runAiCommand } from "../src/commands/ai.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readStdin.mockResolvedValue("custom-secret\n");
});

describe("weekly ai configure", () => {
  it("非交互模式保存自定义 Base URL、模型和 stdin Key", async () => {
    await runAiCommand("configure", [
      "--provider",
      "custom",
      "--base-url",
      "https://example.com/v1/",
      "--model",
      "custom-model",
      "--accept-data-sharing",
    ]);

    expect(mocks.saveAiConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 2,
        provider: "custom",
        baseUrl: "https://example.com/v1",
        model: "custom-model",
        apiKey: "custom-secret",
      }),
    );
    expect(mocks.printJson).toHaveBeenCalledWith(
      expect.objectContaining({
        configured: true,
        provider: "custom",
        baseUrl: "https://example.com/v1",
        model: "custom-model",
      }),
    );
  });

  it("重新测试失败时清除旧的测试成功时间", async () => {
    const config = {
      version: 2 as const,
      provider: "openai" as const,
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.4-mini",
      apiKey: "secret-key",
      dataSharingAcceptedAt: "2026-08-31T00:00:00.000Z",
      testedAt: "2026-08-31T01:00:00.000Z",
    };
    mocks.loadOptionalAiConfig.mockResolvedValueOnce(config);
    mocks.testAiConfiguration.mockRejectedValueOnce(new Error("connection failed"));

    await expect(runAiCommand("test", [])).rejects.toThrow("connection failed");

    expect(mocks.saveAiConfig).toHaveBeenCalledOnce();
    expect(mocks.saveAiConfig).toHaveBeenCalledWith({
      version: 2,
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.4-mini",
      apiKey: "secret-key",
      dataSharingAcceptedAt: "2026-08-31T00:00:00.000Z",
    });
  });
});
