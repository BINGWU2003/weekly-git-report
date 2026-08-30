import { Readable } from "node:stream";

import { describe, expect, test } from "vitest";

import { formatJson, hasOperationErrors, readStdin } from "../src/utils/output.js";

describe("automation command I/O", () => {
  test("formats stable pretty JSON", () => {
    expect(formatJson({ projectCount: 1, errors: [] })).toBe(
      '{\n  "projectCount": 1,\n  "errors": []\n}',
    );
  });

  test("detects partial operation failures", () => {
    expect(hasOperationErrors({ errors: [{ message: "fetch failed" }] })).toBe(true);
    expect(hasOperationErrors({ errors: [] })).toBe(false);
    expect(hasOperationErrors({ content: "ok" })).toBe(false);
  });

  test("reads piped summary content", async () => {
    await expect(readStdin(Readable.from(["# 周报\n", "\n- 完成迁移\n"]))).resolves.toBe(
      "# 周报\n\n- 完成迁移\n",
    );
  });

  test("rejects an interactive stdin without summary content", async () => {
    await expect(
      readStdin({
        isTTY: true,
        async *[Symbol.asyncIterator]() {},
      }),
    ).rejects.toThrow(/Pass --file or pipe Markdown/);
  });
});
