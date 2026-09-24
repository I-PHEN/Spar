# Drill mode — how real coaches run repetition practice (research)

Date: 2026-09-24
Status: Research complete. This is the Phase 0 grounding for the **Drill** row of the
mode table in `2026-09-24-gemini-live-voice-engine-design.md` ("Coaching reps:
stimulus → response → correction, progression difficulty — most aggressive
response-time target, cadence"). It ends with the recommended mode interaction
contract, the reviewable artifact.

Method: web research across the domains where rapid stimulus→response→correction
loops are run for real — sports coaching and motor-learning science, Ericsson's
deliberate-practice research, discrete-trial training (ABA), precision teaching
(fluency sprints), spaced repetition, military drill instruction, adaptive
testing, and interview coaching. Sources listed at the end. Numbers below are
from these sources unless flagged as a design extrapolation.

---

## 1. The anatomy of a rep

Every domain studied converges on the same four-phase loop, and each phase has a
known time budget.

### 1.1 Stimulus

- **Short, standardized, self-contained.** Military drill commands are two-part
  (preparatory command + command of execution) and taught *verbatim* at drill
  instructor school — the trainee always knows what kind of action is coming the
  moment the preparatory part lands ("Forward—"). Discrete-trial training (DTT)
  calls this the **antecedent**: a clear, consistent instruction is the first of
  exactly three trial components (antecedent → behavior → consequence).
- Implication for a drill stimulus: a **fixed opening tag** (category or
  constraint) followed by a one-to-two-sentence payload. No preamble, no
  pleasantries — military drill and DTT both treat a inconsistent antecedent as
  noise that degrades the response.
- Interview-drill analog: the STAR coaching convention that Situation gets ~20%
  of an answer — i.e., minimal framing, maximum payload.

### 1.2 Response window

- DTT measures **response latency** per trial and treats a slow or absent
  response as data, not rudeness; error-correction procedures explicitly exist
  to "reduce response latency and errors."
- Behavioral-interview drilling norms put a full formulated answer at **~90
  seconds to 2 minutes**; quickfire sub-drills (mental math, one-line
  objections) run **5–30 seconds**. A drill mode's window depends on the rung:
  quickfire at the bottom, STAR-length at the top of the ladder.
- In voice, the window opens the moment the stimulus ends. The engine's
  end-of-speech patience defines the *fast* edge of the window: Gemini Live's
  server default is ~800 ms of silence; Google's guidance is **500–800 ms**,
  with 100–200 ms shown to fragment natural utterances and a client-side floor
  of **≥500 ms** recommended (Google STT's `voice_activity_timeout` literally
  cannot go below 500 ms). The slow edge (a hard timeout for "you never
  answered" or "you're rambling") is a coaching decision, not an engine one.

### 1.3 Feedback

- Feedback in drills is **terminal** (after the attempt), not concurrent.
  Sadowski's acrobatics study delivered verbal, **prescriptive** feedback only
  after each trial — never mid-movement.
- Feedback is **short**: one targeted correction. In Sadowski's bandwidth group
  the coach averaged **~5.5 feedback statements per 10-trial session** (vs ~7.9
  for the 100%-feedback group) — and learned *more* (see §2).
- Feedback language is **cue-shaped**: Wulf's work shows one brief,
  external-focus cue (about the effect — "land the punchline," not "relax your
  larynx") beats detailed internal diagnosis. Cues reference the effect of the
  action on the world, not the mover's body mechanics.

### 1.4 Reset

- DTT has an explicit **inter-trial interval (ITI): typically 1–5 seconds**,
  the phase where the coach records the trial's data and re-establishes
  attention before the next antecedent. Koegel et al. (1980) found **shorter
  ITIs produced better performance** — the reset is a breath, not a break.
- Precision teaching's SAFMEDS ("Say All Fast, a Minute, Every Day, Shuffled")
  compresses the reset to near-zero: cards flip continuously inside a one-minute
  sprint, because the unit is pure retrieval speed.
- Physical complex-skill drills use long rests when the skill demands it
  (Sadowski: 10 trials per session with **120 s rest between trials**) — rest
  scales with the load of the rep, but verbal-answer drills sit at the DTT/SAFMEDS
  end, not the acrobatics end.

### 1.5 Putting numbers on a rep (design targets)

| Phase | Quickfire rung | Full-answer rung | Basis |
|---|---|---|---|
| Stimulus | 3–6 s | 5–15 s | Two-part command; STAR 20% setup |
| Response window (soft) | 5–15 s | 30–90 s | Interview drill norms |
| Response window (hard cut) | ~20 s | ~2 min | Coach calls time |
| End-of-speech patience | 500 ms | 500–800 ms | Gemini Live guidance |
| Feedback | 1–2 sentences, ≤ ~25 words (~3–8 s) | ≤ ~40 words (~10–15 s) | Bandwidth + external-focus cueing |
| Reset / next stimulus | ≤ 1–3 s | ≤ 3–5 s | DTT ITI 1–5 s |
| Whole rep cycle | **~15–30 s** | **~60–120 s** | — |
| Session | 10–20 min, in short blocks | 10–20 min | §3 |

---

## 2. Correcting without breaking rhythm

The single strongest finding across motor-learning research: **one fix per rep,
and not even that every rep.**

- **One cue, not a list.** Coaches of novices deliver a single, simple cue per
  attempt; Wulf's constrained-action-hypothesis line of work shows an external-
  focus instruction (effect on implement/environment) outperforms internal-focus
  detail, and that *frequent* feedback is **beneficial when each instance is a
  brief external cue** (100% feedback beat 33% for external-focus groups on
  transfer tests) but harmful when it makes the learner self-conscious about
  mechanics. For a voice coach: "lead with the number, then the reason" — not a
  rubric.
- **Bandwidth feedback: silence means correct.** In Sadowski's bandwidth group,
  feedback came *only* when a key element fell outside a pre-agreed acceptable
  range, and "lack of information about errors had to be treated as an exercise
  that was executed correctly." That group beat the every-error-corrected group
  on retention by 6–7% (d ≈ 3.2–3.7) and kept improving after practice stopped,
  while the 100%-corrected group stalled — the guidance-hypothesis dependency
  effect. **Voice translation (important):** literal silence is unusable in a
  voice room (dead air reads as disconnection, and the VAD needs *some*
  utterance to hand the turn back). The equivalent of "silence = correct" is a
  **fixed minimal ack** — the same two or three words every time ("Good. Next:")
  — so the ack carries no information content, just turn handoff. Real coaching
  talk does exactly this ("Good—again").
- **Correct the error class, once; bank the rest.** Comprehensive feedback is
  not dropped — it is *deferred* to the session close (§7, AAR) where it doesn't
  tax working memory mid-loop. This matches the bandwidth design: within-band
  imperfections accumulate silently into the debrief.
- **Decompose when a rep keeps failing.** Military drill's "by the numbers"
  method divides a movement into individual motions taught on a count, then
  reassembles the whole; Sadowski's study used a progressive-part method
  (initial position, flight, final position separately). The drill-mode
  equivalent: after two misses on the same rung, shrink the rep (shorter answer,
  narrower question, scaffold the first three words) rather than re-explaining
  the whole skill.
- **Standardized, repeatable correction language.** Drill instructors rehearse
  corrections verbatim; coaches reuse the same cue words so correction is
  recognition, not parsing. A voice coach should reuse the exact cue phrasing
  for the same error class across reps and sessions.

---

## 3. Pacing and fatigue

- **Drill sessions are short.** Ericsson's violinists — the emblem of effortful
  practice — topped out around **~80-minute practice sessions, ~19.5 such
  sessions/week (~3¾ h/day), with breaks roughly every hour**, because
  full-concentration practice exhausts; capacity beyond ~4 h/day collapses in
  quality. Precision-teaching sprints are **one minute**; Sadowski ran **10
  trials/session, 4 sessions/week**. Nothing in the drilling literature
  supports long grinding sessions; everything supports **short, dense, frequent**.
  Design target: **10–20 minute drill sessions, in blocks of ~5 minutes** with a
  breath between blocks.
- **Repeat vs vary: stage-dependent.** Motor learning's contextual-interference
  finding: **blocked practice** (same skill, same form, repeated) wins on
  *in-session performance* and suits novices; **random/interleaved practice**
  (same skills, shuffled order) wins on *retention and transfer* and suits more
  advanced learners — with the honest caveat (Thürer et al. 2019) that random
  practice is not unconditionally superior; it depends on skill level and task
  complexity. Ladder: **blocked → serial (predictable rotation) → shuffled**.
- **Vary the surface, hold the skill constant.** SAFMEDS shuffles the deck
  every day — the retrieval skill is trained on random surface content so it
  doesn't attach to order. A drill mode should vary stimulus wording/topic while
  holding the trained skill (e.g., "answer the objection in one breath")
  constant within a block.
- **Stop quality-aware.** Repetition mainly benefits novices; advanced learners
  need targeted deficiency work, not more volume. When accuracy or latency stops
  improving within a session (fatigue signature), the coach's move is to close
  and schedule the next session, not push. Spacing research adds: re-encounter
  the same item **later** (inter-session spacing), don't mass it today.
- **Keep dead air at zero.** The DTT finding that shorter ITIs → better
  performance plus the "snappy" turn-taking guidance (500–800 ms) say the
  next stimulus should fire within ~1–3 s of feedback ending.

---

## 4. Progression: difficulty ladders and mastery thresholds

Two mechanics appear everywhere, and they compose.

**Adaptive stepping (within session).** Computerized adaptive testing (CAT) is
the cleanest formalization of how a coach ladders difficulty rep-to-rep: start
**medium or medium-easy**, step *up* after good responses, *down* after poor
ones, updating an ability estimate after every single item; stop on a criterion.
CAT also shows the target zone: items are chosen to be maximally informative
near the learner's level — not comfortably easy, not hopeless. Practitioner
consensus for training (as opposed to testing) lands the sweet spot around
**~70–85% success** — hard enough to be effortful (Ericsson: practice just
beyond current ability), easy enough to keep reps flowing. Anki's scheduler is
the same mechanic across sessions: correct → interval roughly doubles; miss →
reset to short interval, so hard material recurs soon and easy material fades
out (target ~90% recall across a mature deck).

**Mastery thresholds (across sessions).** The behavior-analytic literature
standardizes mastery as **≥80% correct (e.g., 8 of 10 trials)** — and, critically,
**sustained: 80% on three consecutive sessions/tests** (variants: 90–100%,
30 consecutive trials). Precision teaching adds the *rate* dimension: mastery =
**3 consecutive sessions at the fluency aim (e.g., 60–80 correct responses per
minute)** — accuracy alone is not mastery; accuracy **at speed** is. This is the
single most transferable idea for Drill mode: an answer rung is "passed" only
when it is right *and* fast, several times in a row.

**Ladder dimensions available to a drill designer** (each is an independent dial):

| Dial | Easy → Hard |
|---|---|
| Stimulus complexity | one-line objection → multi-part case prompt |
| Answer length budget | one sentence → 90 s STAR answer |
| Time pressure | relaxed window → hard cut at N seconds |
| Openness | known-format question → ambiguous/unexpected framing |
| Interference | blocked (same skill) → shuffled (mixed skills) |
| Distraction/hostility | neutral tone → interrupting, hostile, or skeptical delivery |
| Decomposition | by-the-numbers scaffolded → whole task |

Rule of thumb from the research: move **one dial at a time** (bandwidth logic —
correct one thing per rep; change one thing per rung), and drop a rung after
two consecutive misses rather than re-explaining (CAT down-stepping).

---

## 5. What gets measured per rep

Three axes recur across every domain, and DTT shows *when* to record: during the
reset (ITI), silently, between trials.

1. **Correctness** — binary at minimum (CAT updates on right/wrong), partial
   credit where the skill is graded (Wulf scored *form* separately from outcome
   accuracy; both were tracked as distinct measures).
2. **Speed / latency** — DTT logs response latency per trial; precision teaching
   makes rate the *primary* measure (corrects per minute), because percent-alone
   hides stagnation ("accurate but still slow" is not mastery).
3. **Form / quality** — how the answer is built (structure, focus, breath
   control), scored against a small fixed rubric of key elements. Sadowski's key
   elements were defined *in advance* by coaches (only positions with >0.9 coach
   agreement qualified) — the drill's rubric should be similarly small and
   stable (3–4 key elements, not 20).

Per-session rollups the research supports: reps completed, accuracy %, **median
and best response latency**, longest correct streak, accuracy by category, and —
the precision-teaching contribution — a **trend line across sessions** (their
Standard Celeration Chart is a whole discipline built on plotting rate over
days; the "learning picture" matters more than any single day). James Clear's
summary of the practice literature puts it plainly: the things we measure are
the things we improve — measurement plus a coach's eye is what separates
deliberate practice from mere repetition.

---

## 6. Streaks and motivation without gamification bloat

Duolingo's published streak design is the best-documented case study, and it
maps cleanly onto what a drill room needs:

- **A streak works as habit architecture, not candy.** Learners reaching a
  **7-day streak are ~3.6× more likely to complete their course** (Duolingo's
  own blog, 2022). What makes it work is *consecutive-day* structure (same
  context, same time → automaticity), tiny daily minimums (one 5-minute
  session counts), and milestone acknowledgment early when novelty is high.
- **Forgiveness beats rigidity.** Streak Freezes (up to 2 days of grace) —
  grounded in loss-aversion research — *increased* daily active learners rather
  than encouraging days off. A drill room that nukes a long streak over one
  missed day converts a motivator into an avoidance reason ("fear of starting").
- **Within-session streaks do double duty.** A consecutive-correct counter is
  simultaneously a motivation mechanic *and* the mastery signal that drives the
  difficulty ladder (§4: N-in-a-row = step up; miss = reset). This is the
  anti-bloat move: one number, two jobs. Duolingo's own lesson for restraint:
  losing a streak doesn't erase knowledge — the streak protects *practice
  frequency*, and that is all it should be asked to do.

For Drill mode, the defensible set is: **day streak + in-session consecutive-
correct + one milestone tone at meaningful numbers**. No XP, coins, leagues, or
leaderboards — the competence evidence in the closing summary (§7) is the
intrinsic motivator the research actually supports.

---

## 7. How drill sessions open and close

**Open: brief framing + a calibration rep.** Two traditions compose here.
Sports coaching opens with a **RAMP** warm-up (Raise, Activate, Mobilise,
Potentiate) — a short, escalating ramp that *mirrors the session ahead* and
finishes at working intensity; it is not a separate ritual. Adaptive testing
solves the "where do we start" problem with **routing**: first item medium/
medium-easy, estimate updating from the very first response. And deliberate
practice requires the session to start from a **well-defined task with a goal
the learner understands**. Composed opening for a voice drill room (≤15 s
spoken): name today's skill and target ("Handling objections. We go until you
land ten — aim eighty percent."), then **one medium calibration rep** whose
correctness/latency sets the starting rung, then step up or down immediately.
No long goal-setting conversation — the calibration rep *is* the conversation.

**Close: statistics summary in after-action-review shape.** The US Army's AAR —
adopted widely outside the military — is the reference structure for closing a
practice block: participants only, blameless by rule, tight focus, **immediately
after the action**, and organized around the standard four questions (what was
planned → what happened → why the difference → what we change next time).
Informal AARs are explicitly "very quick." Voice drill closing (≤30 s spoken):
today's target, what happened (**reps, accuracy %, median response time,
longest streak, weakest category**), the one recurring error, and **a single
focus cue to carry into the next session**. Blameless framing: errors are
information for the next session's plan, not verdicts. This is also where the
*comprehensive* feedback deferred from mid-session reps (§2) finally gets
delivered — one diagnostic paragraph, said once, when it can't break rhythm.

---

## 8. Recommended mode interaction contract — Drill

```ts
const drillModeContract = {
  endOfSpeechPatienceMs: 500,
  interruptionPolicy:
    "Barge-in enabled in both directions. The user may interrupt the coach mid-word at any time - to answer as soon as they know it, to say 'next', or to pass. The coach interrupts the user only on response-window expiry (no speech start within ~5s of the stimulus, or the answer runs past the rung's hard cap ~20-90s): a firm 'time - next one' cut-in, never a polite trailing wait. Outside window expiry the coach never talks over the user.",
  responseStyleHint:
    "Drill-sergeant terseness, coach warmth. Stimulus = fixed opening tag + 1-2 sentence payload, no preamble. Feedback = terminal, one fix per rep, max 2 sentences (~25 words), external-focus cue phrased as effect on the answer/audience ('lead with the number, then the reason'), reuse the same cue wording for the same error class. Clean rep = the fixed minimal ack only ('Good. Next.') - bandwidth logic: the ack carries no information, silence-equivalent. After two misses on one rung, shrink the rep (shorter budget or scaffolded opening) instead of explaining more. No praise padding, no rubric recitals; comprehensive diagnosis is saved for the close.",
  pacingHint:
    "Zero dead air: next stimulus fires within ~1-2s of feedback ending (DTT inter-trial interval is 1-5s, shorter is better). Rep cycle targets: ~15-30s at quickfire rungs, ~60-120s at full-answer rungs. Run in blocks of ~5 minutes with one breath between; hard-stop the session at 20 minutes. Difficulty steps one dial per rep like adaptive testing: up after a fast correct, up two in a row = next rung, miss = repeat same rung with varied surface wording, two consecutive misses = step down. Keep running success near 70-85%; if outside the band for 3+ reps, re-calibrate.",
  openingBehavior:
    "Under 15 seconds: name the skill and today's pass condition ('Objections. Ten reps - land eight.'), then fire one medium calibration rep whose correctness and latency set the starting rung; step up or down immediately from its result. First reps after calibration sit slightly below working level (RAMP ramp-in), then reach target intensity by rep 3.",
  closingBehavior:
    "Under 30 seconds, after-action-review shape, blameless: today's target vs. result - reps completed, accuracy %, median response latency, longest correct streak, weakest category - then the ONE recurring error and a single focus cue for next session. Confirm the day streak count in one clause, no fanfare, then end the turn and stop talking.",
};
```

### Rationale per field

**`endOfSpeechPatienceMs: 500`** — Drill must be the most aggressive mode, but
the engine docs draw a hard floor: Gemini Live's server default silence window
is ~800 ms, Google's recommended band is 500–800 ms, values of 100–200 ms are
documented to fragment natural utterances and degrade transcription quality,
client-side best practice is ≥500 ms, and Google STT's timeout parameter cannot
be configured below 500 ms at all. 500 ms is therefore the *most aggressive
value that is still safe* — the bottom of the documented band, noticeably
snappier than the ~800 ms conversational default. It also encodes a coaching
truth: a drill answer is committed speech; a speaker who has stopped for half a
second in a quickfire rep has finished, and waiting teaches slow habits. (In
practice: map to `silence_duration_ms`/VAD config, keeping `prefix_padding_ms`
generous so the first syllable of the next answer survives.)

**`interruptionPolicy`** — Real drilling grants a buzzer, not a queue: quiz
bowl, sparring, and drill pad all let the performer signal "I've got it" the
instant they have it, and Gemini Live's server VAD cancels generation cleanly on
user barge-in — so full user-side barge-in is cheap and authentic. The other
direction is what makes Drill distinct from every other mode: the *coach* also
cuts the user off, but only mechanically, at the response window's edges. DTT
treats latency and non-response as measured events; drill instructors call time.
Bounded, announced, rule-based cut-ins ("time — next one") preserve the
response window as the core stimulus of the mode without the coach ever
chattily overlapping the user mid-sentence, which the research gives no basis
for. This one-directional-exception policy is the contract's sharpest differentiator.

**`responseStyleHint`** — The correction research is unambiguous about *form*:
terminal not concurrent, one fix per rep, brief, external-focus, standardized
phrasing (Wulf: frequent brief external cues improve transfer, while detailed
internal diagnosis breeds self-consciousness; Sadowski: prescriptive statements
on key elements only). It is equally unambiguous about *frequency*: bandwidth
feedback — nothing when the rep is within tolerance — beat 100% correction on
retention, with "silence = correct" as the explicit rule. A voice room cannot
 literally stay silent (dead air breaks turn-taking), so the contract specifies
the functional equivalent: a fixed, information-free ack token. Deferring
comprehensive feedback to the close, and shrinking the rep rather than
re-explaining after repeated misses, are the bandwidth and by-the-numbers
findings translated to speech.

**`pacingHint`** — Every timing here comes from §1–§4: next-rep handoff inside
the DTT inter-trial interval (1–5 s, shorter better), rep cycles sized by the
interview-drill norms (quickfire vs. 90-second answers), ~5-minute blocks and a
20-minute cap because full-effort practice exhausts (Ericsson's violinists
capped sessions near 80 minutes with hourly breaks; drill sprints in the
literature run 1–10 minutes), and CAT-style one-dial stepping that holds the
session near 70–85% success — Ericsson's "just beyond current ability" made
operational. Varying surface wording while holding the skill constant is the
SAFMEDS shuffle; it prevents the rep from attaching to a memorized string.

**`openingBehavior`** — Deliberate practice requires a well-defined task with a
goal the learner understands, adaptive testing opens with a medium-easy routing
item and updates from the first response, and RAMP warm-ups escalate toward
working intensity while mirroring the session ahead. The calibration rep is all
three in one move: it states the pass condition (no vague "let's practice
today"), gets a real sample of current level instead of asking the user to
self-assess, and ramps into intensity by rep 3 — all inside 15 seconds, because
a drill session that opens with a goal-setting conversation has already broken
its own contract.

**`closingBehavior`** — The AAR is the most battle-tested closing structure in
any drilling tradition: immediate, participant-focused, blameless, and built
around planned-vs-actual with one forward action. The summary contents come
from §5 — accuracy *and* median latency *and* streak *and* weakest category —
because percent-correct alone hides the stagnation precision teaching exposed
(accurate-but-slow is not mastery), and the per-category cut is what makes the
next session's plan selectable. Ending with exactly one focus cue honors the
one-fix-per-rep rule at session scale, and the single-clause day streak keeps
the motivational surface to the minimum the Duolingo data supports (frequency
protection, not fanfare) while the competence evidence in the numbers does the
real motivating.

---

## Sources

Deliberate practice & session limits:
- Ericsson, Krampe & Tesch-Römer (1993), *The Role of Deliberate Practice in the Acquisition of Expert Performance* — [scanned PDF via gwern.net](https://gwern.net/doc/psychology/1993-ericsson.pdf)
- [Practice (learning method) — Wikipedia](https://en.wikipedia.org/wiki/Practice_(learning_method)) (five criteria; Duvivier principles)
- Noden (2017, Uppsala) & practice-structure discussions of the violinist data (19.5 × 80-min sessions/week; hourly breaks) — surfaced via search summaries
- [James Clear — The Beginner's Guide to Deliberate Practice](https://jamesclear.com/beginners-guide-deliberate-practice) (measurement + coaching feedback)

Feedback science (bandwidth, focus, frequency):
- Sadowski et al. (2013), *Benefits of Bandwidth Feedback in Learning a Complex Motor Skill* — [PMC3796837](https://pmc.ncbi.nlm.nih.gov/articles/PMC3796837)
- Wulf, Chiviacowsky, Schiller & Ávila (2010), *Frequent External-Focus Feedback Enhances Motor Learning* — [PMC3153799](https://pmc.ncbi.nlm.nih.gov/articles/PMC3153799)
- McKay et al. (2022), meta-analysis of reduced relative feedback frequency — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1469029222000334) (contested literature)

Practice scheduling:
- [Contextual Interference Effect (blocked vs random) — Thürer et al. 2019, PMC](https://pmc.ncbi.nlm.nih.gov) + motor-learning practice-schedule summaries (blocked wins in-session, random wins in retention)

Discrete-trial training & mastery criteria:
- DTT structure and ITI 1–5 s: [Ambitions ABA](https://www.ambitionsaba.com), [Certify ND ABA](https://certifyndaba.com), [Autism Learning Partners](https://autismlearningpartners.com), [Magnolia Behavior Therapy](https://magnoliabehaviortherapy.com)
- Koegel et al. (1980), intertrial interval duration and learning — [PMC](https://pmc.ncbi.nlm.nih.gov)
- Mastery 80%/3-consecutive: Peters et al. ([WNE digitalcommons](https://digitalcommons.wne.edu)); Kha (2012) ([Rowan](https://rdw.rowan.edu)); precision-teaching fluency aims 60–80/min over 3 sessions ([celeration.org](https://celeration.org))

Fluency & spacing:
- [Precision teaching — Wikipedia](https://en.wikipedia.org/wiki/Precision_teaching) (SAFMEDS, counts/min, Standard Celeration Chart)
- [Spaced repetition — Wikipedia](https://en.wikipedia.org/wiki/Spaced_repetition) (interval doubling, reset on miss, ~90% recall target, Pimsleur/Leitner)

Military drill & debrief:
- [Drill instructor — Wikipedia](https://en.wikipedia.org/wiki/Drill_instructor) (constant correction; verbatim instruction)
- [Drill commands — Wikipedia](https://en.wikipedia.org/wiki/Drill_commands) (two-part commands; drilled to instinct)
- Army drill manual ("drill by the numbers": movements divided into motions for instruction) — [manual mirror](https://fliphtml5.com)
- [After action review — Wikipedia](https://en.wikipedia.org/wiki/After_action_review)

Interview drilling:
- MIT CAPD on STAR proportions ([capd.mit.edu](https://capd.mit.edu)); interview-coaching norms on 90 s–2 min answers, out-loud repetition, cue words over scripts (search-surfaced coaching sources)

Adaptive difficulty:
- [Computerized adaptive testing — Wikipedia](https://en.wikipedia.org/wiki/Computerized_adaptive_testing) (medium-easy routing, per-item estimate updates, stop rules)

Motivation:
- Duolingo Blog — [The habit-building research behind your streak](https://blog.duolingo.com/how-duolingo-streak-builds-habit) (7-day streak → 3.6× course completion; Streak Freezes +0.38% DAU) and [Improving the streak](https://blog.duolingo.com/improving-the-streak)

Warm-up:
- RAMP warm-up protocol (Raise/Activate/Mobilise/Potentiate) — [Fast Running](https://fastrunning.com) and coaching sources

Voice engine timing:
- [Gemini Live API guide](https://ai.google.dev/gemini-api/docs/live-guide) (silence_duration_ms default ~800 ms; 500–800 ms recommended; 100–200 ms fragments; ≥500 ms client-side; barge-in interruption handling)
- [Google STT voice activity events & timeouts](https://docs.cloud.google.com/speech-to-text/docs/voice-activity-events) (timeout bounds >500 ms and <60 s; independent begin/end)
