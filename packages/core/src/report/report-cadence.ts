import type { Period, ReportCadence } from "@weekly-git-report/shared";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function validateSummaryPeriod(cadence: ReportCadence, period: Period): Period {
  const start = parseDate(period.start);
  const end = parseDate(period.end);
  if (end < start) throw new Error("Summary period end cannot be before start.");

  if (cadence === "daily") {
    if (period.start !== period.end) {
      throw new Error("Daily summary requires the same start and end date.");
    }
    return period;
  }

  if (cadence === "weekly") {
    if (start.getUTCDay() !== 1) {
      throw new Error("Weekly summary must start on Monday.");
    }
    const lastDay = new Date(start);
    lastDay.setUTCDate(lastDay.getUTCDate() + 6);
    if (end > lastDay) {
      throw new Error("Weekly summary must end between Monday and Sunday of the same week.");
    }
    return period;
  }

  if (!period.start.endsWith("-01") || period.start.slice(0, 7) !== period.end.slice(0, 7)) {
    throw new Error("Monthly summary must start on day 01 and end in the same month.");
  }
  return period;
}

function parseDate(value: string): Date {
  const match = DATE_PATTERN.exec(value);
  if (!match?.[1] || !match[2] || !match[3]) throw new Error(`Invalid date: ${value}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}
