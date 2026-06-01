import type { Config, Period } from "@weekly-git-report/shared";

export interface ResolvePeriodOptions {
  since?: string;
  until?: string;
}

export function resolvePeriod(
  config: Config,
  options: ResolvePeriodOptions = {},
): Period {
  const since = options.since ?? config.defaultSince;
  const until = options.until ?? config.defaultUntil;

  return {
    start: resolveDateString(since, "since"),
    end: resolveDateString(until, "until"),
  };
}

function resolveDateString(value: string, field: "since" | "until"): string {
  const normalized = value.trim().toLowerCase();

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  if (field === "since" && normalized === "last monday") {
    return formatDate(getThisMonday());
  }

  if (field === "until" && normalized === "now") {
    return formatDate(new Date());
  }

  throw new Error(`Unsupported ${field} value: ${value}`);
}

function getThisMonday(): Date {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
