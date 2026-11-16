import { describe, expect, test } from "bun:test";
import {
  buildMomentIcs,
  combineMomentDateAndTime,
  extractMomentDateInput,
  extractMomentTimeInput,
  formatMomentCountdown,
  getDaysUntilMoment,
  isMomentUpcoming,
  parseServerMomentDate,
} from "./moment-calendar";

describe("moment-calendar helpers", () => {
  test("parseServerMomentDate anchors date-only strings to 23:59:59Z so same-day moments do not vanish", () => {
    const parsed = parseServerMomentDate("2026-11-15");
    expect(parsed).not.toBeNull();
    expect(parsed?.toISOString()).toBe("2026-11-15T23:59:59.000Z");

    const nowMidday = new Date("2026-11-15T14:30:00.000Z");
    expect(isMomentUpcoming(parsed!, nowMidday)).toBe(true);
    expect(isMomentUpcoming(new Date("2026-11-14T23:59:59.000Z"), new Date(2026, 10, 15, 10, 0))).toBe(false);
  });

  test("combineMomentDateAndTime handles date-only and explicit HH:MM time cleanly", () => {
    const dateOnlyIso = combineMomentDateAndTime("2026-11-20", "");
    expect(dateOnlyIso).toBeTruthy();
    expect(extractMomentTimeInput(dateOnlyIso!)).toBe("");
    expect(extractMomentDateInput(dateOnlyIso!)).toBe("2026-11-20");

    const timedIso = combineMomentDateAndTime("2026-11-20", "09:30");
    expect(timedIso).toBeTruthy();
    expect(extractMomentTimeInput(timedIso!)).toBe("09:30");
    expect(extractMomentDateInput(timedIso!)).toBe("2026-11-20");
  });

  test("getDaysUntilMoment and formatMomentCountdown use calendar days", () => {
    const now = new Date(2026, 10, 15, 22, 0, 0);
    const todayEvening = new Date(2026, 10, 15, 23, 59, 59);
    const tomorrowMorning = new Date(2026, 10, 16, 8, 30, 0);
    const nextWeek = new Date(2026, 10, 22, 12, 0, 0);

    expect(getDaysUntilMoment(todayEvening, now)).toBe(0);
    expect(formatMomentCountdown(0)).toBe("Today");

    expect(getDaysUntilMoment(tomorrowMorning, now)).toBe(1);
    expect(formatMomentCountdown(1)).toBe("Tomorrow");

    expect(getDaysUntilMoment(nextWeek, now)).toBe(7);
    expect(formatMomentCountdown(7)).toBe("7d left");
  });

  test("buildMomentIcs creates valid VCALENDAR with reminder VALARM", () => {
    const timed = combineMomentDateAndTime("2026-11-20", "09:30")!;
    const icsTimed = buildMomentIcs({
      id: "m1",
      title: "Series A Pitch",
      detail: "Focus on gross margin",
      date: timed,
    });
    expect(icsTimed).toContain("BEGIN:VCALENDAR");
    expect(icsTimed).toContain("SUMMARY:Spar: Series A Pitch");
    expect(icsTimed).toContain("BEGIN:VALARM");
    expect(icsTimed).toContain("DTSTART:");
    expect(icsTimed).not.toContain("DTSTART;VALUE=DATE:");

    const allDay = combineMomentDateAndTime("2026-11-20", "")!;
    const icsAllDay = buildMomentIcs({
      id: "m2",
      title: "Board Review",
      date: allDay,
    });
    expect(icsAllDay).toContain("DTSTART;VALUE=DATE:20261120");
  });
});
