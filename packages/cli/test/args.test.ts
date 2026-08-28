import { describe, expect, test } from "vitest";

import {
  parseCollectArgs,
  parsePeriodArgs,
  parseProjectImportArgs,
  parseProjectSelectionArgs,
  parseSummarySaveArgs,
  parseTemplateReadArgs,
  parseTemplateResetArgs,
  parseTemplateWriteArgs,
} from "../src/utils/args.js";

describe("automation argument parsing", () => {
  test("parses repeated collect filters", () => {
    expect(
      parseCollectArgs([
        "--since",
        "2026-08-18",
        "--until",
        "2026-08-24",
        "--author",
        "Alice",
        "--author",
        "alice@example.com",
        "--project",
        "one",
        "--project",
        "two",
      ]),
    ).toEqual({
      since: "2026-08-18",
      until: "2026-08-24",
      author: ["Alice", "alice@example.com"],
      projectIds: ["one", "two"],
    });
  });

  test("rejects ambiguous collect selection", () => {
    expect(() => parseCollectArgs(["--all", "--project", "one"])).toThrow(/cannot be combined/);
  });

  test("distinguishes interactive sync from explicit all", () => {
    expect(parseProjectSelectionArgs([])).toEqual({ explicit: false, projectIds: [] });
    expect(parseProjectSelectionArgs(["--all"])).toEqual({ explicit: true, projectIds: [] });
  });

  test("parses a repository import folder and all flag", () => {
    expect(parseProjectImportArgs(["D:/code", "--all"])).toEqual({
      folder: "D:/code",
      all: true,
    });
    expect(() => parseProjectImportArgs(["one", "two"])).toThrow(/only one folder/);
  });

  test("supports one positional project or repeated project options", () => {
    expect(parseProjectSelectionArgs(["project-a"])).toEqual({
      explicit: true,
      projectIds: ["project-a"],
    });
    expect(parseProjectSelectionArgs(["--project", "one", "--project", "two"])).toEqual({
      explicit: true,
      projectIds: ["one", "two"],
    });
  });

  test("rejects mixed sync selection styles", () => {
    expect(() => parseProjectSelectionArgs(["project-a", "--project", "project-b"])).toThrow(
      /cannot be combined/,
    );
  });

  test("accepts both period option aliases", () => {
    expect(parsePeriodArgs(["--since", "2026-08-18", "--until", "2026-08-24"])).toEqual({
      start: "2026-08-18",
      end: "2026-08-24",
    });
  });

  test("separates summary file from its period", () => {
    expect(
      parseSummarySaveArgs([
        "--start",
        "2026-08-18",
        "--end",
        "2026-08-24",
        "--file",
        "summary.md",
      ]),
    ).toEqual({
      file: "summary.md",
      period: { start: "2026-08-18", end: "2026-08-24" },
    });
  });

  test("parses optional template rendering dates", () => {
    expect(parseTemplateReadArgs([])).toEqual({});
    expect(parseTemplateReadArgs(["--start", "2026-08-18", "--end", "2026-08-24"])).toEqual({
      period: { start: "2026-08-18", end: "2026-08-24" },
    });
    expect(() => parseTemplateReadArgs(["--start", "2026-08-18"])).toThrow(/provided together/);
  });

  test("requires revision safety for template writes and force for reset", () => {
    expect(parseTemplateWriteArgs(["--file", "template.md", "--revision", "abc"])).toEqual({
      file: "template.md",
      revision: "abc",
      force: false,
    });
    expect(parseTemplateWriteArgs(["--force"])).toEqual({ force: true });
    expect(() => parseTemplateWriteArgs([])).toThrow(/--revision/);
    expect(() => parseTemplateWriteArgs(["--revision", "abc", "--force"])).toThrow(
      /cannot be combined/,
    );
    expect(parseTemplateResetArgs(["--force"])).toEqual({ force: true });
    expect(() => parseTemplateResetArgs([])).toThrow(/requires --force/);
  });
});
