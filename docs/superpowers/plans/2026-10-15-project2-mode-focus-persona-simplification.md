# Project 2 — Mode Focus + Persona Simplification + Panelist Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two visible modes (Q&A primary + Drill), first-name persona cards (name + one line, no meters/badges), panelist default 1 selectable up to 3 — with Defense/Boardroom hidden from the UI but fully intact in code.

**Architecture:** One allowlist in `src/lib/experiences.ts` (`VISIBLE_EXPERIENCES`) filters every product surface that lists modes; display strings change in the two data modules (`experiences.ts`, `personas.ts`) so all consumers inherit them; panel-seat defaults move into a small pure module (`panel-seats.ts`) testable without React. No route, schema, API, or mode-key changes.

**Tech Stack:** Next.js 15 (App Router), TypeScript, bun test, `renderToStaticMarkup` for component tests (existing pattern in `src/components/spar/sparring-room.test.tsx`), Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-10-14-project2-mode-focus-persona-simplification-design.md` (all copy below is copied verbatim from it).

## Global Constraints

- Mode keys never change: `open_spar` stays `open_spar` even though the UI says "Q&A". Defense/Boardroom code, prompts, contracts, and tests stay untouched and functional.
- Old sessions saved with `defense`/`boardroom` still open and debrief normally — nothing blocks them.
- Copy verbatim: mode label **"Q&A"**, description **"They ask. You answer. They push back."**; personas **Ada / Victor / Chiara / Marcus / Priya**; card lines **"Questions your core assumptions" / "Digs into your methods and details" / "Challenges your impact and relevance" / "Pushes you to be concise" / "Supports, then finds the weak spot"**.
- Panelists: **default 1** (the experience's lead panelist), **max 3**, any mix of the five; selection persists via the existing `SessionPersona` rows (already implemented — only defaults/bounds change).
- The `/architecture` explorer is internal documentation, NOT a product surface: it keeps documenting all four modes, but its label for `open_spar` syncs to "Q&A" for accuracy.
- No new npm dependencies. Tests: `bun test`; e2e: `bun run test:e2e`; typecheck: `bun run typecheck`; lint: `bun run lint`.
- Tests that pin old display names are UPDATED, never deleted. Tests using old names as arbitrary fixtures that still pass are left alone.
- Do not commit `.superpowers/`. Do not print `.env` contents or any API key.

---

### Task 1: Visible-mode allowlist + Q&A naming

**Files:**
- Modify: `src/lib/experiences.ts`
- Create: `src/lib/experiences.test.ts`
- Modify (comments only): `src/components/spar/sparring-room.tsx:826`, `src/components/spar/waveform-bar.tsx:7`

**Interfaces:**
- Produces: `VISIBLE_EXPERIENCES: readonly ExperienceKey[]` (exactly `["open_spar", "drill"]`) and `VISIBLE_EXPERIENCE_LIST: ExperienceDefinition[]`, exported from `src/lib/experiences.ts`. Later tasks filter every product mode list through these.
- `EXPERIENCES.open_spar.label` becomes `"Q&A"`; `tagline` and `description` both become the locked line. All other fields of every experience (including `defaultPanel`, `openingPrompt`, `roomContext`) are unchanged.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import {
  EXPERIENCES,
  VISIBLE_EXPERIENCES,
  VISIBLE_EXPERIENCE_LIST,
  EXPERIENCE_LIST,
} from "./experiences";

describe("visible experiences", () => {
  test("allowlist is exactly Q&A and Drill, Q&A first", () => {
    expect(VISIBLE_EXPERIENCES).toEqual(["open_spar", "drill"]);
    expect(VISIBLE_EXPERIENCE_LIST.map((e) => e.key)).toEqual([
      "open_spar",
      "drill",
    ]);
  });

  test("open_spar is renamed Q&A with the locked copy; nothing else about it changes", () => {
    const qa = EXPERIENCES.open_spar;
    expect(qa.label).toBe("Q&A");
    expect(qa.tagline).toBe("They ask. You answer. They push back.");
    expect(qa.description).toBe("They ask. You answer. They push back.");
    // unchanged internals
    expect(qa.key).toBe("open_spar");
    expect(qa.userPresentsFirst).toBe(false);
    expect(qa.defaultPanel[0]).toEqual({
      archetype: "skeptic",
      behaviorStyle: "moderate",
    });
  });

  test("hidden modes remain fully defined and in the full list", () => {
    expect(EXPERIENCES.defense.label).toBe("Defense");
    expect(EXPERIENCES.boardroom.label).toBe("Boardroom");
    expect(EXPERIENCES.drill.label).toBe("Drill");
    expect(EXPERIENCE_LIST).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/experiences.test.ts`
Expected: FAIL (`VISIBLE_EXPERIENCES` not exported; label is "Open Spar").

- [ ] **Step 3: Implement.** In `src/lib/experiences.ts`: change `open_spar`'s `label` to `"Q&A"`, `tagline` and `description` to the locked line; add after `EXPERIENCE_LIST`:

```ts
/** Modes reachable in the product UI, in display order (Q&A is primary). */
export const VISIBLE_EXPERIENCES: readonly ExperienceKey[] = [
  "open_spar",
  "drill",
];

export const VISIBLE_EXPERIENCE_LIST = VISIBLE_EXPERIENCES.map(
  (key) => EXPERIENCES[key],
);
```

Update the file's header comment (line ~8-12) to note Defense/Boardroom are hidden from the UI but retained. Update the two code comments that name the mode (`sparring-room.tsx:826` "For Open Spar/Drill" → "For Q&A/Drill"; `waveform-bar.tsx:7` "Defense, Boardroom, Open Spar, Drill" → "Defense, Boardroom, Q&A, Drill").

- [ ] **Step 4: Run test to verify it passes** — `bun test src/lib/experiences.test.ts`
- [ ] **Step 5: Commit**

```bash
git add src/lib/experiences.ts src/lib/experiences.test.ts src/components/spar/sparring-room.tsx src/components/spar/waveform-bar.tsx
git commit -m "feat: visible-mode allowlist with Q&A naming"
```

---

### Task 2: Practice screen — picker filter, defaults, seat model (1 default, max 3)

**Files:**
- Create: `src/components/spar/panel-seats.ts`
- Create: `src/components/spar/panel-seats.test.ts`
- Modify: `src/components/spar/practice-view.tsx` (state defaults ~lines 93-102, picker ~line 584, Step 3 panel ~lines 724-772, seat dialog ~line 925, helper ~lines 1037-1050)
- Modify: `src/app/page.tsx` (~lines 26, 140-148)
- Create: `src/components/spar/practice-view.test.tsx`

**Interfaces:**
- Consumes: `VISIBLE_EXPERIENCE_LIST` from Task 1.
- Explicit non-change: NO routing guard or session-entry block is added anywhere — the SPA has no per-mode URLs, and old `defense`/`boardroom` sessions must keep opening (their rooms render from the session's stored experience). Hiding happens ONLY by filtering what the picker lists.
- Produces (in `panel-seats.ts`, imported by `practice-view.tsx`):

```ts
export interface PanelSeat {
  archetype: ArchetypeKey;
  name: string;
  intensity: 1 | 2 | 3;
  filled: boolean;
}
export const MAX_SEATS = 3;
/** One filled seat: the experience's lead panelist (Q&A and Drill both lead with skeptic). */
export function defaultSeatsFor(experience: ExperienceKey): PanelSeat[];
/** Append an unfilled seat if under MAX_SEATS; otherwise return seats unchanged. */
export function addSeat(seats: PanelSeat[]): PanelSeat[];
```

- [ ] **Step 1: Write the failing tests.** Two files.

`panel-seats.test.ts`:

```ts
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
```

`practice-view.test.tsx`. The picker is Step 2, so `renderToStaticMarkup` (initial render = Step 1) cannot see it — pin the wiring and defaults at source level here; the picker's user-visible behavior is pinned end-to-end by the voice-loop e2e, which drives the real flow and clicks the Q&A button (Task 5):

```tsx
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PracticeView } from "./practice-view";

describe("PracticeView", () => {
  test("renders the first step without crashing", () => {
    const markup = renderToStaticMarkup(
      <PracticeView onSessionCreated={() => {}} onCancel={() => {}} />,
    );
    expect(markup.length).toBeGreaterThan(0);
  });

  test("picker and defaults wired to the visible allowlist", () => {
    const source = readFileSync(
      new URL("./practice-view.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("VISIBLE_EXPERIENCE_LIST.map"); // picker source
    expect(source).not.toContain("EXPERIENCE_LIST.map");
    expect(source).toContain('useState<ExperienceKey>("open_spar")');
    expect(source).toContain("defaultSeatsFor(\"open_spar\")");
    expect(source).toContain("addSeat"); // add-panelist affordance
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/components/spar/panel-seats.test.ts src/components/spar/practice-view.test.tsx`
Expected: FAIL (`panel-seats.ts` missing; picker renders "Defense"/"Boardroom").

- [ ] **Step 3: Implement.**

Create `panel-seats.ts` with the interface above; `defaultSeatsFor` maps `EXPERIENCES[experience].defaultPanel[0]` to one filled seat (`name: ARCHETYPES[p.archetype].defaultName`, intensity from behavior style — move the existing mapping from `practice-view.tsx:1037-1050`); `addSeat` appends `{ archetype: "skeptic", name: "", intensity: 2, filled: false }` only when `seats.length < MAX_SEATS`.

In `practice-view.tsx`:
- Delete the local `PanelSeat` interface and `defaultSeatsForExperience` helper; import from `./panel-seats`.
- Default state: `useState<ExperienceKey>("open_spar")` (line 93) and `useState<PanelSeat[]>(defaultSeatsFor("open_spar"))` (lines 100-101).
- Picker: `EXPERIENCE_LIST.map` → `VISIBLE_EXPERIENCE_LIST.map` (line 584).
- `selectExperience` (line 109-114) keeps resetting seats via `defaultSeatsFor(key)`.
- Step 3 (`Step3Panel`): after the seats row, add an "Add panelist" button when `seats.length < MAX_SEATS` calling `setSeats(addSeat(seats))`; hide it at the cap:

```tsx
{seats.length < MAX_SEATS && (
  <button
    onClick={() => setSeats(addSeat(seats))}
    className="flex w-[140px] sm:w-[160px] flex-col items-center justify-center rounded-md border border-dashed border-[#252525] py-8 transition-all hover:border-[#3a3a3a] hover:bg-[#0f0f0f]"
  >
    <span className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1">
      Add panelist
    </span>
    <span className="text-xs text-neutral-500">Up to {MAX_SEATS}</span>
  </button>
)}
```

- Seat dialog archetype button (line 925): `{arch.defaultName.replace("The ", "")}` → `{arch.defaultName}` (first names need no stripping).

In `src/app/page.tsx`:
- Line 26: `useState<ExperienceKey>("defense")` → `useState<ExperienceKey>("open_spar")`.
- `preparingMap` (lines 140-147): every value becomes `"open_spar"` (thesis/pitch/board/conference land on Q&A until Defense/Boardroom return; keep the map structure with a comment saying so).

- [ ] **Step 4: Run tests to verify they pass** — `bun test src/components/spar/panel-seats.test.ts src/components/spar/practice-view.test.tsx`
- [ ] **Step 5: Commit** — `git add src/components/spar/panel-seats.ts src/components/spar/panel-seats.test.ts src/components/spar/practice-view.tsx src/components/spar/practice-view.test.tsx src/app/page.tsx && git commit -m "feat: Q&A-first picker with one-panelist default"`

---

### Task 3: Persona first names, one-liners, initials

**Files:**
- Modify: `src/lib/personas.ts` (five `defaultName`s, five `tagline`s, five `initials`, header comment)
- Create: `src/lib/personas.test.ts`
- Modify: any test files that fail on old names (find with the grep below)

**Interfaces:**
- Produces: `ARCHETYPES.skeptic.defaultName === "Ada"`, `.nitpicker === "Victor"`, `.so_what === "Chiara"`, `.timekeeper === "Marcus"`, `.ally === "Priya"`; `initials` become `"A"`, `"V"`, `"C"`, `"M"`, `"P"`; `tagline`s become the five locked card lines. Keys, lens, triggers, questionTemplates, forbidden, accent fields unchanged. System prompts inherit the names automatically (`buildPersonaStablePrefix` reads `defaultName` — "You are Ada, a Spar panelist").

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import { ARCHETYPES, buildPersonaStablePrefix } from "./personas";

const EXPECTED: Record<string, { name: string; tagline: string; initials: string }> = {
  skeptic: { name: "Ada", tagline: "Questions your core assumptions", initials: "A" },
  nitpicker: { name: "Victor", tagline: "Digs into your methods and details", initials: "V" },
  so_what: { name: "Chiara", tagline: "Challenges your impact and relevance", initials: "C" },
  timekeeper: { name: "Marcus", tagline: "Pushes you to be concise", initials: "M" },
  ally: { name: "Priya", tagline: "Supports, then finds the weak spot", initials: "P" },
};

describe("persona display", () => {
  test("first names, one-liners, initials for all five", () => {
    for (const [key, want] of Object.entries(EXPECTED)) {
      const a = ARCHETYPES[key as keyof typeof ARCHETYPES];
      expect(a.defaultName).toBe(want.name);
      expect(a.tagline).toBe(want.tagline);
      expect(a.initials).toBe(want.initials);
    }
  });

  test("prompt identity follows the first name; behavior blocks unchanged", () => {
    const prompt = buildPersonaStablePrefix({ archetype: "skeptic", behaviorStyle: "moderate" });
    expect(prompt).toContain("You are Ada, a Spar panelist");
    expect(prompt).toContain(ARCHETYPES.skeptic.lens);
    expect(prompt).toContain(ARCHETYPES.skeptic.forbidden[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `bun test src/lib/personas.test.ts` (names are "The Skeptic" etc.)
- [ ] **Step 3: Implement.** Update the five `defaultName`s, `tagline`s, and `initials` in `personas.ts` per the table above; adjust the header comment (lines 8-11: names are first names now). Then run the FULL suite: `bun test`. Fix only tests that actually fail because they pinned "The Skeptic"-style names (find candidates: `grep -rln "The Skeptic\|The Nitpicker\|The So-What\|The Timekeeper\|The Ally" src tests/e2e --include="*.test.*" --include="*.spec.*"`). Do not weaken any assertion — swap the expected name to the new one.
- [ ] **Step 4: Run tests to verify they pass** — `bun test src/lib/personas.test.ts` then full `bun test` (0 fail).
- [ ] **Step 5: Commit** — `git add src/lib/personas.ts src/lib/personas.test.ts <failing-test-files-fixed> && git commit -m "feat: persona first names and one-line cards copy"`

---

### Task 4: Simplified persona card (name + one line, no meters, no badges)

**Files:**
- Modify: `src/components/spar/persona-card.tsx`
- Create: `src/components/spar/persona-card.test.tsx`
- Modify: `src/components/spar/sparring-room.tsx:982-991, 1218-1226` (two `PersonaCard` call sites)
- Modify: `src/components/spar/sparring-mockup.tsx` (mock panel names)

**Interfaces:**
- `PersonaCardProps` loses `behaviorStyle` and `agitation`; keeps `archetype`, `name`, `state`, `mood`, `variant`. The card renders: avatar, name, tagline (the one line, non-compact only), and the quiet status line (Listening/Thinking/Speaking — the live indicator that stays). The behavior badge and the 5-dot interrupt meter are deleted. `about-to-interrupt` accent-border behavior is untouched.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PersonaCard } from "./persona-card";

describe("PersonaCard", () => {
  const markup = renderToStaticMarkup(
    <PersonaCard archetype="skeptic" name="Ada" state="idle" mood="neutral" />,
  );

  test("renders name and the one line", () => {
    expect(markup).toContain("Ada");
    expect(markup).toContain("Questions your core assumptions");
    expect(markup).toContain("Listening");
  });

  test("no behavior badge and no interrupt meter", () => {
    for (const badge of ["Gentle", "Moderate", "Aggressive"]) {
      expect(markup).not.toContain(`>${badge}<`);
    }
    expect(markup).not.toContain("h-1 flex-1 rounded-full"); // meter dot bars
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `bun test src/components/spar/persona-card.test.tsx` (badge "Moderate" renders; meter bars present).
- [ ] **Step 3: Implement.** In `persona-card.tsx`: delete `BEHAVIOR_LABELS`, the badge `<span>` (lines 98-100), the interrupt-meter block (lines 130-153), and the `behaviorStyle`/`agitation` props (interface + destructuring + doc comment mentions). In `sparring-room.tsx`, remove `behaviorStyle={...}` and `agitation={...}` from both `PersonaCard` call sites (agitation state itself stays — the engine still runs; only the card display goes). In `sparring-mockup.tsx`, replace old display names ("The Skeptic" ~line 170, "So-What" ~line 244, and any "The Nitpicker"/"Timekeeper"/"The Ally" in the mock panel + `MockupPersonaCard` name props) with the first names; drop meter-ish visuals in `MockupPersonaCard` if it renders any.
- [ ] **Step 4: Run tests to verify they pass** — `bun test src/components/spar/persona-card.test.tsx` then full `bun test`.
- [ ] **Step 5: Commit** — `git add src/components/spar/persona-card.tsx src/components/spar/persona-card.test.tsx src/components/spar/sparring-room.tsx src/components/spar/sparring-mockup.tsx && git commit -m "feat: simplified persona cards"`

---

### Task 5: Explorer labels + e2e sync

**Files:**
- Modify: `src/components/architecture/experience-flows.tsx:19` (label map)
- Modify: `src/architecture/manifest.ts:333` (node label "Configure Open Spar")
- Modify: `tests/e2e/architecture.spec.ts:23`, `tests/e2e/voice-loop.spec.ts:608`
- Modify: whichever of `src/architecture/experience-flows.test.ts` / `src/components/architecture/experience-flows.test.ts` / `src/architecture/validate.test.ts` pin "Open Spar"

**Interfaces:**
- Consumes: "Q&A" label from Task 1. The explorer keeps documenting ALL FOUR modes (hidden ≠ deleted) — only the `open_spar` display label changes.

- [ ] **Step 1: Find every pin.** Run: `grep -rn "Open Spar" src tests --include="*.ts" --include="*.tsx"`. Expected hits: the four files above plus zero or more test pins.
- [ ] **Step 2: Update them.** `experience-flows.tsx` label map: `open_spar: "Open Spar"` → `open_spar: "Q&A"`. `manifest.ts:333`: `label: "Configure Open Spar"` → `label: "Configure Q&A"`. `architecture.spec.ts:23`: `{ label: "Open Spar", id: "open_spar" }` → `{ label: "Q&A", id: "open_spar" }`. `voice-loop.spec.ts:608`: `{ name: /^Open Spar/i }` → `{ name: /^Q&A/i }`. Update each test pin found in Step 1 the same way (expected value → "Q&A"; assertions about mode count/steps unchanged).
- [ ] **Step 3: Verify.** `bun test` (0 fail) and `bun run test:e2e` (all pass).
- [ ] **Step 4: Commit** — `git add <files-touched> && git commit -m "chore: sync explorer and e2e labels to Q&A"`

---

### Task 6: README + worklog + full verification

**Files:**
- Modify: `README.md` (mode list ~lines 10-12)
- Modify: `worklog.md` (new entry, house format)

- [ ] **Step 1: README.** Update the experience list to the two visible modes:

```markdown
- **Q&A** — They ask. You answer. They push back.
- **Drill** — Hammer one weakness until it's fixed

Defense and Boardroom are currently hidden from the UI (code retained for later re-introduction).
```

Leave the engine sections (lines ~123-125) as-is — they accurately describe internals that still serve hidden modes.
- [ ] **Step 2: Worklog.** Append an entry in the house format (Task ID / Agent / Task / Work Log / Stage Summary): what shipped (Q&A+Drill focus, allowlist, first names, simplified cards, 1-default/3-max panelists), how to try it (start dev server → practice screen), and that old Defense/Boardroom sessions still open.
- [ ] **Step 3: Full verification** — `bun test && bun run test:e2e && bun run typecheck && bun run lint && bun run build && git diff --check` — all exit 0.
- [ ] **Step 4: Commit** — `git add README.md worklog.md && git commit -m "docs: document mode focus and persona simplification"`

## Deferred (explicit)

- Coupling the default drill panelist to `DRILL_TARGETS.leadArchetype` (default stays the experience lead — Ada — for both modes).
- Re-introducing Defense/Boardroom to the UI (roadmap "explicitly deferred").
- Room/practice/home visual redesign — Projects 3 and 4; this plan changes content and defaults only, not layout.
