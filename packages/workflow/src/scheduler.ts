import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { ReportTask } from "@weekly-git-report/shared";
import { writeTextAtomic } from "@weekly-git-report/core";

const execFileAsync = promisify(execFile);

export interface SchedulerCommand {
  executable: string;
  args: string[];
}

export async function registerTaskSchedule(
  task: ReportTask,
  command: SchedulerCommand,
): Promise<void> {
  if (process.platform === "win32") return registerWindows(task, command);
  if (process.platform === "darwin") return registerLaunchd(task, command);
  return registerSystemd(task, command);
}

export async function unregisterTaskSchedule(taskId: string): Promise<void> {
  const name = schedulerName(taskId);
  if (process.platform === "win32") {
    await ignoreMissing(() =>
      execFileAsync("schtasks.exe", ["/Delete", "/TN", name, "/F"], { windowsHide: true }),
    );
    return;
  }
  if (process.platform === "darwin") {
    const file = path.join(os.homedir(), "Library", "LaunchAgents", `${name}.plist`);
    await ignoreMissing(() => execFileAsync("launchctl", ["unload", file]));
    const { rm } = await import("node:fs/promises");
    await rm(file, { force: true });
    return;
  }
  await ignoreMissing(() =>
    execFileAsync("systemctl", ["--user", "disable", "--now", `${name}.timer`]),
  );
  const directory = path.join(os.homedir(), ".config", "systemd", "user");
  const { rm } = await import("node:fs/promises");
  await Promise.all([
    rm(path.join(directory, `${name}.service`), { force: true }),
    rm(path.join(directory, `${name}.timer`), { force: true }),
  ]);
  await execFileAsync("systemctl", ["--user", "daemon-reload"]);
}

async function registerWindows(task: ReportTask, command: SchedulerCommand): Promise<void> {
  const schedule =
    task.cadence === "daily" ? "WEEKLY" : task.cadence === "weekly" ? "WEEKLY" : "MONTHLY";
  const args = [
    "/Create",
    "/F",
    "/TN",
    schedulerName(task.id),
    "/TR",
    windowsCommand(command),
    "/SC",
    schedule,
    "/ST",
    `${pad(task.schedule.hour)}:${pad(task.schedule.minute)}`,
  ];
  if (task.cadence === "daily")
    args.push(
      "/D",
      task.schedule.includeWeekends ? "MON,TUE,WED,THU,FRI,SAT,SUN" : "MON,TUE,WED,THU,FRI",
    );
  if (task.cadence === "weekly") args.push("/D", "MON");
  if (task.cadence === "monthly") args.push("/D", "1");
  await execFileAsync("schtasks.exe", args, { windowsHide: true });
}

async function registerLaunchd(task: ReportTask, command: SchedulerCommand): Promise<void> {
  const directory = path.join(os.homedir(), "Library", "LaunchAgents");
  const file = path.join(directory, `${schedulerName(task.id)}.plist`);
  await mkdir(directory, { recursive: true });
  await writeTextAtomic(file, renderLaunchd(task, command));
  await ignoreMissing(() => execFileAsync("launchctl", ["unload", file]));
  await execFileAsync("launchctl", ["load", file]);
}

async function registerSystemd(task: ReportTask, command: SchedulerCommand): Promise<void> {
  const name = schedulerName(task.id);
  const directory = path.join(os.homedir(), ".config", "systemd", "user");
  await mkdir(directory, { recursive: true });
  await writeTextAtomic(
    path.join(directory, `${name}.service`),
    [
      "[Unit]",
      `Description=weekly-git-report ${task.name}`,
      "",
      "[Service]",
      "Type=oneshot",
      `ExecStart=${systemdCommand(command)}`,
      "",
    ].join("\n"),
  );
  await writeTextAtomic(
    path.join(directory, `${name}.timer`),
    [
      "[Unit]",
      `Description=weekly-git-report ${task.name}`,
      "",
      "[Timer]",
      `OnCalendar=${systemdCalendar(task)}`,
      "Persistent=false",
      "",
      "[Install]",
      "WantedBy=timers.target",
      "",
    ].join("\n"),
  );
  await execFileAsync("systemctl", ["--user", "daemon-reload"]);
  await execFileAsync("systemctl", ["--user", "enable", "--now", `${name}.timer`]);
}

function renderLaunchd(task: ReportTask, command: SchedulerCommand): string {
  const calendar =
    task.cadence === "daily"
      ? (task.schedule.includeWeekends ? [1, 2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6])
          .map(
            (weekday) =>
              `<dict><key>Weekday</key><integer>${weekday}</integer><key>Hour</key><integer>${task.schedule.hour}</integer><key>Minute</key><integer>${task.schedule.minute}</integer></dict>`,
          )
          .join("")
      : task.cadence === "weekly"
        ? `<dict><key>Weekday</key><integer>2</integer><key>Hour</key><integer>${task.schedule.hour}</integer><key>Minute</key><integer>${task.schedule.minute}</integer></dict>`
        : `<dict><key>Day</key><integer>1</integer><key>Hour</key><integer>${task.schedule.hour}</integer><key>Minute</key><integer>${task.schedule.minute}</integer></dict>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${escapeXml(schedulerName(task.id))}</string><key>ProgramArguments</key><array>${[command.executable, ...command.args].map((value) => `<string>${escapeXml(value)}</string>`).join("")}</array><key>StartCalendarInterval</key>${task.cadence === "daily" ? `<array>${calendar}</array>` : calendar}</dict></plist>\n`;
}

function systemdCalendar(task: ReportTask): string {
  const time = `${pad(task.schedule.hour)}:${pad(task.schedule.minute)}:00`;
  if (task.cadence === "daily")
    return `${task.schedule.includeWeekends ? "*-*-*" : "Mon..Fri"} ${time}`;
  if (task.cadence === "weekly") return `Mon *-*-* ${time}`;
  return `*-*-01 ${time}`;
}

function windowsCommand(command: SchedulerCommand): string {
  return [command.executable, ...command.args].map(quoteWindows).join(" ");
}

function systemdCommand(command: SchedulerCommand): string {
  return [command.executable, ...command.args]
    .map((value) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`)
    .join(" ");
}

function quoteWindows(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function schedulerName(taskId: string): string {
  return `weekly-git-report-${taskId.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function ignoreMissing(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch {
    /* schedule may not exist */
  }
}
