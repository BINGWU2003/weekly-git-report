import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { BrowserWindow, app, shell } from "electron";
import { join } from "node:path";

import { registerIpcHandlers } from "./ipc/register-ipc.js";

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

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.weeklygitreport.desktop");
  registerIpcHandlers();

  app.on("browser-window-created", (_event, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
