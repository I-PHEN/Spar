import { describe, expect, test } from "bun:test";
import { MAX_SEATS, defaultSeatsFor, addSeat } from "./panel-seats";

describe("panel seats", () => {
  test("default is exactly one filled seat — the experience's lead panelist", () => {
    const qa = defaultSeatsFor("open_spar");
    expect(qa).toHaveLength(1);
    expect(qa[0].archetype).toBe("skeptic");
    expect(qa[0].filled).toBe(true);
    expect(qa[0].intensity).toBe(2); // open_spar lead is moderate

    const drill = defaultSeatsFor("drill");
    expect(drill).toHaveLength(1);
    expect(drill[0].archetype).toBe("skeptic");
    expect(drill[0].intensity).toBe(3); // drill lead is aggressive
  });

  test("addSeat appends an unfilled seat up to MAX_SEATS, then stops", () => {
    let seats = defaultSeatsFor("open_spar");
    seats = addSeat(seats);
    seats = addSeat(seats);
    expect(seats).toHaveLength(3);
    expect(seats.filter((s) => s.filled)).toHaveLength(1);
    expect(addSeat(seats)).toBe(seats); // unchanged at cap
  });

  test("hidden experiences still produce a lead seat (old defaults kept callable)", () => {
    expect(defaultSeatsFor("defense")[0].archetype).toBe("skeptic");
  });
});
