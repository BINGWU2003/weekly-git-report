import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { BrowserWindow, app, shell } from "electron";
import { join } from "node:path";

import { IPC_CHANNELS } from "../../shared/ipc.js";
import { registerIpcHandlers } from "./ipc/register-ipc.js";
import {
  cancelActiveManualRuns,
  hasActiveDesktopRuns,
  runDesktopTask,
} from "./services/desktop-service.js";
import {
  initializeDesktopUpdater,
  prepareDesktopUpdaterForQuit,
} from "./services/update-service.js";

function isExternalUrl(url: string): boolean {
  try {
    const target = new URL(url);

    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return false;
    }

    const rendererUrl = process.env.ELECTRON_RENDERER_URL;
    return !rendererUrl || target.origin !== new URL(rendererUrl).origin;
  } catch {
    return false;
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    icon: join(__dirname, "../../resources/icon.png"),
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#09090b",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      devTools: is.dev,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (is.dev) {
    mainWindow.webContents.once("did-finish-load", () => {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    });
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isExternalUrl(url)) return;

    event.preventDefault();
    void shell.openExternal(url);
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId("com.weeklygitreport.desktop");
  const scheduledTaskIndex = process.argv.indexOf("--run-task");
  const scheduledTaskId =
    scheduledTaskIndex >= 0 ? process.argv[scheduledTaskIndex + 1] : undefined;
  if (scheduledTaskId) {
    try {
      await runDesktopTask(scheduledTaskId, "scheduled");
      app.exit(0);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      app.exit(1);
    }
    return;
  }
  registerIpcHandlers();
  initializeDesktopUpdater({
    hasActiveRuns: hasActiveDesktopRuns,
    onStatusChange: (status) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.webContents.isDestroyed()) {
          window.webContents.send(IPC_CHANNELS.updatesStatusChanged, status);
        }
      }
    },
  });

  app.on("browser-window-created", (_event, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  prepareDesktopUpdaterForQuit();
  cancelActiveManualRuns();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
