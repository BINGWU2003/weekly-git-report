import { describe, expect, it } from "vitest";

import { normalizeDesktopReleaseMetadata, normalizeReleaseNotes } from "./release-notes.js";

describe("normalizeReleaseNotes", () => {
  it("将 GitHub HTML 发布说明转换为 Markdown 文本", () => {
    expect(
      normalizeReleaseNotes(
        "<h2>新功能</h2><p>支持自动更新 &amp; 手动安装。</p><ul><li>后台检查</li><li>按需下载</li></ul>",
      ),
    ).toBe("## 新功能\n\n支持自动更新 & 手动安装。\n\n- 后台检查\n- 按需下载");
  });

  it("合并多版本发布说明并移除不可展示的 HTML", () => {
    expect(
      normalizeReleaseNotes([
        { version: "1.0.0", note: "<p>正式版本</p><script>ignored()</script>" },
        { version: "0.9.0", note: "预览版本" },
      ]),
    ).toBe("## 1.0.0\n\n正式版本\n\n## 0.9.0\n\n预览版本");
  });

  it("忽略空发布说明", () => {
    expect(normalizeReleaseNotes("  ")).toBeUndefined();
    expect(normalizeReleaseNotes(null)).toBeUndefined();
  });

  it("保留 Desktop Release 元数据", () => {
    expect(
      normalizeDesktopReleaseMetadata({
        releaseName: "Weekly Git Report Desktop 1.1.0",
        releaseNotes: "<p>新增自动更新保护。</p>",
      }),
    ).toEqual({
      releaseName: "Weekly Git Report Desktop 1.1.0",
      releaseNotes: "新增自动更新保护。",
    });
  });

  it("丢弃被 GitHub Atom feed 串入的其他 workspace 包元数据", () => {
    expect(
      normalizeDesktopReleaseMetadata({
        releaseName: "@weekly-git-report/workflow@0.0.0",
        releaseNotes: "@weekly-git-report/workflow@0.0.0",
      }),
    ).toEqual({});
  });
});
