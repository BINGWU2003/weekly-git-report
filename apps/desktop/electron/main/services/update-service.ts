import { app, shell } from "electron";
import log from "electron-log/main";
import { autoUpdater, type ProgressInfo, type UpdateInfo } from "electron-updater";

import type { DesktopUpdateStatus } from "../../../shared/ipc.js";
import { normalizeDesktopReleaseMetadata } from "./release-notes.js";
import {
  getActiveRunInstallBlockReason,
  isDesktopUpdaterSupported,
  shouldInstallDesktopUpdateOnQuit,
} from "./update-policy.js";

const RELEASE_URL = "https://github.com/BINGWU2003/weekly-git-report/releases/latest";
const FIRST_CHECK_DELAY_MS = 15_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000;

type UpdateAction = "automatic-check" | "manual-check" | "download" | undefined;

let initialized = false;
let action: UpdateAction;
let firstCheckTimer: NodeJS.Timeout | undefined;
let intervalTimer: NodeJS.Timeout | undefined;
let hasActiveRuns = () => false;
let installRequested = false;
let publishStatus: (status: DesktopUpdateStatus) => void = () => undefined;
let status: DesktopUpdateStatus = {
  phase: "disabled",
  currentVersion: app.getVersion(),
  releaseUrl: RELEASE_URL,
  disabledReason: "更新服务尚未初始化。",
};

export function initializeDesktopUpdater(options: {
  hasActiveRuns(): boolean;
  onStatusChange(status: DesktopUpdateStatus): void;
}): DesktopUpdateStatus {
  hasActiveRuns = options.hasActiveRuns;
  publishStatus = options.onStatusChange;

  if (initialized) return getDesktopUpdateStatus();
  initialized = true;
  configureUpdateLogging();

  if (!isDesktopUpdaterSupported({ isPackaged: app.isPackaged, platform: process.platform })) {
    updateStatus({
      phase: "disabled",
      currentVersion: app.getVersion(),
      releaseUrl: RELEASE_URL,
      disabledReason: app.isPackaged
        ? "首版自动更新仅支持 Windows 正式安装包。"
        : "开发模式和未安装版本不启用自动更新。",
    });
    log.info("Desktop updater disabled", {
      packaged: app.isPackaged,
      platform: process.platform,
      version: app.getVersion(),
    });
    return getDesktopUpdateStatus();
  }

  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "BINGWU2003",
    repo: "weekly-git-report",
  });
  registerUpdaterEvents();
  updateStatus({
    phase: "idle",
    currentVersion: app.getVersion(),
    releaseUrl: RELEASE_URL,
  });

  firstCheckTimer = setTimeout(() => void checkDesktopUpdate(false), FIRST_CHECK_DELAY_MS);
  firstCheckTimer.unref();
  intervalTimer = setInterval(() => void checkDesktopUpdate(false), CHECK_INTERVAL_MS);
  intervalTimer.unref();
  return getDesktopUpdateStatus();
}

export function getDesktopUpdateStatus(): DesktopUpdateStatus {
  return {
    ...status,
    ...(status.phase === "downloaded"
      ? { installBlockedReason: getActiveRunInstallBlockReason(hasActiveRuns()) }
      : { installBlockedReason: undefined }),
  };
}

export async function checkDesktopUpdate(manual = true): Promise<DesktopUpdateStatus> {
  if (status.phase === "disabled") return getDesktopUpdateStatus();
  if (status.phase === "checking" || status.phase === "downloading") {
    throw new Error(status.phase === "checking" ? "正在检查更新。" : "正在下载更新。");
  }

  action = manual ? "manual-check" : "automatic-check";
  updateStatus({
    ...status,
    phase: "checking",
    error: undefined,
    failedAction: undefined,
    progress: undefined,
  });
  try {
    await autoUpdater.checkForUpdates();
    return getDesktopUpdateStatus();
  } catch (error) {
    const message = getErrorMessage(error);
    log.error("Desktop update check failed", { manual, message });
    if (manual) {
      updateStatus({ ...status, phase: "error", error: message, failedAction: "check" });
      throw new Error(message, { cause: error });
    }
    updateStatus({ ...status, phase: "idle", error: undefined });
    return getDesktopUpdateStatus();
  } finally {
    action = undefined;
  }
}

export async function downloadDesktopUpdate(): Promise<DesktopUpdateStatus> {
  if (status.phase !== "available" && status.phase !== "error") {
    throw new Error("当前没有可下载的更新。");
  }
  if (!status.latestVersion) throw new Error("更新版本信息缺失，请重新检查更新。");

  action = "download";
  // electron-updater only registers its quit hook when this flag is enabled at
  // download completion. before-quit recalculates the flag from active runs.
  autoUpdater.autoInstallOnAppQuit = true;
  updateStatus({
    ...status,
    phase: "downloading",
    error: undefined,
    failedAction: undefined,
    progress: 0,
  });
  try {
    await autoUpdater.downloadUpdate();
    return getDesktopUpdateStatus();
  } catch (error) {
    const message = getErrorMessage(error);
    autoUpdater.autoInstallOnAppQuit = false;
    log.error("Desktop update download failed", { version: status.latestVersion, message });
    updateStatus({ ...status, phase: "error", error: message, failedAction: "download" });
    throw new Error(message, { cause: error });
  } finally {
    action = undefined;
  }
}

export function installDesktopUpdate(): void {
  if (status.phase !== "downloaded") throw new Error("更新尚未下载完成。");
  const blockedReason = getActiveRunInstallBlockReason(hasActiveRuns());
  if (blockedReason) {
    updateStatus({ ...status, installBlockedReason: blockedReason });
    throw new Error(blockedReason);
  }

  log.info("Installing desktop update", { version: status.latestVersion });
  autoUpdater.autoInstallOnAppQuit = false;
  installRequested = true;
  autoUpdater.quitAndInstall(false, true);
}

export function prepareDesktopUpdaterForQuit(): void {
  if (!initialized || status.phase === "disabled") return;
  const activeRuns = hasActiveRuns();
  const installOnQuit = shouldInstallDesktopUpdateOnQuit({
    phase: status.phase,
    hasActiveRuns: activeRuns,
    installRequested,
  });
  // Trigger the installer explicitly while Electron is still alive. Toggling
  // autoInstallOnAppQuit here is too late when electron-updater skipped
  // registering its quit handler at download completion.
  autoUpdater.autoInstallOnAppQuit = false;
  log.info("Desktop updater prepared for app quit", {
    installOnQuit,
    blocked: activeRuns,
    version: status.latestVersion,
  });
  if (!installOnQuit) return;

  installRequested = true;
  autoUpdater.quitAndInstall(true, false);
}

export function openDesktopReleasePage(): Promise<void> {
  return shell.openExternal(status.releaseUrl || RELEASE_URL);
}

export async function openDesktopUpdateLogs(): Promise<string> {
  return shell.openPath(app.getPath("logs"));
}

function registerUpdaterEvents(): void {
  autoUpdater.on("checking-for-update", () => {
    log.info("Checking for desktop update", { currentVersion: app.getVersion() });
  });
  autoUpdater.on("update-available", (info) => {
    log.info("Desktop update available", {
      currentVersion: app.getVersion(),
      version: info.version,
    });
    updateStatus(statusFromInfo("available", info));
  });
  autoUpdater.on("update-not-available", (info) => {
    log.info("Desktop is up to date", { currentVersion: app.getVersion(), version: info.version });
    updateStatus({
      ...statusFromInfo("up-to-date", info),
      checkedAt: new Date().toISOString(),
    });
  });
  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    updateStatus({
      ...status,
      phase: "downloading",
      progress: Math.min(100, Math.max(0, progress.percent)),
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    log.info("Desktop update downloaded", { version: info.version });
    updateStatus({ ...statusFromInfo("downloaded", info), progress: 100 });
  });
  autoUpdater.on("error", (error) => {
    const message = getErrorMessage(error);
    log.error("Desktop updater error", { action, message });
    if (action === "automatic-check") {
      updateStatus({ ...status, phase: "idle", error: undefined });
      return;
    }
    updateStatus({
      ...status,
      phase: "error",
      error: message,
      failedAction: action === "download" ? "download" : "check",
    });
  });
}

function statusFromInfo(
  phase: Extract<DesktopUpdateStatus["phase"], "available" | "up-to-date" | "downloaded">,
  info: UpdateInfo,
): DesktopUpdateStatus {
  const release = normalizeDesktopReleaseMetadata(info);
  return {
    phase,
    currentVersion: app.getVersion(),
    latestVersion: info.version,
    releaseName: release.releaseName,
    releaseDate: info.releaseDate,
    releaseNotes: release.releaseNotes,
    releaseUrl: RELEASE_URL,
    checkedAt: new Date().toISOString(),
  };
}

function configureUpdateLogging(): void {
  log.initialize();
  log.transports.file.level = "info";
  log.transports.file.maxSize = 1_048_576;
  log.transports.file.fileName = "updates.log";
  log.transports.console.level = process.env.NODE_ENV === "development" ? "debug" : "warn";
}

function updateStatus(next: DesktopUpdateStatus): void {
  status = next;
  publishStatus(getDesktopUpdateStatus());
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
