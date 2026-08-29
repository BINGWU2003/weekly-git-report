import type { Period, ReportType } from "@weekly-git-report/shared";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function validateSummaryPeriod(reportType: ReportType, period: Period): Period {
  const start = parseDate(period.start);
  const end = parseDate(period.end);
  if (end < start) throw new Error("Summary period end cannot be before start.");

  if (reportType === "custom") {
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (days > 366) throw new Error("Custom report period cannot exceed 366 days.");
    const today = new Date();
    const localToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    if (end.getTime() > localToday) {
      throw new Error("Custom report period cannot include future dates.");
    }
    return period;
  }

  if (reportType === "daily") {
    if (period.start !== period.end) {
      throw new Error("Daily summary requires the same start and end date.");
    }
    return period;
  }

  if (reportType === "weekly") {
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
