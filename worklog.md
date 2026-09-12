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
