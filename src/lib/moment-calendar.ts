export interface MomentLike {
  id?: string;
  title: string;
  detail?: string | null;
  date: Date | string;
}

const MS_PER_DAY = 86_400_000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toValidDate(input: Date | string): Date | null {
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local YYYY-MM-DD formatted for `<input type="date">`. */
export function formatDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDaysToDateInput(daysFromToday: number, now = new Date()): string {
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromToday);
  return formatDateInputValue(target);
}

/** Returns local YYYY-MM-DD from an ISO/Date value for pre-filling `<input type="date">`. */
export function extractMomentDateInput(input: Date | string): string {
  const d = toValidDate(input);
  if (!d) return "";
  // Legacy date-only rows stored at midnight UTC: preserve calendar date cleanly.
  if (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  ) {
    return d.toISOString().slice(0, 10);
  }
  return formatDateInputValue(d);
}

export function hasExplicitMomentTime(input: Date | string): boolean {
  const d = toValidDate(input);
  if (!d) return false;
  if (d.getSeconds() === 59) return false;
  if (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  ) {
    return false;
  }
  return true;
}

export function extractMomentTimeInput(input: Date | string): string {
  const d = toValidDate(input);
  if (!d || !hasExplicitMomentTime(d)) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Combines `<input type="date">` (YYYY-MM-DD) and optional `<input type="time">` (HH:MM)
 * in the caller's local timezone. Date-only values use 23:59:59 local so same-day
 * moments stay active all day without colliding with timed moments.
 */
export function combineMomentDateAndTime(
  dateStr: string,
  timeStr?: string | null,
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const cleanTime = timeStr?.trim();
  const timeMatch = cleanTime ? /^(\d{2}):(\d{2})$/.exec(cleanTime) : null;
  const d = timeMatch
    ? new Date(year, month - 1, day, Number(timeMatch[1]), Number(timeMatch[2]), 0, 0)
    : new Date(year, month - 1, day, 23, 59, 59, 0);

  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Server-side date parser for `/api/upcoming-moment`.
 * Raw YYYY-MM-DD strings are anchored to end-of-day UTC so same-day moments stay valid.
 */
export function parseServerMomentDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T23:59:59.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isMomentUpcoming(dateInput: Date | string, now = new Date()): boolean {
  const d = toValidDate(dateInput);
  if (!d) return false;
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  return d.getTime() >= startOfToday.getTime();
}

export function getDaysUntilMoment(
  dateInput: Date | string,
  now = new Date(),
): number {
  const d = toValidDate(dateInput);
  if (!d) return 0;

  // Handle legacy midnight-UTC date-only values consistently without shifting back a day in negative TZ.
  const isLegacyMidnightUtc =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;

  const targetDay = isLegacyMidnightUtc
    ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((targetDay.getTime() - todayDay.getTime()) / MS_PER_DAY);
}

export function formatMomentCountdown(daysUntil: number): string {
  if (daysUntil <= 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `${daysUntil}d left`;
}

export function formatMomentDisplayDate(dateInput: Date | string): string {
  const d = toValidDate(dateInput);
  if (!d) return "";

  const isLegacyMidnightUtc =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;

  const datePart = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(isLegacyMidnightUtc ? { timeZone: "UTC" } : {}),
  });

  if (!hasExplicitMomentTime(d)) {
    return datePart;
  }

  const timePart = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart} · ${timePart}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatIcsUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}

function formatIcsLocalDateCompact(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

/** Builds an RFC 5545 .ics calendar invite with a 1-hour advance VALARM reminder. */
export function buildMomentIcs(moment: MomentLike, now = new Date()): string {
  const d = toValidDate(moment.date) ?? now;
  const uid = `${moment.id || "moment"}-${d.getTime()}@spar.local`;
  const stamp = formatIcsUtcStamp(now);
  const timed = hasExplicitMomentTime(d);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Spar//Upcoming Moment//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
  ];

  if (timed) {
    const end = new Date(d.getTime() + 45 * 60 * 1000);
    lines.push(`DTSTART:${formatIcsUtcStamp(d)}`);
    lines.push(`DTEND:${formatIcsUtcStamp(end)}`);
  } else {
    const dayStr = formatIcsLocalDateCompact(d);
    const nextDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${dayStr}`);
    lines.push(`DTEND;VALUE=DATE:${formatIcsLocalDateCompact(nextDay)}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(`Spar: ${moment.title}`)}`);
  lines.push(
    `DESCRIPTION:${escapeIcsText(
      moment.detail?.trim()
        ? `${moment.detail.trim()}\\n\\nPractice your toughest Q&A rounds in Spar beforehand.`
        : "High-stakes preparation milestone scheduled in Spar.",
    )}`,
  );
  lines.push("BEGIN:VALARM");
  lines.push("TRIGGER:-PT60M");
  lines.push("ACTION:DISPLAY");
  lines.push(`DESCRIPTION:${escapeIcsText(`Upcoming in 1 hour: ${moment.title}`)}`);
  lines.push("END:VALARM");
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return `${lines.join("\r\n")}\r\n`;
}

export function triggerMomentIcsDownload(moment: MomentLike): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const ics = buildMomentIcs(moment);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const slug =
    moment.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "moment";
  const a = document.createElement("a");
  a.href = url;
  a.download = `spar-${slug}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
