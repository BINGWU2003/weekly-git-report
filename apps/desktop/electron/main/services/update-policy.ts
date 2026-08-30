import type { ReportRun } from "@weekly-git-report/shared";
import type { DesktopUpdateStatus } from "../../../shared/ipc.js";

const ACTIVE_RUN_STATUSES = new Set<ReportRun["status"]>([
  "queued",
  "collecting",
  "generating",
  "saving",
  "publishing",
]);

export function getUpdateInstallBlockReason(runs: ReportRun[]): string | undefined {
  return getActiveRunInstallBlockReason(runs.some((run) => ACTIVE_RUN_STATUSES.has(run.status)));
}

export function getActiveRunInstallBlockReason(active: boolean): string | undefined {
  return active ? "报告正在生成、保存或推送，请等待运行结束后再安装更新。" : undefined;
}

export function isDesktopUpdaterSupported(input: {
  isPackaged: boolean;
  platform: NodeJS.Platform;
}): boolean {
  return input.isPackaged && input.platform === "win32";
}

export function shouldInstallDesktopUpdateOnQuit(input: {
  phase: DesktopUpdateStatus["phase"];
  hasActiveRuns: boolean;
  installRequested: boolean;
}): boolean {
  return input.phase === "downloaded" && !input.hasActiveRuns && !input.installRequested;
}
