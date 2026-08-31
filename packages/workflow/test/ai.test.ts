import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const openAiProvider = Object.assign(
    vi.fn<(model: string) => { protocol: string; model: string }>((model: string) => ({
      protocol: "responses",
      model,
    })),
    {
      chat: vi.fn<(model: string) => { protocol: string; model: string }>((model: string) => ({
        protocol: "chat",
        model,
      })),
    },
  );
  const deepSeekProvider = vi.fn<(model: string) => { protocol: string; model: string }>(
    (model: string) => ({ protocol: "deepseek", model }),
  );
  return {
    createOpenAI: vi.fn<(options: unknown) => typeof openAiProvider>(() => openAiProvider),
    createDeepSeek: vi.fn<(options: unknown) => typeof deepSeekProvider>(() => deepSeekProvider),
    deepSeekProvider,
    generateText: vi.fn<(options: unknown) => Promise<{ text: string }>>(),
    openAiProvider,
    streamText: vi.fn<(options: unknown) => unknown>(),
  };
});

vi.mock("@ai-sdk/openai", () => ({ createOpenAI: mocks.createOpenAI }));
vi.mock("@ai-sdk/deepseek", () => ({ createDeepSeek: mocks.createDeepSeek }));
vi.mock("ai", () => ({ generateText: mocks.generateText, streamText: mocks.streamText }));

import { testAiConfiguration } from "../src/ai.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateText.mockResolvedValue({ text: "OK" });
});

describe("testAiConfiguration", () => {
  it("自定义服务使用指定 Base URL、模型和 Chat Completions", async () => {
    const result = await testAiConfiguration({
      version: 2,
      provider: "custom",
      baseUrl: "https://example.com/v1",
      model: "custom-model",
      apiKey: "secret-key",
      dataSharingAcceptedAt: "2026-08-31T00:00:00.000Z",
    });

    expect(mocks.createOpenAI).toHaveBeenCalledWith({
      apiKey: "secret-key",
      baseURL: "https://example.com/v1",
    });
    expect(mocks.openAiProvider.chat).toHaveBeenCalledWith("custom-model");
    expect(mocks.openAiProvider).not.toHaveBeenCalled();
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { protocol: "chat", model: "custom-model" },
        maxRetries: 0,
        abortSignal: expect.any(AbortSignal),
      }),
    );
    expect(result).toEqual({ provider: "custom", model: "custom-model" });
  });

  it("将鉴权错误转换为脱敏的可操作提示", async () => {
    mocks.generateText.mockRejectedValueOnce(new Error("401 invalid API key secret-key"));

    await expect(
      testAiConfiguration({
        version: 2,
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5.4-mini",
        apiKey: "secret-key",
        dataSharingAcceptedAt: "2026-08-31T00:00:00.000Z",
      }),
    ).rejects.toThrow("AI 服务鉴权失败，请检查 API Key。");
  });
});
