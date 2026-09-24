# Mode research: Open Spar — sparring partners, adversarial collaborators, debate partners

Date: 2026-09-24
Status: Research complete; contract proposed for review
Scope: Grounding for the **Open Spar** mode's interaction contract (Phase 0 mode
research required by `2026-09-24-gemini-live-voice-engine-design.md`).
Open Spar = a free-flowing verbal sparring session where the user and 1–3 AI
panelists go back and forth challenging each other's positions — answers get
built on, then countered.

## Method and sources

Web research across five practice domains: competitive debate and
cross-examination, the Socratic method and street epistemology, executive
sparring / leadership coaching, red-team / devil's-advocate dynamics, and
martial-arts sparring (as the source metaphor). Turn-taking timing literature
and voice-agent endpointing engineering round out the pacing numbers.

Pages fetched and summarized during research:

- Wikipedia: *Socratic questioning*, *Socratic method*, *Sparring*, *Randori*,
  *Red team*, *Devil's advocate*, *Street epistemology*, *Cross-examination*,
  *Debate*
- South Carolina Law Review, *Nine Principles for Effective Cross
  Examinations* (Caldwell & Elliot) — sclarereview/sclawreview.org
- Search-surfaced practice guides (cited via search summaries, not full-text
  fetch): SGS Krav Maga "Sparring Etiquette: The Unwritten Rules of Sparring",
  Evolve MMA "11 Important Muay Thai Sparring Etiquette Rules", Pretty Muay
  Thai "How to Be a Good Sparring Partner", Boxrope "10 Unwritten Sparring
  Rules", FightStyle, Expert Boxing, The Muay Thai Guy; NJSDL Unified Manual
  and NSDA event guides (cross-ex rules); Exco Leadership, Center for Creative
  Leadership, and BCG pages on executive sparring / candid challenge for
  leaders; nateshivar.com summary of Boghossian & Lindsay, *How to Have
  Impossible Conversations*; FutureAGI, Deepgram, Hamming.ai, LiveKit,
  Pipecat, and OpenAI Realtime documentation summaries on endpointing and
  barge-in timing.

(Some search-service rate limiting during the session means a few sources
above are known via search-result summaries rather than full-page reads; each
is marked by how it was accessed. None of the load-bearing claims rest on a
single weak source.)

---

## 1. What "sparring" actually is (the cross-domain definition)

Every domain converges on the same core definition, and it is the single most
important design input: **sparring is mutual education performed under
contest-like conditions, not a contest.**

- Wikipedia's *Sparring* article: sparring is "relatively 'free-form' fighting,
  with enough rules, customs, or agreements to minimize injuries," and its goal
  is "the education of the participants" rather than winning — normally
  distinct from competition.
- Randori (judo): free practice "under conditions of actual contest," where
  partners may use "whatever methods they like provided they do not hurt each
  other," while observing etiquette. In karate's *ju kumite* (soft sparring —
  the randori analogue), **action keeps flowing even after a technique lands**:
  a clean hit is acknowledged *and the exchange continues*.
- Socratic seminar norms (modern pedagogy): cooperation, not contest — the goal
  is not to "win the argument"; active listening; shared responsibility for
  quality.
- Executive sparring: a confidential thinking partner who pressure-tests
  strategy and challenges assumptions — valuable precisely because leaders
  "struggle to obtain candid feedback and dissenting viewpoints" (BCG) and
  because the sparring partner has no stake in the outcome (Exco Leadership,
  CCL).
- Red teaming: dissent is *institutionalized* — a standing duty, framed by
  rules of engagement and a "white team" that sets rules and oversees conduct,
  so challenge never becomes personal attack.

**Design input:** the mode's telos is "make the thinking better," and every
behavior below is calibrated to that. When in doubt between "score a point" and
"improve the argument," a sparring partner does the latter.

## 2. Natural rhythm: alternating turns and how long an exchange chain runs

**Baseline human rhythm.** The turn-taking literature (Stivers et al. 2009,
*PNAS*, as reported in secondary sources) found that across languages the gap
between one speaker finishing and the next starting averages roughly
**200–250 ms**, with cross-language means ranging from near-zero to ~470 ms —
speakers predict turn endings rather than waiting for silence. Voice-agent
engineering sources (Tian Pan; LiveKit) treat ~250 ms as the threshold above
which response gaps start feeling unnatural. This is the physical floor the
mode is aiming at: quickfire alternation, not deliberate spacing.

**Chain length before a reset.** Each domain has its own natural "exchange
chain" before yielding or pivoting:

- *Elenchus (Socratic method):* a refutation chain runs thesis → agreed
  premises → contradiction, then typically **ends in aporia** ("an improved
  state of still not knowing what to say") and often invites "a refined round"
  (e.g., courage as *wise* endurance). Chains are short — a few moves — and
  end in an explicit state change (puzzlement or refinement), not open-ended
  grinding.
- *Martial sparring:* exchanges come in **bursts of a few techniques, then a
  reset** — partners break, re-engage, reset calmly after exchanges. Rounds
  exist; continuous shapeless pressing does not.
- *Cross-examination:* questioners are told to "respect the jurors' time and
  patience" — avoid tedium, repetition, and peripheral points (SC Law Review,
  principle 8). A chain that runs too long on one point damages the
  questioner's credibility more than the answerer's.
- *Competitive debate:* clash is organized into discrete "collisions" —
  constructives, rebuttals, then dedicated reply/summary speeches that
  explicitly recap which clashes were won or dropped.

**Design input:** strict turn alternation with the rhythm of conversation
(~sub-second handoffs); a single thread runs **2–4 exchanges** (user answer →
panelist counter → user answer → panelist counter) before the panelist either
resolves it (concede / call it) or explicitly pivots. Beyond ~4 exchanges on
one point, pressing reads as badgering — the cross-ex literature is explicit
that tedium turns the audience against the presser.

## 3. Building on the last answer rather than ignoring it

This is the strongest cross-domain norm of all — a good sparring partner's
every move is welded to the partner's last move:

- *Elenchus:* Socrates **secures the interlocutor's agreement to premises and
  derives the contradiction from the interlocutor's own answers**. The whole
  method fails if the questioner argues past the answers; concession is the
  engine.
- *Debate:* rebuttal norms require direct engagement with the opponent's last
  argument ("clash"); in competitive practice an argument that goes unanswered
  is treated as conceded, and judges reward engagement over oratory.
- *Street epistemology / Impossible Conversations:* **mirroring** — repeat back
  the other person's last few words (with upward inflection) so they feel
  heard and elaborate; double down on listening; reframe your own emotional
  spikes into curiosity and "keep the conversation going."
- *Devil's advocate (Nemeth's research):* challenge must be *substantive* —
  demand real evidentiary scrutiny of what was actually said, not a ceremonial
  counter-ritual. Assigned, inauthentic dissent is weak and can even entrench
  the target's original belief.
- *Executive sparring:* the partner's value is challenge **grounded in the
  leader's actual strategic position**, not generic pushback.

**Design input:** a panelist turn has a two-part spine — (1) hook the user's
actual words ("You said the churn is *voluntary* — okay, that matters
because…"), including conceding any point that genuinely landed, then (2) push
exactly **one** challenge or follow-up forward. Debate's CX rules make
"one question at a time" a codified rule (NJSDL: "may only ask one question at
a time; two-part/multiple-part questions are not allowed") — stacked questions
are a tell of a questioner who isn't listening.

## 4. Conceding a point vs. keeping pressing

**Concede when the answer defeats the premise.** Domains have vivid norms here:

- *Sparring:* partners acknowledge clean hits (a nod, a touch of gloves) and
  keep flowing — denying a clean hit is exactly what turns sparring into a
  fight. Leaving the ego at the door is a codified unwritten rule (SGS Krav
  Maga; Boxrope).
- *Elenchus:* the honest terminal state is aporia — the questioner concedes
  that neither party has the answer. Frede's point cuts both ways: refuting a
  thesis does *not* establish its rival, so a good Socratic concedes the
  asymmetry instead of overclaiming.
- *Steelmanning:* challenge the strongest version of what the user said, and
  when the strong version survives, say so plainly.

**Press when the answer is vague, evasive, or contradicts an earlier
commitment.** Pressing technique is well documented in cross-ex practice:
repeat the same question calmly (the runaway-witness control through
repetition), narrow to one fact, keep questions short (SC Law Review:
"one fact – one question"; short leading questions "eliminate opportunities
for expansive or evasive answers").

**But press with an ice pick, not a broad axe.** The SC Law Review demeanor
principle, backed by reactance research cited there (forceful, controlling
language elicits reactance; mild persuasive statements outperform strong
ones), plus Boghossian's caution that perplexity "must not slide into
humiliation or shame": pressure stays surgical and warm-toned, escalating only
when genuinely stonewalled, and stepping back the moment the user engages.

**Design input:** concede explicitly and quickly ("Fair — that lands"), then
either escalate the stakes (next, harder challenge on the refined position) or
rotate the thread. Never deny a good answer to keep the game alive; the
session's credibility depends on the panelist's concessions being real.

## 5. Signaling a topic shift or a yield

Sparring partners narrate the seams of the session so the partner always knows
where they are in the flow:

- *Debate/parliamentary practice:* explicit structure signposting — "moving to
  the next clash," dedicated reply speeches that name which points were won.
- *Randori / multiple attackers:* rotation is visible — in Aikikai-style
  multiple-attacker practice (taninzu-gake) attackers come at the defender in
  rapid succession and the defender doesn't know the order; the *format itself*
  makes the handoff legible.
- *Socratic seminars:* the leader explicitly draws in reluctant speakers and
  limits dominators — turn allocation is an overt act, not an accident.
- *Impossible Conversations:* staying on one topic at a time and asking
  permission to shift ("Can I push on something else now?") keeps the dialogue
  from derailing.

**Design input:** shifts are verbalized in one clause and tied to a reason
("We've beaten the pricing point to death — let's take the hiring side"),
never silent topic-hopping. A yield to another panelist is a named handoff
("Priya, you've been on the org side — take this one"). A yield to the user is
a genuine open question followed by actual listening, not a rhetorical trap.

## 6. Intensity norms: what keeps it sparring rather than argument

The domains are strikingly consistent about the line between productive
adversarial collaboration and a fight:

1. **Agree the intensity up front.** Sparring partners agree on pace and rules
   before the first round (Muay Thai practice guides; sparring "rules, customs,
   or agreements" per Wikipedia). For the mode: intensity is effectively
   contracted at session start (topic + implied stakes + the panelists'
   opening tone).
2. **Calibrate output to the partner's level.** "Tone your skill level to your
   partner"; "adjust your pace to your partner and help beginners grow"; ~25%
   power for beginners with emphasis on technique and timing, not power (SGS
   Krav Maga; FightStyle; Evolve MMA; Expert Boxing). Hard challenge, soft
   landing for novices; full pressure only for practiced users.
3. **Hard on ideas, soft on people.** Red team ROEs and the white-team
   overseer exist to keep attack on the *position*, never the person;
   reactance research says controlling language loses juries *and* minds.
4. **Resets are built in.** After a hard exchange, partners reset calmly and
   show composure; rounds end with respect (touch gloves) regardless of what
   landed (Boxrope; The Muay Thai Guy).
5. **Shared goal, not zero-sum.** Socratic cooperation-not-contest; sparring's
   "education of the participants"; the sparring partner's independence (no
   stake in winning). An argument is two people defending egos; sparring is
   two people attacking a problem.
6. **Warmth markers survive the intensity.** Humor, acknowledgment of good
   hits, and explicit concessions are the prosody that signals "we're on the
   same side of the problem even as I hit you."

**Design input:** the panelist should be the *hardest* honest reader of the
user's position and the *warmest* reader of the user as a person — and the gap
between those two readings should be audible.

## 7. How sessions open

- *Sparring:* touch gloves, agree pace/rules, then engage immediately — no
  lecture first.
- *Red team:* a rules-of-engagement scoping pass before the engagement —
  what's targetable, what's out of bounds.
- *Debate:* the resolution is framed, then first constructives — positions on
  the table fast.
- *Socratic practice:* start from the interlocutor's own thesis (their
  commonly held belief), with an open-ended opening question and no designated
  first speaker; the examination *is* the content.
- *Executive sparring:* the partner starts from the leader's real strategic
  position, asking the questions others won't.

**Design input:** open in two moves, not a monologue — (1) frame the topic in
one sentence (and, at most, one sentence of stakes: "Convince me, because
investors won't be polite about this"), (2) ask for the user's position and
reasoning. The **first challenge must be built out of the user's first
answer**, never a canned talking point; an opening challenge that ignores what
the user just said breaks the sparring contract in the first thirty seconds.

## 8. How sessions close

- *Socratic seminars:* closing questions prompt participants to **summarize
  and personalize** what they discussed.
- *Parliamentary debate:* reply/summary speeches that address the opposing
  bench's arguments and recap the clashes.
- *Red team:* prompt debriefs; findings recorded and tracked to remediation —
  the close is where the engagement pays out.
- *Sparring:* end of round — respect shown, cooldown, and (in coaching
  contexts) a short review of what to work on.

**Design input:** close with a **synthesis, not a verdict**: (a) what survived
the session (points the user carried), (b) what fell (points conceded or
out-argued), (c) the user's single strongest moment — named concretely, and
(d) one takeaway to work on next time. Keep it under ~30 seconds; end with a
light invitation to run it back. A scoring lecture or a gotcha recap converts
a sparring session into a trial transcript.

## 9. Handling the user dodging or going circular

The cross-examination world has the deepest playbook, and it transfers
directly:

- **Repeat the question calmly.** The runaway-witness technique: let them
  "gush out," then repeat the identical question-assertion without irritation
  (SC Law Review, principle 6). Jurors (and users) are persuaded "when *they*,
  not the attorneys, draw the conclusion" that a witness is evasive — so let
  the dodge become audible rather than denouncing it.
- **Narrow to one fact.** "One fact – one question"; short questions deny room
  for expansive non-answers. "So — yes, or no?" is the canonical compression.
- **Stay on one topic; don't chase rabbits.** Street epistemology's core
  discipline: one question at a time, resist topic-switching, anchor to the
  issue. A dodger *wants* the chase; a good partner declines it.
- **Mirror before pressing.** Reflect the last words back so the dodge is
  first made visible to the dodger.
- **Name the pattern without hostility, then fork it.** After 2 consecutive
  dodges/circles: "I notice we've left the pricing question twice — I want to
  pin it before we move." Then offer the fork explicitly: answer it, concede
  the point ("you can just give it to me"), or park it deliberately and take
  the hit in the synthesis.
- **Don't over-press.** Nemeth's finding applies to the *challenger* too:
  ritualized, forceful pressing entrenches rather than moves people. After the
  fork, move on; the synthesis reprises unpinned threads. Badgering is the
  argument-mode failure, not the sparring-mode tool.

## 10. Multi-partner coordination (2–3 panelists)

The Aikido/judo multi-attacker format (taninzu-gake — "multiple attackers") is
the exact physical analogue of a 1-vs-3 panel, and its mechanics are
instructive: attackers engage **in rapid succession, effectively one at a
time**, with the order unknown to the defender. The chaos comes from rotation
speed and unpredictability — not from a simultaneous pile-on (which physically
doesn't work and, in a voice room, becomes an unintelligible wall of speech).

Supporting norms from other domains:

- *Socratic seminar leadership:* the leader explicitly "draws in reluctant
  speakers and limits dominators" — turn allocation is a managed act.
- *Debate:* questions/POIs are strictly one-at-a-time with protected windows;
  Grand Crossfire (all four debaters at once) is the known degenerate format
  and is heavily moderated.
- *Defense-committee practice* (per the roadmap's own Defense-mode research
  framing): a chair mediates and controls question cadence.
- *Red/blue teaming:* roles are differentiated (attacker vs. analyst), which is
  what makes the alternating pressure coherent rather than noisy.

**Design input for the panel:**

1. **Strict alternation by default.** One panelist speaks per turn. Simultaneous
   speech is a bug in this medium, not a feature.
2. **Named handoffs on rotation** ("Victor — you're colder on this than I am;
   go"). The user should always hear *who has the floor*.
3. **Differentiate by angle, not just volume.** Panelists should attack from
   different registers — evidence, values, practicality — so rotation feels
   like the randori line changing, not the same hit repeated louder.
4. **Pile-on only as a deliberate, rare beat.** A short second jab ("and it's
   not just Ada — the numbers don't hold either") *after* the first panelist's
   challenge has been answered, capped at two panelists per beat. Never three,
   never unreplied.
5. **A chair function emerges naturally:** the panelist who framed the topic
   (or the most recent handoffer) manages pivots and the close. This mirrors
   both the seminar leader and the defense-committee chair.

---

## 11. Voice-timing grounding (for `endOfSpeechPatienceMs`)

Engineering numbers from voice-agent practice:

- Typical silence-threshold endpointing sits at **800–1200 ms**; below ~300–500
  ms of silence, agents start prematurely cutting users mid-thought
  (FutureAGI, Hamming.ai).
- Semantic turn detection can push effective end-of-turn detection to
  ~150–200 ms by predicting completion from meaning rather than silence
  (LiveKit turn detector — the stack behind ChatGPT's voice mode; Pipecat
  Smart Turn, ~12 ms inference; Deepgram semantic endpointing with a 5000 ms
  forced fallback default).
- OpenAI's Realtime API semantic VAD exposes `prefix_padding_ms` /
  `silence_duration_ms`, with the common configuration at **500 ms** of
  semantic-confirmed silence before committing to a response; first audio can
  land ~250 ms after turn detection.
- Human conversational gap average: ~200–250 ms (Stivers et al. 2009, via
  secondary sources), i.e., a sparring rhythm is *faster* than what patient
  silence-only endpointing produces.

**Reading for Open Spar:** the mode wants the shortest patience window of all
Spar modes — snappy, conversational, turn-and-turn-about — but still above the
false-interruption danger zone, because a sparring partner who cuts you off
mid-sentence while *you* are mid-argument is the fastest way to break the
sparring illusion. With semantic endpointing as the primary signal,
**500 ms** is the sweet spot: it matches the aggressive-but-safe production
configuration used by OpenAI Realtime's semantic VAD, sits at the very bottom
of the conventional 800–1200 ms range, and clears the human ~200–250 ms gap
average with enough headroom to avoid clipping a deliberate thinker's
mid-turn pause. (Boardroom, by contrast, is specified in the roadmap with
*tolerant* patience for thinking pauses — the contrast is the point.)

---

## 12. Recommended mode interaction contract: Open Spar

```js
{
  endOfSpeechPatienceMs: 500,
  interruptionPolicy:
    "bidirectional with instant user priority: the user may always barge in and the speaking panelist stops within ~150ms; a panelist may interject mid-user-turn only as (a) a one-line build-on or quick correction, or (b) a redirect after two consecutive circular or dodged answers — never to open a new argument, max one panelist interjection per user turn",
  responseStyleHint:
    "Build-then-counter in one to three sentences: hook the user's actual last words ('You said X — that matters because...'), concede plainly any point that landed, then push exactly one challenge or one follow-up question forward; steelman the strongest version of the position; one question at a time; no monologues and no relitigating conceded points",
  pacingHint:
    "Turn-and-turn-about volleys: strict alternation with sub-second handoffs, two to four exchanges on one thread then explicitly pivot or concede-and-escalate; panelist turns under ~20 seconds of speech; only one panelist speaks per turn, rotating by named handoff, differentiated by attack angle; a two-panelist converging jab is a rare deliberate beat, never three",
  openingBehavior:
    "Two sentences maximum: one-sentence frame of the topic plus one sentence of stakes, then ask for the user's position and reasoning; the first challenge must be constructed from the user's first answer, never a canned talking point",
  closingBehavior:
    "Synthesis, not verdict: name what survived, what fell, the user's single strongest moment, and one concrete takeaway to work on — under ~30 seconds, warm in tone, ending with a one-line invitation to run it back"
}
```

### Rationale per field

**`endOfSpeechPatienceMs: 500`** — Sparring is the fastest human dialogue
rhythm in the product's model set: turn-taking research puts the human
conversational gap at ~200–250 ms, and a sparring partner who visibly *waits*
feels like a deposition, not a sparring session. At the same time, the
false-cut danger zone is 300–500 ms of silence, and the mode's own integrity
depends on the user being allowed to finish a mid-argument pause without being
jumped — a sparring partner who interrupts your thinking is a partner who
fears your answer. 500 ms of semantic-endpointing-confirmed silence is the
documented aggressive-but-safe production value (OpenAI Realtime's common
semantic-VAD configuration), the bottom of the conventional 800–1200 ms
endpointing range, and comfortably above the human gap average. It makes Open
Spar the shortest-patience, most flowing mode in the lineup while leaving
Boardroom its deliberately tolerant thinking pauses.

**`interruptionPolicy`** — Real sparring is bidirectional contact under
control: judo's randori permits "whatever methods they like provided they do
not hurt each other," and the unwritten rules of sparring make the *user's*
right to engage absolute while the senior partner's contact stays calibrated.
Concretely: the user can always barge in (panelist yields instantly — the
~150 ms stop is the voice equivalent of a partner absorbing a hit rather than
blocking it), while panelist interruptions are rare, short, and always in
service of the exchange — a one-line build-on (the "quick jab" that keeps
randori flowing) or a redirect reserved for genuine circularity (Section 9:
repeat, narrow, name, fork). Barring a panelist from opening *new* arguments
mid-user-turn preserves the cross-examination norm that the questioner's
control is used to clarify and confront, never to speech-make.

**`responseStyleHint`** — This field encodes the strongest cross-domain norm
found in the research: every move is welded to the partner's last move. The
elenchus derives its contradictions from the interlocutor's own concessions;
debate's clash norm and the "one question at a time" rule (NJSDL) exist to
force engagement over oratory; mirroring in street epistemology makes the
partner feel heard *before* being challenged; Nemeth's dissent research says
only substantive, evidentiary challenge actually moves people. The
build-then-counter shape (acknowledge/concede, then exactly one push) keeps
panelist turns volley-sized, keeps concessions honest (Section 4: a sparring
partner never denies a clean hit), and keeps the steelman as the default
target — the difference between sparring and straw-grabbing.

**`pacingHint`** — The rhythm findings: human turn gaps ~200–250 ms; Socratic
chains of a few moves ending in aporia or refinement; martial exchanges in
short bursts with resets; cross-ex's hard ceiling on tedium; and randori's
multiple-attacker format where pressure comes from rapid *succession* of
single engagements, not simultaneous pile-ons. Two-to-four exchanges per
thread matches every domain's natural chain length before a yield or pivot,
and the multi-panelist rules (strict alternation, named handoffs,
angle-differentiated panelists, max-two converging jabs as a rare beat) are a
direct translation of taninzu-gake mechanics plus the Socratic seminar
leader's job of allocating turns and limiting dominators — in a voice room,
the moderator function is what keeps three panelists from becoming noise.

**`openingBehavior`** — Sessions in every domain open by contracting the
frame and then engaging immediately: sparring partners touch gloves and agree
pace; red teams scope rules of engagement; debates put positions on the table
fast; Socratic practice starts from the interlocutor's own thesis with an
open question. Two sentences of frame-plus-stakes is the verbal equivalent of
the glove touch — enough to set intensity (Section 6, norm 1: agree the
intensity up front) without a lecture. The requirement that the first
challenge be built from the user's first answer is load-bearing: an opening
challenge that ignores what the user just said breaks the sparring contract
in the first thirty seconds and cannot be recovered later in the session.

**`closingBehavior`** — Every domain pays out at the close: Socratic seminars
end with summary-and-personalization questions; parliamentary reply speeches
recap the clashes; red team engagements end in a tracked debrief (findings,
not feelings); sparring rounds end with respect and a short work-on-this
review. The synthesis-not-verdict shape — survived / fell / strongest moment /
one takeaway — gives the session its pedagogical payout (sparring exists for
the education of the participants) while the warm tone and the invitation to
run it back preserve the cooperation-not-contest ethos and Boghossian's rule
that challenge must never slide into humiliation. Under ~30 seconds keeps the
close from becoming the scoring lecture that turns a sparring partner into a
judge.
