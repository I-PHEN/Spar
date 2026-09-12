# SharkPit — Project Worklog

---
Task ID: 1
Agent: general-purpose (research)
Task: Competitive + market research for SharkPit

Work Log:
- Loaded web-search and web-reader skills (correct CLI: `z-ai function -n web_search -a '{...}'`, not `z-ai web-search`).
- Ran ~14 parallel/sequential web searches via z-ai CLI covering: Yoodli, Speeko, Orai, Poised, MS Speaker Coach, Google Interview Warmup, Praktika, TalkMe, AI debate tools, AI pitch practice tools, AI sales roleplay tools, Verble, VoxStar, Adaptain/cross-session memory AI coaches, OpenAI Realtime API maturity, executive coaching marketplaces (BetterUp/Torch/CoachHub), presentation design tools (Beautiful.AI/Gamma), and category funding/market size signals.
- Two page_reader calls on Yoodli's announcement pages timed out (1 MiB SSE frame limit) — pivoted to web_search snippets, which gave enough signal.
- Cross-referenced Yoodli's official feature-announcement blog and help center pages to verify the multi-persona + interruption + analytics capabilities.
- Verified OpenAI Realtime API / gpt-realtime / GPT-Live "turnless speech model" shipping timeline (Nov 2024 → Aug 2025 → Aug 2026) to assess voice AI maturity.
- Pulled Yoodli funding data (Series A $13.7M May 2025, Series B $40M Dec 2025, $300M+ valuation, $60M total raised) via TechCrunch + Madrona + Tracxn.
- Synthesized findings into the structured report returned to the founder.

Stage Summary:
- **Biggest red flag identified:** Yoodli has already shipped "Multi-Persona Roleplays" (Apr 1, 2025) supporting up to 3 AI personas per session with custom voice/tone/demeanor, plus an explicit instruction capability to interrupt users mid-speech. Combined with a Builder (custom personas), VC pitch coach, and Admin Analytics Hub tracking progress over time, Yoodli is currently executing ~80% of SharkPit's vision with $60M raised and a $300M+ valuation (Dec 2025). Direct head-on collision course.
- **Cross-session memory is the open wedge:** No competitor has personas that genuinely adapt their behavior based on remembered user patterns (e.g., "you deflect when pushed on financials"). Yoodli tracks *metrics* over time, but personas are stateless per-session. Adaptain and Hedy are emerging "AI with memory" plays in adjacent categories but not in the sparring/persona-panel space.
- **Voice AI tech is no longer the bottleneck:** OpenAI GPT-Live (Aug 2026) ships a "turnless speech model" — real-time interruption is now commodity infrastructure. This de-risks SharkPit's tech but also lowers the barrier for fast followers.
- **Category is heating up:** Yoodli $40M Series B (Dec 2025), Speak $1B valuation (Dec 2024), VoxStar launched Aug 2026 for debaters. AI coaching market estimated $4-5B in 2025, growing 18-22% CAGR.
- **Google Interview Warmup was killed April 2026** — a cautionary signal about free Google entries in this space not surviving, but also a market gap.
- Artifacts produced: this worklog + the full report returned in the agent's final message. No code artifacts created (research-only task).

---
Task ID: 2
Agent: main (engineering / architect)
Task: First-principles analysis + architecture decision log + scope the first solid thing

Work Log:
- Read full product brief (17 pages).
- Synthesized research findings into 3 strategic wedges: (1) cross-session behavioral memory, (2) archetype vocabulary as IP, (3) coaching-debrief-as-hero-artifact.
- Defined the irreducible core of the product: real-pressure simulation + interruption + memory + specific evidence-based feedback.
- Scoped the first solid thing: a complete Practice → Sparring → Debrief loop, text-first.

Stage Summary — Architecture Decision Log (ADL):

**Decision 1 — Text-first, voice-second.**
Rationale: Voice AI is now commodity infrastructure (GPT-Live Aug 2026). The differentiator is NOT voice — it's the AI behavior (content-grounded interruption + cross-session memory + coaching debrief). Text-first lets us iterate on persona behavior 10x faster than voice, without latency/interruption complexity. Voice is a layer we add in solid thing #2 once the behavior model is proven.
Implication: The Sparring Room is a chat-like interface, but with LIVE feel (typing indicators, "Speaking" states, interruption animations, persona "thinking" pulses).

**Decision 2 — Single-page app with view-state, not multi-route.**
Rationale: Project constraint — only `/` is user-visible. The brief's nav (Home / Practice / Coach / Progress) becomes client-side view switching. For solid thing #1, we ship: Home → Practice config → Sparring Room → Debrief. Coach and Progress come in later solid things.

**Decision 3 — Pattern Memory is the wedge; architect for it from day one.**
Rationale: Research confirms NO competitor has personas that adapt based on remembered user patterns. This is the defensible IP. Even if v1's "memory" only feeds the last 3 session summaries into the next persona prompt, we build the full data model now (SessionSummary, PatternMemory, SkillSnapshot) so v2 can deepen it without schema migrations.

**Decision 4 — Personas are LLM-driven with hardcoded archetype prompts.**
Rationale: In the real product, the methodology co-founder writes persona character sheets. For v1, I'm producing strong archetype prompts based on the brief's spec (Skeptic, Nitpicker, So-What, Timekeeper, Ally) — each with trigger conditions, question templates, aggression levels, forbidden behaviors. These are designed to be editable later (admin panel) but hardcoded for v1.

**Decision 5 — Content grounding via LLM-extracted key claims.**
Rationale: The magic moment is "personas reference your actual slides / content." When user uploads/pastes material, we extract 3-5 key claims via LLM. Each persona's system prompt includes these claims + instructions to challenge specific ones based on their archetype lens.

**Decision 6 — Telemetry is text-derived for v1.**
Rationale: Voice telemetry (WPM, filler count) requires audio pipeline. For text v1, we derive equivalent signals:
  - Concision: words per user response
  - Clarity: hedge/qualifier count (regex: "I think", "maybe", "sort of", "kind of", "perhaps", "possibly", "I guess", "probably")
  - Presence: response time (latency between persona's message and user's reply)
  - Recovery: question-deflection rate (does user answer or pivot?)
  - Evidence: citation/number ratio (does user ground claims in data?)
These map directly to the 5 skill dimensions (Clarity, Recovery, Concision, Presence, Evidence) the brief defines.

**Decision 7 — Design language: deep charcoal + slate + one accent blue. No neon. No gradients. No gamey language.**
Per brief section 5 ("The 'Not Toyish' Fixes"):
  - Background: deep charcoal (#0A0D12)
  - Surface: slate (#141821, #1A1F2B)
  - Border: subtle (#232938)
  - Text: light (#E5E7EB primary, #94A3B8 muted)
  - Primary accent: ONE blue (#5B8DEF — sophisticated, cool, premium. NOT default Tailwind blue, NOT indigo)
  - Persona hues: very muted, desaturated tints (slate with subtle warm/cool/green/rose shifts). Reserved for avatar backgrounds only, never for CTAs.
  - Typography: Geist Sans (already set up)
  - No "level up", "xp", "rehearse". Use: Sprint, Focus, Pattern, Baseline, Spar, Practice.

**Decision 8 — Persona interaction model (text-based "live" feel):**
  - User types statement in composer → submits
  - Transcript shows user's statement
  - Personas respond in sequence. Each persona:
    a) 800-1500ms "thinking" pulse on their card (subtle)
    b) "Speaking" state lights up their card
    c) Message streams in char-by-char (15-25ms/char, like ChatGPT)
    d) Brief pause, next persona
  - "Interruptions": some persona responses are marked as interruptions — they slide in from the side with a sharper visual treatment (e.g., a left accent border, slightly different background). One persona can "cut off" another's thinking state.
  - After 1-2 personas speak, control returns to user.

**First Solid Thing — Scope (locked):**
1. Home view — "Enter the Sparring Room" CTA, upcoming moment countdown, quick stats row (placeholder for v1), today's focus (placeholder)
2. Practice prep flow — 4 steps: choose mode → upload/paste content → choose scenario → configure panel (2-3 archetypes, name + behavior style)
3. Sparring Room — text-based live interaction, personas reference content, telemetry captured live, "End Session" button
4. Post-Session Debrief — 6-section structure (Moment, What Went Well, The Pattern, One Thing to Practice, Telemetry as Insight, Save/Share)

Out of scope for v1: Voice, full Coach tab, Progress tab, Programs, "I Need a Moment" button, share/export. These are next solid things.

**Database schema (locked):**
- User (single hardcoded user for v1, no auth)
- UpcomingMoment (Home countdown)
- Session (scenario, mode, rawMaterial, extractedClaims JSON, status, telemetry JSON)
- SessionPersona (archetype, name, behaviorStyle, order)
- SessionMessage (role, personaId, content, type: normal/interruption/coach-whisper)
- SessionSummary (6-section debrief, generated by LLM post-session)
- PatternMemory (accumulated insights, feeds next session's prompt)
- SkillSnapshot (5-dimension scoring per session, tracks over time)

---
Task ID: 3
Agent: main (engineering)
Task: Build the first solid thing — Practice → Sparring Room → Debrief loop (text-first MVP)

Work Log:
- Replaced default Prisma schema with SharkPit models: User, UpcomingMoment, Session, SessionPersona, SessionMessage, SessionSummary, PatternMemory, SkillSnapshot. Pushed to SQLite via `bun run db:push`.
- Rewrote `src/app/globals.css` with the SharkPit dark premium palette: deep charcoal background (oklch 0.16/0.008/250), slate surfaces, ONE accent blue (oklch 0.68/0.13/250 — sophisticated, NOT default Tailwind blue). Added custom animations: sharkpit-pulse (interrupt warning), sharkpit-thinking (persona thinking dots), sharkpit-interrupt-in (interruption slide), sharkpit-fade-up (message entry), sharkpit-caret (streaming caret).
- Updated `src/app/layout.tsx` — hardcoded `dark` mode (no light mode in v1, per brief), updated metadata to SharkPit branding.
- Built `src/lib/` layer:
  - `types.ts` — shared TypeScript types (ArchetypeKey, BehaviorStyle, ScenarioKey, SessionMode, MessageType, PersonaMood, ExtractedClaim, PersonaConfig, TelemetrySnapshot, DebriefPayload)
  - `personas.ts` — the 5 archetype definitions (Skeptic, Nitpicker, So-What, Timekeeper, Ally) with full character sheets: lens, triggers, question templates, forbidden behaviors, accent hues, initials. Plus `buildPersonaSystemPrompt()` that assembles a persona's system prompt from archetype + behavior style + claims + pattern memory + other panelists.
  - `scenarios.ts` — the 7 scenarios from the brief (Thesis Defense, Investor Pitch, Board Update, Performance Review, Grant Defense, Client Presentation, Custom) with default panel configs.
  - `telemetry.ts` — text-derived telemetry: hedge patterns (18 regex), deflection markers, evidence citation patterns. `computeTurnTelemetry()` and `aggregateTelemetry()` functions. These map to the 5 skill dimensions (Clarity, Recovery, Concision, Presence, Evidence).
  - `llm.ts` — the LLM orchestration (server-side only). Three core capabilities: `extractClaims()` (3-5 key claims from material), `generatePersonaResponse()` (structured JSON with content/type/claimRef/mood), `generateOpening()` (panel's first challenge), `generateDebrief()` (6-section coaching debrief). Plus `buildPatternMemoryContext()` (feeds previous session patterns + summaries into persona prompts) and `classifyPatternTag()` (tags patterns for PatternMemory upsert).
  - `user.ts` — `getDefaultUserId()` helper (v1 uses a single hardcoded user, no auth).
- Built 8 API routes:
  - GET `/api/user` — current user
  - GET/POST/DELETE `/api/upcoming-moment` — Home countdown
  - GET/POST `/api/sessions` — list + create (with claim extraction on create)
  - GET `/api/sessions/[id]` — full session with relations
  - POST `/api/sessions/[id]/open` — generate panel's opening challenge
  - POST `/api/sessions/[id]/spar` — handle user message, return next persona response (round-robin, capped at 2 personas per user turn)
  - POST `/api/sessions/[id]/end` — end session, compute telemetry, generate 6-section debrief, upsert PatternMemory, create SkillSnapshot
  - GET `/api/sessions/[id]/debrief` — fetch saved debrief
  - GET `/api/stats` — Home quick stats (sessions this week, streak, top skill, today's focus)
- Built 9 UI components:
  - `persona-avatar.tsx` — initials + muted accent hue, state-based border treatment (idle/listening/thinking/speaking/about-to-interrupt)
  - `telemetry-bar.tsx` — subtle live telemetry (words, hedges, latency, evidence) — coach's notes, not a game HUD
  - `nav.tsx` — 4-item nav (Home/Practice/Coach/Progress), Coach & Progress are "coming soon" placeholders
  - `persona-card.tsx` — single persona card with avatar, name, behavior badge, state indicator (thinking dots / speaking pulse / listening), mood dot
  - `transcript.tsx` — live transcript with distinct treatments for user messages (right-aligned, blue tint), persona messages (left-aligned, accent hue left border), interruptions (amber tint, slide-in animation), openings (badge + "The room is open" prompt)
  - `home-view.tsx` — dashboard: greeting, upcoming moment countdown, "Enter the Sparring Room" CTA, quick stats row, today's focus (from pattern memory), upcoming moment set/edit dialog
  - `practice-view.tsx` — 4-section config flow: mode toggle (with/without material), material textarea, scenario grid (7 options), panel configurator (1-3 personas with archetype/name/behavior). Single scrollable page with numbered sections.
  - `sparring-room.tsx` — the centerpiece. 3-column desktop layout (material | transcript+composer | personas), mobile-responsive (personas become horizontal strip). Char-by-char streaming animation. Live telemetry. End session dialog. Timer.
  - `debrief-view.tsx` — 6-section debrief: The Moment, What You Did Well, The Pattern (connects to previous sessions), One Thing to Practice, Telemetry (4 sub-insights), Save or Share (copyable summary). Plus skill snapshot bars.
- Updated `src/app/page.tsx` — single-page app with view state (home/practice/sparring/debrief/coach/progress).
- Fixed scenario label bug (was showing raw key "investor_pitch" instead of "Investor Pitch" in debrief header).

Stage Summary:
- **The first solid thing is complete and browser-verified end-to-end.** All core flows work:
  1. ✅ Home loads with stats + today's focus from pattern memory
  2. ✅ Practice config flow: mode → material → scenario → panel → start
  3. ✅ Claims auto-extracted from pasted material (LLM call, 3-5 claims with evidence)
  4. ✅ Panel's opening challenge references specific extracted claims ("→ Claim 1")
  5. ✅ Sparring turn: user submits → 2 personas respond in sequence → control returns to user
  6. ✅ Personas stay in character (Skeptic probes assumptions, Nitpicker probes methodology, So-What challenges impact)
  7. ✅ End session generates 6-section debrief with specific, evidence-based coaching
  8. ✅ **Cross-session pattern memory works** — debrief explicitly says "This connects to your previous pattern of defending methodological choices..." referencing patterns from a prior session
  9. ✅ Home updates with new stats (2 sessions, 1d streak, Top Skill: Clarity) + today's focus
  10. ✅ Mobile responsive layout verified (390x844 viewport)
- Lint passes clean. Dev log shows no errors during testing.
- Artifacts produced: complete SharkPit v1 codebase (lib layer + 8 API routes + 9 UI components + Prisma schema + theme).

**What's working well (worth keeping):**
- The persona prompts produce genuinely substantive, content-grounded challenges. The Skeptic went straight at the $2.3B TAM claim by pointing out the evidence gap. This is the "magic moment" from the brief.
- The cross-session pattern memory is the defensible wedge — and it works. The debrief connects current behavior to past patterns, which is what differentiates SharkPit from Yoodli (per research).
- The design follows the brief's "Not Toyish" rules: dark premium palette, one accent blue, no neon, no gamey language, archetype names not whimsical ones, telemetry as coach's notes.

**Known limitations / next solid things:**
- Voice (ASR + TTS) — the next solid thing. Text proves the AI behavior; voice adds the "live room" feeling.
- Coach tab (programs, skill map, insights) — placeholder for now.
- Progress tab (session history, growth trends, communication profile) — placeholder for now.
- "I Need a Moment" button + intervention scripts — Day 4 in the brief's sprint plan.
- File upload (PPTX/PDF) — currently paste-text only. PDF parsing is a quick add.
- Programs feature — the brief specifies a "Thesis Defense Sprint" 4-session structured program.
- Auth — currently single hardcoded user.

---
Task ID: 4
Agent: general-purpose (rename)
Task: Rename SharkPit → Spar across the entire codebase

Work Log:
- Read worklog.md to absorb project context (Tasks 1–3 — research, architecture, MVP build).
- Ran ripgrep case-insensitive across `src/` — confirmed 22 files contain `sharkpit` (any case). No `Sharkpit` (title-case) or `SHARKPIT` (uppercase) variants existed; only `SharkPit` (camelCase, in code/comments/strings) and `sharkpit` (lowercase, in CSS class names + one email address).
- Renamed the folder `src/components/sharkpit/` → `src/components/spar/` via `mv`. All 9 component files (nav, home-view, practice-view, sparring-room, debrief-view, persona-avatar, persona-card, transcript, telemetry-bar) moved cleanly. No path collision with the pre-existing `src/app/api/sessions/[id]/spar/` route handler (different tree branch).
- For each of the 22 files, applied `Edit` with `replace_all: true`:
  - 16 files needed only `SharkPit` → `Spar` (lib/llm.ts, lib/personas.ts, lib/scenarios.ts, lib/types.ts, lib/telemetry.ts, app/layout.tsx, app/api/stats/route.ts, app/api/upcoming-moment/route.ts, app/api/sessions/route.ts, app/api/sessions/[id]/route.ts, app/api/sessions/[id]/end/route.ts, app/api/sessions/[id]/debrief/route.ts, app/api/sessions/[id]/open/route.ts, app/api/sessions/[id]/spar/route.ts, app/api/user/route.ts, components/spar/nav.tsx).
  - 3 component files needed only `sharkpit` → `spar` (persona-avatar.tsx, persona-card.tsx, transcript.tsx — all CSS class usages).
  - 3 files needed both replacements via `MultiEdit` (lib/user.ts — comment + `founder@sharkpit.local` email → `founder@spar.local`; app/page.tsx — footer string + 5 `@/components/sharkpit/` import paths → `@/components/spar/`; app/globals.css — design-language comments + all custom animation/keyframe names).
- CSS class renames in `globals.css`: `sharkpit-pulse` → `spar-pulse`, `sharkpit-thinking` / `sharkpit-thinking-dot` → `spar-*`, `sharkpit-interrupt` / `sharkpit-interrupt-in` → `spar-*`, `sharkpit-fade-up` → `spar-fade-up`, `sharkpit-caret` → `spar-caret`. Both `@keyframes` names and selector class names were updated in lockstep.
- Verified all component usages of those classes (in persona-avatar.tsx, persona-card.tsx, transcript.tsx) were renamed in the same pass — no orphaned `sharkpit-*` class references remain.
- Re-ran ripgrep on `src/`: 0 matches for `sharkpit` (any case). 0 matches for `@/components/sharkpit`. Confirmed `spar-*` classes appear in both globals.css (definitions) and the 3 component files (usages).
- Ran `bun run lint` — passes clean, no errors. No broken imports.

Stage Summary:
- Files changed: 22 (all under `src/`).
- Folder renamed: `src/components/sharkpit/` → `src/components/spar/` (9 component files moved).
- Import paths updated: 5 in `src/app/page.tsx` (`@/components/sharkpit/*` → `@/components/spar/*`). No other absolute `@/components/sharkpit/` imports existed — sibling imports inside the folder use relative paths (e.g. `./persona-avatar`) and were unaffected by the folder rename.
- CSS: 7 custom animation/keyframe names renamed from `sharkpit-*` to `spar-*`; all 8 usage sites in component files updated in lockstep.
- Email updated: `founder@sharkpit.local` → `founder@spar.local` (in `src/lib/user.ts`). NOTE: this is the DEFAULT_USER_EMAIL used by `getDefaultUserId()` to look up / create the v1 hardcoded user row. Existing rows in the SQLite DB still have `founder@sharkpit.local` as their email — `getDefaultUserId()` will now create a NEW user row on next call (since `findUnique({ where: { email } })` won't match the old email). Previous sessions tied to the old user id will become orphaned from the new default user's perspective. If the founder wants to preserve continuity with existing test data, a one-time DB UPDATE on the User table (`UPDATE User SET email = 'founder@spar.local' WHERE email = 'founder@sharkpit.local'`) is needed. Did NOT touch `prisma/schema.prisma` or run any DB migration, per task constraints.
- Lint: passes clean (no errors, no warnings).
- Issues encountered: none mechanical. The only subtle thing is the email-change vs. existing-DB-row concern noted above — flagged for the founder to decide whether to migrate the user row.

---
Task ID: 5
Agent: main (engineering)
Task: Fix "Start Sparring" never enabling + rename SharkPit → Spar

Work Log:
- Reproduced the bug via Agent Browser: pasted short material (22 chars) → button stayed disabled. Root cause: the material threshold was 30 chars, too strict for typical testing inputs.
- Fixed in 3 places (threshold lowered from 30 → 10 chars):
  - `src/components/spar/practice-view.tsx` — `materialValid` threshold + helper text now shows "Ready — paste more for richer claim extraction" between 10-60 chars
  - `src/lib/llm.ts` — `extractClaims()` threshold lowered
  - `src/app/api/sessions/route.ts` — claim extraction trigger threshold lowered
- Added a clear `disabledReason` computed value shown in the UI when the button is disabled, so users know exactly what's missing ("Add at least 10 characters of material to start" / "Add a topic (10+ chars) to start" / "Add at least one panelist").
- Delegated the SharkPit → Spar rename to a subagent (Task ID 4): 22 files modified, folder `src/components/sharkpit/` → `src/components/spar/`, all CSS classes `sharkpit-*` → `spar-*`, all imports updated, lint passes clean.
- Critical data preservation: the rename changed the default user email from `founder@sharkpit.local` → `founder@spar.local`. The running dev server had already created an empty new user with the new email. Wrote a Prisma migration script that:
  1. Verified the new user was empty (0 sessions, 0 patterns, 0 moments)
  2. Deleted the empty new user
  3. Renamed the old user's email to `founder@spar.local` (preserving user ID `cmtazbfxr...` with 2 sessions, 1 pattern memory, 2 skill snapshots)
- Restarted the dev server to clear the stale `cachedUserId` in-memory cache.
- Browser-verified end-to-end: pasted 22-char material → button enabled → session created → claims extracted → panel's opening challenge delivered referencing Claim 2. Product title is now "Spar — The sparring room for your next big moment."

Stage Summary:
- **Bug fixed**: Start Sparring button now enables with as little as 10 chars of material (was 30). Clear disabled-state messaging tells users exactly what to add.
- **Rename complete**: Product is now "Spar" everywhere — UI, metadata, system prompts, CSS classes, folder structure, internal comments. Zero remaining "sharkpit" references in `src/`.
- **Data preserved**: Existing user's 2 sessions + 1 pattern memory + 2 skill snapshots survived the email migration. The cross-session coaching loop continues to work.
- Lint passes clean. No errors in dev log.

---
Task ID: 6
Agent: main (engineering)
Task: Kill the blue / go pure dark, fix Custom scenario, build mobile bottom nav + floating CTA

Work Log:
- **Theme overhaul (pure dark monochrome):**
  - Changed `--primary` from blue `oklch(0.68 0.13 250)` to pure white `oklch(0.96 0 0)`. This cascades to all `text-primary`, `bg-primary`, `border-primary` usages app-wide.
  - Changed `--background` from blue-tinted `oklch(0.16 0.008 250)` to pure neutral `oklch(0.14 0 0)` (#0a0a0a). All surfaces (card, popover, secondary, muted, accent, border) similarly stripped of the 250 hue — all now `oklch(x 0 0)` (zero chroma = no color).
  - Removed the blue radial gradient from `body` background (was `radial-gradient(circle at 0% 0%, oklch(0.68 0.13 250 / 0.04)...)`).
  - Updated `spar-pulse` and `spar-caret` animations from blue to white.
  - Updated `--ring`, `--sidebar-primary`, `--sidebar-ring`, `--chart-1` from blue to white.
  - Browser-verified: zero elements with blue oklch color in the DOM. Primary CSS variable is now `lab(95.36% 0 0)` (pure white, zero chroma).
- **Persona accent hues stripped to monochrome:**
  - `persona-avatar.tsx`: removed colored gradient background. All avatars now use neutral dark slate (`oklch(0.23 0 0)`) with near-white initials. Speaking state = white ring. No per-archetype color.
  - `persona-card.tsx`: removed colored boxShadow. Speaking state = white border. Mood labels all use `text-foreground` / `text-muted-foreground` (no amber/emerald/rose). Behavior badges use neutral white borders.
  - `transcript.tsx`: user message bubble changed from `bg-primary/10 border-primary/20` to `bg-white/5 border-white/10`. Persona message left border changed from per-archetype accent hue to `border-l-white/20`. Opening badge changed from blue to neutral white. Interruption label changed from amber to neutral.
  - `telemetry-bar.tsx`: hedge tone changed from amber to white. Evidence tone changed from primary to white.
  - `practice-view.tsx`: scenario selected state changed from `border-primary/60 bg-primary/10` to `border-white/40 bg-white/5`. Mode option, panel slot icon, add-panelist hover all de-blued.
  - `home-view.tsx`: CTA changed from blue gradient to `border-white/15 bg-white/5`. Countdown number, Today's Focus, stat cards all de-blued.
  - `debrief-view.tsx`: section accents (primary/emerald/amber) all changed to white/white-70. Skill bars changed from `bg-primary/70` to `bg-white/70`. Highlighted section changed from blue tint to white tint.
  - `sparring-room.tsx`: loading spinner, mobile claims FAB, claim badges all de-blued.
- **Custom scenario feature:**
  - Added `roomContext String?` field to Session model in `prisma/schema.prisma`. Pushed schema via `bun run db:push`.
  - Updated `POST /api/sessions` to accept and store `roomContext` (only when scenario is "custom").
  - Updated `open`, `spar`, and `end` API routes to use the custom roomContext when scenario is "custom" (falls back to scenario default otherwise). Also standardized `scenarioLabel` to "Custom Session" for custom scenarios.
  - Added `customRoom` state + validation to `practice-view.tsx`. When the user selects "Custom" scenario, a textarea appears: "Describe who's in the room" with a placeholder example (hiring committee, etc.). The Start button stays disabled until 10+ chars of room description are provided.
  - Browser-verified: created a custom session with "A hiring committee of 3 senior engineers..." description. Panel loaded, Skeptic delivered an opening referencing Claim 2. The custom room context feeds into the persona system prompts.
- **Mobile bottom nav (per user spec):**
  - `nav.tsx` rewritten to be responsive: desktop gets the top sticky bar (`hidden md:flex`), mobile gets a fixed bottom bar (`md:hidden`).
  - Bottom nav: `fixed bottom-0 left-0 right-0 z-50`, `h-16` (64px), `bg-[#0a0a0a]`, `border-t border-white/[0.06]`, `pb-[env(safe-area-inset-bottom)]`, `justify-around`.
  - 4 items: Home, Practice (Swords icon per spec — changed from Dumbbell), Coach (Target), Progress (TrendingUp).
  - Each item: flex column, `min-h-[48px] min-w-[48px]` tap target, `h-5 w-5` icon, `text-[10px]` label.
  - Inactive: `text-neutral-500`. Active: `text-white`.
  - Active indicator: `h-1 w-1 rounded-full bg-white` dot above the icon (`mb-0.5`).
  - Top desktop bar also de-blued: logo ring is `bg-white/5 ring-white/15`, active nav indicator is `bg-foreground` (white).
- **Mobile floating CTA (per user spec):**
  - Added to `home-view.tsx`: `fixed bottom-20 left-4 right-4 z-40`, `bg-white text-black font-semibold text-sm py-3.5 px-6 rounded-xl shadow-lg active:scale-95`.
  - Only visible on mobile (`md:hidden`). Desktop uses the inline CTA card (`hidden md:block`).
  - The desktop CTA was also de-blued: changed from blue gradient to `border-white/15 bg-white/5` with white arrow circle.
- **Layout fixes:**
  - `page.tsx`: added `pb-16 md:pb-0` to `<main>` to prevent the mobile bottom nav from covering content.
  - `home-view.tsx`: added `pb-32 md:pb-12` to the home container to account for the floating CTA + bottom nav on mobile.
  - `sparring-room.tsx`: fixed height from `h-[calc(100vh-3.5rem)]` to `h-[100dvh]` — the Sparring Room is a full-screen view with no global Nav, so the 3.5rem subtraction was wrong (left a gap at the bottom). Using `100dvh` accounts for mobile browser chrome.
- Restarted dev server after schema push (Prisma client needed to pick up the new `roomContext` field).

Stage Summary:
- **Pure dark mode achieved**: zero blue in the entire app. Primary is pure white, background is #0a0a0a, all surfaces are neutral gray with zero chroma. Persona differentiation is now by initials + names, not color.
- **Custom scenario works**: selecting "Custom" in the scenario picker reveals a "Describe who's in the room" textarea. The description is stored in the DB and feeds into the persona system prompts. Verified end-to-end with a hiring committee description.
- **Mobile nav per spec**: fixed bottom bar (64px, #0a0a0a, border-t white/6), 4 items with active white dot above icon, Swords icon for Practice. Floating CTA on Home (bg-white text-black, fixed bottom-20). Desktop keeps the top sticky bar.
- Lint passes clean. No errors in dev log. Browser-verified on both desktop (1440x900) and mobile (390x844).

---
Task ID: 7
Agent: main (engineering)
Task: Premium dark theme + Quick Spar low-friction path + interactive polish

Work Log:
- **Premium dark theme overhaul (`globals.css`):**
  - Background darkened slightly to `oklch(0.115 0 0)` (#070707) for more contrast against elevated cards.
  - Added ambient light from above: `radial-gradient(ellipse 70% 50% at 50% -10%, oklch(0.20 0 0) 0%, transparent 55%)` — zero chroma (gray, not blue), simulates a soft overhead light. This is what gives premium dark apps depth without color.
  - Added three elevation utility classes: `premium-card` (top highlight inset + bottom shadow), `premium-card-hover` (lifted), `premium-surface` (flat). Cards now "float" with depth.
  - Brightened `--muted-foreground` from 0.55 to 0.60 for readability.
  - Added `spar-ready-glow` animation: a subtle breathing glow on the enabled Spar button (2.5s ease-in-out) — signals readiness without being flashy.
  - Added font smoothing (`-webkit-font-smoothing: antialiased`) for crisper text on dark.
  - Refined scrollbar with transparent border padding for a slimmer look.
- **Quick Spar API (`POST /api/sessions/quick`):**
  - Minimal-friction endpoint: accepts `{ topic, scenario?, roomContext? }`.
  - Creates a session with a sensible default panel (Skeptic moderate + So-What moderate — the balanced "explore a topic" pair).
  - Runs claim extraction on the topic if it's 10+ chars, so the panel can still reference specific claims.
  - Sets mode to `without_material`, scenario defaults to `custom` with a generic room context.
  - Returns the session ID → frontend drops straight into the Sparring Room.
- **Home redesign (`home-view.tsx`):**
  - New primary card: "Spar on a topic" — a textarea with placeholder example + a Spar button that has the `spar-ready-glow` breathing animation when enabled.
  - Cmd/Ctrl+Enter keyboard shortcut to submit.
  - Three one-tap preset chips below the input: "Defend an idea", "Pressure-test a number", "Practice a hard conversation" — each pre-fills a topic and immediately starts a quick spar session on click.
  - Secondary path below: "Bring material & configure the room" — a subtler card that links to the full Practice flow (for when you have a deck/proposal and want to pick your panel).
  - The old big blue-gradient CTA is gone. The Quick Spar card is the new hero.
  - Mobile floating CTA relabeled to "Configure a custom room" (since Quick Spar is now the primary mobile path).
  - All cards use `premium-card` elevation for depth.
- **Page wiring (`page.tsx`):**
  - Added `handleQuickSparStarted(sessionId)` — sets the active session and jumps straight to the Sparring Room view, skipping the Practice config entirely.
  - Passed `onQuickSparStarted` to HomeView.
- Browser-verified end-to-end on both desktop (1440x900) and mobile (390x844):
  - Desktop: typed a topic about firing a toxic salesperson → clicked Spar → straight into the room, Skeptic delivered a relevant opening referencing Claim 1.
  - One-tap preset: clicked "Defend an idea" → straight into a session about remote-first teams.
  - Mobile: typed a topic about quitting a stable job → clicked Spar → straight into the room.
  - Zero config friction on all three paths.

Stage Summary:
- **Premium feel achieved**: cards now float with subtle shadows + top highlights, ambient light from above adds depth, typography is bolder (font-bold on headlines, tabular-nums on stats), the enabled Spar button has a breathing glow. No color — pure monochrome depth.
- **Friction reduced to near-zero for topic-based sparring**: Home → type topic (or tap a preset) → Spar button → room. 3 seconds, no config. The full Practice flow still exists as a secondary path for when you have material.
- **Three ways to start sparring now**:
  1. Quick Spar (Home) — type a topic, hit Spar. Default panel. Zero config.
  2. One-tap presets (Home) — click a preset, straight into a relevant session.
  3. Full Practice (Home → Practice) — upload material, pick scenario, configure panel.
- Lint passes clean. No errors in dev log.
