// Spar — Executive Coach Courses, Interactive Practice Schema & Response Evaluator

import { ARCHETYPES } from "./personas";
import type { ExperienceKey, DrillTarget } from "./experiences";
import type { ArchetypeKey, BehaviorStyle, PersonaConfig, SessionMode } from "./types";

export type CourseDifficulty = "Foundation" | "Intermediate" | "Advanced";
export type CourseStatus = "draft" | "published";

export type ActivityType =
  | "lesson"
  | "drill"
  | "simulation"
  | "checkpoint"
  | "final_challenge";

export type LessonPattern =
  | "concept"
  | "speaking_drill"
  | "ai_roleplay"
  | "direct_qa"
  | "checkpoint";

export type VisualLayout = "hero" | "split" | "card";
export type DiagramPreset =
  | "none"
  | "bluf-pyramid"
  | "assumption-floor"
  | "stakeholder-delta"
  | "zero-cushion"
  | "word-ceiling"
  | "steelman-moat"
  | "onset-latency";

export interface SlideVisualMedia {
  url?: string;
  preset?: DiagramPreset;
  caption?: string;
  layout?: VisualLayout;
  altText?: string;
}

export interface MentalModelStep {
  step: number;
  label: string;
  detail: string;
}

export interface LessonSlideTrap {
  headline: string;
  body: string;
  costOfFailure: string;
  instinctQuote?: string;
  flaws?: string[];
  visual?: SlideVisualMedia;
}

export interface LessonSlideMentalModel {
  headline: string;
  body: string;
  goldenRule: string;
  ruleTheme?: "emerald" | "amber" | "cyan";
  steps?: MentalModelStep[];
  visual?: SlideVisualMedia;
}

export interface LessonSlideTape {
  headline: string;
  prompt: string;
  weakResponse: string;
  weakCritique: string;
  strongResponse: string;
  strongWhy: string;
  differenceSummary?: string;
  speakerName?: string;
  weakBadges?: string[];
  strongBadges?: string[];
  visual?: SlideVisualMedia;
}

export interface LessonSlideMission {
  briefing: string;
  passCriteria: string;
  openingAttack: string;
  passCriteriaList?: string[];
  visual?: SlideVisualMedia;
}

export interface LessonSlides {
  trap: LessonSlideTrap;
  mentalModel: LessonSlideMentalModel;
  tape: LessonSlideTape;
  mission: LessonSlideMission;
}

export interface InteractivePracticeConfig {
  hookContext: string;
  hookPrompt: string;
  hookSpeaker: string;
  timeLimitSeconds?: number;
  retryContext: string;
  retryPrompt: string;
  differenceSummary: string;
  targetMaxWords?: number;
  forbiddenClichés?: string[];
  suggestedRewrite: string;
}

export interface LessonRoomConfig {
  experience: Extract<ExperienceKey, "open_spar" | "drill">;
  drillTarget: DrillTarget | null;
  archetype: ArchetypeKey;
  personaName: string;
  behaviorStyle: BehaviorStyle;
}

export interface CourseLesson {
  id: string;
  title: string;
  tagline: string;
  durationMinutes: number;
  activityType?: ActivityType;
  pattern?: LessonPattern;
  slides: LessonSlides;
  practice?: InteractivePracticeConfig;
  roomConfig: LessonRoomConfig;
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  lessons: CourseLesson[];
}

export interface Course {
  id: string;
  slug?: string;
  title: string;
  subtitle: string;
  description: string;
  learningOutcomes?: string[];
  category: string;
  difficulty: CourseDifficulty;
  estimatedMinutes: number;
  status: CourseStatus;
  updatedAt: string;
  modules: CourseModule[];
}

export interface LessonCompletion {
  courseId: string;
  lessonId: string;
  completedAt: string;
  sessionId?: string | null;
}

export interface CreateLinkedSessionPayload {
  experience: ExperienceKey;
  drillTarget: DrillTarget | null;
  coachingEnabled: boolean;
  coachingFocus: string;
  mode: SessionMode;
  materialTitle: string;
  rawMaterial: string;
  roomContext: string;
  personas: PersonaConfig[];
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  lesson: "Lesson",
  drill: "Speaking Drill",
  simulation: "AI Role-Play",
  checkpoint: "Checkpoint",
  final_challenge: "Final Challenge",
};

export const DIAGRAM_PRESET_LABELS: Record<DiagramPreset, string> = {
  none: "No Built-in Diagram (Use Custom URL or Typography)",
  "bluf-pyramid": "Inverted BLUF Pyramid vs. Chronological Spiral",
  "assumption-floor": "Break-Even Downside Floor & Buffer Chart",
  "stakeholder-delta": "Feature Effort vs. Stakeholder Value Bridge",
  "zero-cushion": "Hedge Word Strike-Through & Signal Gain",
  "word-ceiling": "15-Word Attention Decay Curve",
  "steelman-moat": "Surface Praise vs. Structural Moat Diagram",
  "onset-latency": "2-Second Vocal Onset Window",
};

// ─── Evidence-Based Practice Attempt Evaluator ──────────────────────────────

const HEDGE_PATTERNS = [
  "i think",
  "i feel",
  "kind of",
  "sort of",
  "probably",
  "maybe",
  "hopefully",
  "we're hoping",
  "might be",
  "i guess",
];

const FILLER_OPENERS = [
  "um",
  "uh",
  "well",
  "so basically",
  "that's a great question",
  "good question",
  "honestly",
];

export interface PracticeEvaluationResult {
  wordCount: number;
  targetMaxWords: number;
  detectedHedges: string[];
  detectedFillers: string[];
  hasConcreteNumbers: boolean;
  hasDirectOpening: boolean;
  passedCriteriaCount: number;
  totalCriteriaCount: number;
  didWell: string;
  toImprove: string;
  suggestedRewrite: string;
}

/**
 * Evaluates a learner's spoken or written response across honest, measurable
 * dimensions: directness, word economy, filler/hedge usage, and concrete evidence.
 */
export function evaluatePracticeAttempt(
  responseText: string,
  lesson: CourseLesson
): PracticeEvaluationResult {
  const cleaned = responseText.trim();
  const words = cleaned.length > 0 ? cleaned.split(/\s+/) : [];
  const wordCount = words.length;
  const lower = cleaned.toLowerCase();

  const targetMaxWords = lesson.practice?.targetMaxWords ?? 40;

  const detectedHedges = HEDGE_PATTERNS.filter((h) => lower.includes(h));
  const detectedFillers = FILLER_OPENERS.filter((f) => {
    const regex = new RegExp(`\\b${f}\\b`, "i");
    return regex.test(lower);
  });

  const firstFiveWords = words.slice(0, 5).join(" ").toLowerCase();
  const startsWithStall = FILLER_OPENERS.some((f) =>
    firstFiveWords.startsWith(f)
  );
  const hasDirectOpening = wordCount >= 4 && !startsWithStall;

  const hasConcreteNumbers = /\b(\d+%?|\d+x|days|weeks|months|hours|minutes|million|thousand)\b/i.test(
    cleaned
  );

  let passedCriteriaCount = 0;
  const totalCriteriaCount = 4;
  if (hasDirectOpening) passedCriteriaCount += 1;
  if (detectedHedges.length === 0) passedCriteriaCount += 1;
  if (wordCount >= 5 && wordCount <= targetMaxWords + 10) passedCriteriaCount += 1;
  if (hasConcreteNumbers) passedCriteriaCount += 1;

  // Determine 1 concrete strength
  let didWell = "You engaged directly with the prompt without stalling.";
  if (detectedHedges.length === 0 && hasConcreteNumbers) {
    didWell =
      "Strong declarative language backed by concrete numbers and zero hedge words.";
  } else if (hasConcreteNumbers) {
    didWell =
      "You anchored your response with specific numbers or timeframes instead of vague generalities.";
  } else if (detectedHedges.length === 0 && hasDirectOpening) {
    didWell =
      "Clean, direct opening with zero qualifying cushions ('I think', 'sort of', 'probably').";
  }

  // Determine 1 specific improvement
  let toImprove =
    "Tighten the structure by naming one concrete metric or timeframe to prove your claim.";
  if (wordCount < 6) {
    toImprove =
      "Your response is too brief to address the challenge. State your conclusion and back it with one concrete proof point.";
  } else if (startsWithStall) {
    toImprove =
      "Cut the opening stall ('Well...', 'Um...', 'Great question') and start immediately with your core point.";
  } else if (detectedHedges.length > 0) {
    toImprove = `Remove the hedge words (${detectedHedges
      .map((h) => `"${h}"`)
      .join(", ")})—state the fact or an explicit range instead.`;
  } else if (wordCount > targetMaxWords + 10) {
    toImprove = `At ${wordCount} words, you risk losing the room. Compress your point under ${targetMaxWords} words and stop.`;
  } else if (!hasConcreteNumbers) {
    toImprove =
      "Replace general claims with a specific number, timeframe, or structural barrier so the panel cannot dismiss it.";
  }

  const suggestedRewrite =
    lesson.practice?.suggestedRewrite || lesson.slides.tape.strongResponse;

  return {
    wordCount,
    targetMaxWords,
    detectedHedges,
    detectedFillers,
    hasConcreteNumbers,
    hasDirectOpening,
    passedCriteriaCount,
    totalCriteriaCount,
    didWell,
    toImprove,
    suggestedRewrite,
  };
}

/**
 * Translates a course lesson into the exact POST /api/sessions payload
 * so clicking "Enter Drill Chamber" launches a pre-configured Sparring Room.
 */
export function buildLessonSessionPayload(
  course: Pick<Course, "id" | "title">,
  lesson: CourseLesson
): CreateLinkedSessionPayload {
  const { roomConfig, slides } = lesson;
  const defaultName =
    ARCHETYPES[roomConfig.archetype]?.defaultName || "Ada";
  const personaName = roomConfig.personaName?.trim() || defaultName;

  const rawMaterial = [
    `Course: ${course.title} — ${lesson.title}`,
    `Executive Rule: ${slides.mentalModel.goldenRule}`,
    `Opening Challenge Context: ${slides.mission.openingAttack}`,
    `Pass Criteria: ${slides.mission.passCriteria}`,
  ].join("\n\n");

  const roomContext = [
    `Coach Lesson Drill: "${lesson.title}" (${course.title}).`,
    `Mission Briefing: ${slides.mission.briefing}`,
    `Opening Challenge to Press: "${slides.mission.openingAttack}"`,
    `Pass Criteria for the User: ${slides.mission.passCriteria}`,
  ].join(" ");

  return {
    experience: roomConfig.experience,
    drillTarget:
      roomConfig.experience === "drill"
        ? roomConfig.drillTarget || "hedging"
        : null,
    coachingEnabled: true,
    coachingFocus: `${slides.mentalModel.goldenRule} (${slides.mission.passCriteria})`.slice(
      0,
      500
    ),
    mode: "with_material",
    materialTitle: `${lesson.title}`.slice(0, 100),
    rawMaterial,
    roomContext: roomContext.slice(0, 1000),
    personas: [
      {
        archetype: roomConfig.archetype,
        name: personaName,
        behaviorStyle: roomConfig.behaviorStyle,
        seatOrder: 0,
      },
    ],
  };
}

/** Flatten all lessons in a course in syllabus order */
export function getCourseLessons(course: Course): CourseLesson[] {
  return course.modules.flatMap((m) => m.lessons);
}

/** Total number of lessons in a course */
export function getCourseLessonCount(course: Course): number {
  return getCourseLessons(course).length;
}

/** Find the next incomplete lesson in a course (or the first lesson if all complete) */
export function getNextIncompleteLesson(
  course: Course,
  completedLessonIds: ReadonlySet<string>
): CourseLesson | null {
  const all = getCourseLessons(course);
  if (all.length === 0) return null;
  return all.find((l) => !completedLessonIds.has(l.id)) ?? all[0];
}

/** Factory for a blank lesson in the Creator Studio */
export function createEmptyLesson(index = 1): CourseLesson {
  const id = `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    title: `Lesson ${index}: New Executive Technique`,
    tagline: "State the conclusion before the explanation",
    durationMinutes: 4,
    activityType: "lesson",
    pattern: "concept",
    slides: {
      trap: {
        headline: "The Defensive Backstory Trap",
        body: "When challenged on a hard metric or missed milestone, most speakers spend 40 seconds explaining the history before answering the question.",
        costOfFailure:
          "The panel assumes you are evading accountability and interrupts before you reach your point.",
        instinctQuote:
          "Well, we had several moving pieces with the vendor audit and the timeline shifted because...",
        flaws: ["Chronological Rambling", "Buried Lead", "Defensive Tone"],
        visual: {
          preset: "bluf-pyramid",
          layout: "split",
          caption: "Chronological buildup loses executive attention before the answer lands.",
        },
      },
      mentalModel: {
        headline: "The Headline-First Protocol",
        body: "Deliver the direct answer in your first sentence. Follow with at most two concrete drivers, then stop speaking and yield the floor.",
        goldenRule:
          "First 5 seconds = the direct answer. Next 10 seconds = two proof points. Then stop.",
        ruleTheme: "emerald",
        steps: [
          {
            step: 1,
            label: "Land the Verdict",
            detail: "Open with 'Yes', 'No', or the exact figure in sentence one.",
          },
          {
            step: 2,
            label: "Isolate Two Drivers",
            detail: "Name the primary mechanism and the verifiable metric.",
          },
          {
            step: 3,
            label: "Hold the Period",
            detail: "Stop speaking cleanly and let the room pull for detail.",
          },
        ],
      },
      tape: {
        headline: "Tape Comparison: Rambling vs. Executive",
        prompt: "Why did enterprise onboarding slip by three weeks this quarter?",
        speakerName: "Ada · Managing Partner",
        weakResponse:
          "Well, we had a lot of moving pieces with the security audit and the client's IT team was also changing their SSO provider, so things took longer...",
        weakCritique:
          "Starts with 'Well', blames external factors first, and never directly owns the timeline.",
        weakBadges: ["Verbal Crutch ('Well')", "Blame-Shifting", "No Recovery Metric"],
        strongResponse:
          "Enterprise onboarding took 5 weeks instead of 2 due to SSO compliance gating. We automated that check on Tuesday, bringing cycle time back to 10 days.",
        strongWhy:
          "Owns the exact number immediately, names the single root cause, and closes with the verified fix.",
        strongBadges: ["Direct Number First", "Single Root Cause", "Verified Fix"],
        differenceSummary:
          "The stronger response owns the exact timeline in the first six words and states the completed fix instead of listing excuses.",
      },
      mission: {
        briefing:
          "Ada will press you on a slipped milestone or key metric. Apply the Headline-First Protocol immediately without defensive preamble.",
        passCriteria:
          "Answer directly in your first sentence in under 25 words with zero hedge words.",
        passCriteriaList: [
          "Deliver the direct answer in your very first sentence",
          "Cite one concrete operational fix or metric",
          "Finish speaking in under 25 words with zero hedges",
        ],
        openingAttack:
          "Your team missed the Q3 launch window by three weeks. Can you actually hit the Q4 target, or are we looking at another slip?",
      },
    },
    practice: {
      hookContext: "Quarterly Board Review · Enterprise Onboarding Delay",
      hookSpeaker: "Ada · Managing Partner",
      hookPrompt: "Why did enterprise onboarding slip by three weeks this quarter?",
      timeLimitSeconds: 30,
      differenceSummary:
        "Instead of listing historical excuses, the stronger response states the exact numbers first, isolates one root cause, and closes with the verified fix.",
      retryContext: "New Scenario · Q4 Launch Window",
      retryPrompt:
        "Your team missed the Q3 launch window by three weeks. Can you actually hit the Q4 target, or are we looking at another slip?",
      targetMaxWords: 35,
      suggestedRewrite:
        "Yes, we will hit the November 15th Q4 target. The Q3 slip came from manual SSO gating, which we automated this week, cutting release testing from 14 days to 3.",
    },
    roomConfig: {
      experience: "open_spar",
      drillTarget: null,
      archetype: "skeptic",
      personaName: "Ada",
      behaviorStyle: "aggressive",
    },
  };
}

/** Factory for a blank module in the Creator Studio */
export function createEmptyModule(index = 1): CourseModule {
  return {
    id: `module-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: `Stage ${index}: Core Foundations`,
    description: "Master the fundamental response patterns under pressure.",
    lessons: [createEmptyLesson(1)],
  };
}

/** Factory for a new draft course in the Creator Studio */
export function createEmptyCourse(): Course {
  return {
    id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: "Untitled Executive Course",
    subtitle: "Handle high-stakes questions with clarity and composure.",
    description:
      "A practical training track designed to sharpen executive clarity, eliminate defensive rambling, and command high-pressure Q&A.",
    category: "Q&A",
    difficulty: "Intermediate",
    estimatedMinutes: 15,
    status: "draft",
    updatedAt: new Date().toISOString(),
    modules: [createEmptyModule(1)],
  };
}

// ─── Seeded Courses ─────────────────────────────────────────────────────────

export const DEFAULT_COURSES: Course[] = [
  {
    id: "defending-under-fire",
    slug: "defending-under-fire",
    title: "Defending Under Fire",
    subtitle: "Defend your reasoning when challenged.",
    description:
      "Learn how to open with authority, defend foundational assumptions with downside math, and hold your ground when an adversarial panel challenges your thesis.",
    learningOutcomes: [
      "Answer hostile questions in the first 5 seconds using BLUF",
      "Defend model assumptions using break-even floors and pilot buffers",
      "Translate technical work into stakeholder value deltas",
    ],
    category: "Q&A",
    difficulty: "Advanced",
    estimatedMinutes: 15,
    status: "published",
    updatedAt: "2026-10-20T10:00:00.000Z",
    modules: [
      {
        id: "duf-mod-1",
        title: "Stage 1: The First 5 Seconds",
        description:
          "Control the frame of any hostile question in your very first sentence.",
        lessons: [
          {
            id: "duf-lesson-1-bluf",
            title: "BLUF: Bottom-Line Up Front",
            tagline: "Lead with your conclusion before explaining the backstory",
            durationMinutes: 5,
            activityType: "lesson",
            pattern: "direct_qa",
            slides: {
              trap: {
                headline: "The Backstory Spiral",
                body: "When a board member or investor asks a sharp question about margins or timelines, most speakers instinctively start with chronological history. By second 25, the room thinks you are dodging.",
                costOfFailure:
                  "Skeptics cut you off mid-setup, and you never get to deliver your strongest proof.",
                instinctQuote:
                  "“Well, as we covered in the pre-read, back in July we started migrating our cloud clusters and...”",
                flaws: [
                  "Chronological Buildup",
                  "Defensive Preamble",
                  "Conclusion Buried at End",
                ],
                visual: {
                  preset: "bluf-pyramid",
                  layout: "split",
                  caption:
                    "Chronology buries the conclusion; BLUF lands the verdict in the first sentence.",
                },
              },
              mentalModel: {
                headline: "Bottom-Line Up Front (BLUF)",
                body: "Reverse your structure. State the conclusion—a clear 'Yes', 'No', or exact figure—in the first 5 seconds. Then give at most two supporting drivers and stop.",
                goldenRule:
                  "Sentence 1 = The direct answer. Sentence 2 = Two concrete drivers. Period.",
                ruleTheme: "emerald",
                steps: [
                  {
                    step: 1,
                    label: "State the Verdict",
                    detail: "Lead with the exact number, 'Yes', or 'No' with zero throat-clearing.",
                  },
                  {
                    step: 2,
                    label: "Name the Single Cause",
                    detail: "Isolate the primary operational driver without historical excuses.",
                  },
                  {
                    step: 3,
                    label: "Lock the Recovery",
                    detail: "State the corrective action already in motion and stop speaking.",
                  },
                ],
                visual: {
                  preset: "bluf-pyramid",
                  layout: "hero",
                },
              },
              tape: {
                headline: "The Margin Compression Question",
                prompt: "Why did gross margin drop 4 points this quarter?",
                speakerName: "Ada · Lead Board Skeptic",
                weakResponse:
                  "Well, as we talked about in the pre-read, we started migrating our cloud infrastructure in July and there were some overlapping vendor contracts...",
                weakCritique:
                  "Buries the answer under process excuses. Sounds defensive and unprepared.",
                weakBadges: ["'Well...' Opener", "Process Excuses", "No Recovery Date"],
                strongResponse:
                  "Gross margin dipped 4 points to 68% due to one-time dual-cloud migration costs. That overlap ended October 1st, returning margins to 72% this quarter.",
                strongWhy:
                  "Names the number immediately, isolates the single cause, and states the current recovery.",
                strongBadges: ["Exact Figure First", "Single Driver", "Verified Rebound"],
                differenceSummary:
                  "The ineffective response narrates history in chronological order; the stronger response states the metric, the single cause, and the recovery date in two sentences.",
              },
              mission: {
                briefing:
                  "Ada is going to press you on unit economics and margin pressure. Deliver your conclusion in the first sentence, back it with one concrete driver, and stop.",
                passCriteria:
                  "Start with a direct declarative answer in under 25 words without setup fluff.",
                passCriteriaList: [
                  "Answer the question directly in your first 8 words",
                  "Cite one specific operational driver or metric",
                  "Zero defensive preambles ('Well', 'Look', 'As you know')",
                ],
                openingAttack:
                  "Your customer acquisition cost jumped 18% while gross margins tightened. Are your unit economics fundamentally breaking as you scale?",
              },
            },
            practice: {
              hookContext: "Quarterly Board Review · Margin Scrutiny",
              hookSpeaker: "Ada · Lead Board Skeptic",
              hookPrompt: "Why did gross margin drop 4 points this quarter?",
              timeLimitSeconds: 30,
              differenceSummary:
                "The ineffective response narrates history chronologically; the stronger response states the exact figure first, isolates one cause, and closes with the recovery date.",
              retryContext: "New Scenario · Unit Economics Challenge",
              retryPrompt:
                "Your customer acquisition cost jumped 18% while gross margins tightened. Are your unit economics fundamentally breaking as you scale?",
              targetMaxWords: 35,
              suggestedRewrite:
                "No, unit economics remain healthy with a 14-month payback. The 18% CAC spike came from upfront enterprise event spend in September, which has already converted into $1.4M of Q4 pipeline.",
            },
            roomConfig: {
              experience: "open_spar",
              drillTarget: null,
              archetype: "skeptic",
              personaName: "Ada",
              behaviorStyle: "aggressive",
            },
          },
          {
            id: "duf-lesson-2-assumption",
            title: "Defending Core Assumptions",
            tagline: "Turn 'What if you're wrong?' into downside math",
            durationMinutes: 5,
            activityType: "drill",
            pattern: "speaking_drill",
            slides: {
              trap: {
                headline: "Arguing the Hypothetical",
                body: "When a skeptic says 'That assumes X—what if X fails?', speakers often argue that X won't fail using optimism instead of downside thresholds.",
                costOfFailure:
                  "You look blind to risk. High-stakes decision makers trust leaders who know their exact break-even floor.",
                instinctQuote:
                  "“We really believe 30% conversion is realistic because our sales team is super experienced...”",
                flaws: [
                  "Optimism Over Math",
                  "Blind to Downside Floor",
                  "Unverified Claims",
                ],
                visual: {
                  preset: "assumption-floor",
                  layout: "split",
                },
              },
              mentalModel: {
                headline: "Acknowledge, Bound, Prove",
                body: "Don't deny the risk. State the exact threshold where your thesis still holds, and cite the pilot or baseline data that proves you're above it.",
                goldenRule:
                  "Name the downside floor, cite your baseline metric, and show the buffer.",
                ruleTheme: "cyan",
                steps: [
                  {
                    step: 1,
                    label: "Name the Break-Even Floor",
                    detail: "Show you know the exact number where the model breaks.",
                  },
                  {
                    step: 2,
                    label: "Anchor on Measured Data",
                    detail: "Cite live cohort or pilot numbers rather than projections.",
                  },
                  {
                    step: 3,
                    label: "Highlight the Safety Margin",
                    detail: "Contrast your live baseline against the downside floor (e.g., 2x buffer).",
                  },
                ],
                visual: {
                  preset: "assumption-floor",
                  layout: "hero",
                },
              },
              tape: {
                headline: "The Adoption Rate Challenge",
                prompt:
                  "Your whole model assumes 30% enterprise conversion. What if it's 15%?",
                speakerName: "Victor · Methodological Nitpicker",
                weakResponse:
                  "We really believe 30% is achievable because customers love the product and our sales team is super experienced...",
                weakCritique:
                  "Pure hope. Zero numbers, zero downside math.",
                weakBadges: ["Subjective Hope", "Zero Downside Math", "No Cohort Proof"],
                strongResponse:
                  "Our break-even floor is 14% conversion. Across our first 40 pilot accounts, conversion is tracking at 34%, giving us a 2x buffer above break-even.",
                strongWhy:
                  "Proves the model survives the downside scenario and anchors on measured pilot data.",
                strongBadges: ["14% Break-Even Floor", "40-Account Pilot", "2.4x Safety Buffer"],
                differenceSummary:
                  "Instead of defending the 30% target with optimism, the stronger response states the 14% break-even floor and cites measured 34% pilot data.",
              },
              mission: {
                briefing:
                  "Victor will attack the methodology and assumptions behind your forecast. Use Acknowledge, Bound, Prove to anchor on concrete data.",
                passCriteria:
                  "Cite a specific baseline figure or downside threshold in every answer.",
                passCriteriaList: [
                  "State your exact downside break-even threshold first",
                  "Reference a concrete pilot or historical sample",
                  "Quantify the safety buffer between baseline and break-even",
                ],
                openingAttack:
                  "Your projection assumes retention stays above 90%, yet your sample size is tiny. What happens to this plan if retention drops to 75%?",
              },
            },
            practice: {
              hookContext: "Investment Committee · Forecast Stress Test",
              hookSpeaker: "Victor · Methodological Nitpicker",
              hookPrompt:
                "Your whole model assumes 30% enterprise conversion. What if it's 15%?",
              timeLimitSeconds: 30,
              differenceSummary:
                "Instead of defending the 30% target with subjective optimism, the stronger response names the 14% break-even floor and proves a 2x buffer using live pilot data.",
              retryContext: "New Scenario · Retention Downside Stress Test",
              retryPrompt:
                "Your projection assumes retention stays above 90%, yet your sample size is tiny. What happens to this plan if retention drops to 75%?",
              targetMaxWords: 40,
              suggestedRewrite:
                "At 75% retention, the product still breaks even within 9 months. Across our first 60 customer cohorts, 12-month net retention is holding at 94%, giving us a 19-point safety margin.",
            },
            roomConfig: {
              experience: "drill",
              drillTarget: "evidence-gaps",
              archetype: "nitpicker",
              personaName: "Victor",
              behaviorStyle: "aggressive",
            },
          },
        ],
      },
      {
        id: "duf-mod-2",
        title: "Stage 2: Commercial Stakes Checkpoint",
        description:
          "Stay composed when panelists question whether your work matters at all.",
        lessons: [
          {
            id: "duf-lesson-3-so-what",
            title: "Answering the 'So What?'",
            tagline: "Translate technical features into stakeholder stakes",
            durationMinutes: 5,
            activityType: "checkpoint",
            pattern: "checkpoint",
            slides: {
              trap: {
                headline: "The Feature Echo Chamber",
                body: "When asked 'Why does this matter?', builders often repeat how hard the technology was to build rather than who wins or loses money.",
                costOfFailure:
                  "Decision makers tune out when you describe effort instead of commercial or real-world consequence.",
                instinctQuote:
                  "“We spent eight months tuning a custom multi-agent pipeline with 99.2% token efficiency...”",
                flaws: [
                  "Internal Effort Focus",
                  "Zero Buyer Named",
                  "No Dollar or Time Delta",
                ],
                visual: {
                  preset: "stakeholder-delta",
                  layout: "split",
                },
              },
              mentalModel: {
                headline: "Stakeholder + Quantified Consequence",
                body: "Every 'So What?' answer must name a specific person/role and the measurable before-and-after impact on their bottom line or risk.",
                goldenRule:
                  "Name who cares, what pain they have today, and the measurable delta.",
                ruleTheme: "amber",
                steps: [
                  {
                    step: 1,
                    label: "Name the Economic Buyer",
                    detail: "Specify the exact role whose budget or risk is on the line.",
                  },
                  {
                    step: 2,
                    label: "Quantify the Status Quo Pain",
                    detail: "State the hours, dollars, or failure rate they suffer today.",
                  },
                  {
                    step: 3,
                    label: "Deliver the After-State Delta",
                    detail: "Contrast before vs. after in a single concrete ratio.",
                  },
                ],
                visual: {
                  preset: "stakeholder-delta",
                  layout: "hero",
                },
              },
              tape: {
                headline: "The Relevance Probe",
                prompt:
                  "So what? Lots of teams are building workflow automation. Why does yours matter?",
                speakerName: "Chiara · Big-Picture Strategist",
                weakResponse:
                  "Ours uses a custom multi-agent architecture that we spent eight months tuning for higher accuracy...",
                weakCritique:
                  "Talks about internal engineering effort, not customer outcome.",
                weakBadges: ["Architecture Jargon", "Effort Justification", "Unquantified Value"],
                strongResponse:
                  "Compliance officers at mid-market banks spend 18 hours a week auditing wire logs manually. We cut that to 20 minutes with zero false negatives.",
                strongWhy:
                  "Names the exact buyer, quantifies the painful baseline, and gives the sharp outcome.",
                strongBadges: ["Named Buyer Role", "18h → 20m Delta", "Zero False Negatives"],
                differenceSummary:
                  "The ineffective response describes internal engineering effort; the stronger response names a specific buyer and quantifies the 18-hour-to-20-minute time savings.",
              },
              mission: {
                briefing:
                  "Chiara will challenge whether your thesis or project matters in the real world. Anchor every response on a specific stakeholder and quantified impact.",
                passCriteria:
                  "Name a concrete stakeholder and a measurable outcome in under 30 words.",
                passCriteriaList: [
                  "Name the specific decision-maker or customer persona",
                  "State a quantified before-and-after metric (time, cost, or risk)",
                  "Zero technical jargon or internal effort talk",
                ],
                openingAttack:
                  "I hear the technical details, but so what? Who actually changes their budget or behavior tomorrow because this exists?",
              },
            },
            practice: {
              hookContext: "Executive Strategy Review · Commercial Relevance",
              hookSpeaker: "Chiara · Big-Picture Strategist",
              hookPrompt:
                "So what? Lots of teams are building workflow automation. Why does yours matter?",
              timeLimitSeconds: 30,
              differenceSummary:
                "The ineffective response describes internal engineering effort; the stronger response names a specific buyer role and quantifies the exact before-and-after delta.",
              retryContext: "Checkpoint Scenario · Budget Justification",
              retryPrompt:
                "I hear the technical details, but so what? Who actually changes their budget or behavior tomorrow because this exists?",
              targetMaxWords: 35,
              suggestedRewrite:
                "VP of Support teams at SaaS companies currently lose $400k a year on Tier-1 ticket escalations. Our system resolves 65% of those tickets automatically within 30 seconds.",
            },
            roomConfig: {
              experience: "open_spar",
              drillTarget: null,
              archetype: "so_what",
              personaName: "Chiara",
              behaviorStyle: "moderate",
            },
          },
        ],
      },
    ],
  },
  {
    id: "zero-hedge-concision",
    slug: "zero-hedge-concision",
    title: "Zero-Hedge Concision",
    subtitle: "Make your point clearly without unnecessary words.",
    description:
      "Break the habit of softening your claims with 'I think', 'sort of', and 'hopefully'. Train crisp, 15-word executive responses.",
    learningOutcomes: [
      "Eliminate qualifying cushions ('I think', 'probably', 'sort of') before verbs",
      "Replace vague estimates with explicit numerical ranges",
      "Compress complex answers under a 15-word ceiling",
    ],
    category: "Communication",
    difficulty: "Foundation",
    estimatedMinutes: 10,
    status: "published",
    updatedAt: "2026-10-21T10:00:00.000Z",
    modules: [
      {
        id: "zhc-mod-1",
        title: "Stage 1: Killing Qualifiers & Word Economy",
        description: "Remove verbal cushions that signal doubt to the room.",
        lessons: [
          {
            id: "zhc-lesson-1-no-hedges",
            title: "Surgical Declaratives",
            tagline: "Replace 'I think we can' with 'We will'",
            durationMinutes: 5,
            activityType: "drill",
            pattern: "speaking_drill",
            slides: {
              trap: {
                headline: "The Politeness Tax",
                body: "Under pressure, smart speakers unconsciously insert 'I think', 'kind of', 'probably', or 'we're hoping to' to protect themselves from being wrong.",
                costOfFailure:
                  "One hedge word erases the credibility of a right answer. The panel hears uncertainty, not humility.",
                instinctQuote:
                  "“I think we should probably be fine because we sort of load-tested most endpoints...”",
                flaws: ["'I think' Cushion", "'Probably / Sort of'", "Self-Doubt Signal"],
                visual: {
                  preset: "zero-cushion",
                  layout: "split",
                },
              },
              mentalModel: {
                headline: "The Zero-Cushion Rule",
                body: "Strip every qualifier before the verb. If a metric is an estimate, state the range explicitly ('between 12% and 15%') rather than hedging with 'sort of around 14%'.",
                goldenRule:
                  "Never soften a verb with 'think', 'feel', 'maybe', or 'sort of'. State facts or explicit ranges.",
                ruleTheme: "emerald",
                steps: [
                  {
                    step: 1,
                    label: "Delete the Qualifier",
                    detail: "Cut 'I think', 'I believe', 'kind of', and 'hopefully' before speaking.",
                  },
                  {
                    step: 2,
                    label: "Lead with an Active Verb",
                    detail: "Use 'We verified', 'We ship', or 'Data shows'.",
                  },
                  {
                    step: 3,
                    label: "Use Explicit Ranges for Uncertainty",
                    detail: "Say '12% to 15%' instead of 'somewhere around 14%'.",
                  },
                ],
                visual: {
                  preset: "zero-cushion",
                  layout: "hero",
                },
              },
              tape: {
                headline: "Commitment Under Scrutiny",
                prompt: "Can your infrastructure handle 10x traffic on launch day?",
                speakerName: "Ada · Infrastructure Skeptic",
                weakResponse:
                  "I think we should probably be fine because we sort of load-tested most of the endpoints last week.",
                weakCritique:
                  "Four hedges ('I think', 'should', 'probably', 'sort of') in one sentence destroys confidence.",
                weakBadges: ["4 Hedge Words", "Vague 'Most Endpoints'", "Zero Metric"],
                strongResponse:
                  "Yes. We load-tested all core endpoints at 15x peak volume yesterday with zero latency degradation.",
                strongWhy:
                  "Zero qualifiers. Direct affirmation backed by the exact stress-test multiple.",
                strongBadges: ["Declarative 'Yes.'", "15x Stress Test", "Zero Hedges"],
                differenceSummary:
                  "Removing 'I think', 'probably', and 'sort of' turns a hesitant guess into a verifiable engineering fact.",
              },
              mission: {
                briefing:
                  "Ada is running a live Hedging Drill. Every time you use 'I think', 'maybe', 'probably', or 'sort of', she will cut you off.",
                passCriteria:
                  "Complete your defense with zero hedge words.",
                passCriteriaList: [
                  "Zero uses of 'I think', 'maybe', 'probably', 'sort of', or 'kind of'",
                  "Open with a clean declarative statement",
                  "Use explicit numerical ranges when estimating",
                ],
                openingAttack:
                  "Give me your honest assessment: is your current strategy actually working, or are you just hoping the market shifts in your favor?",
              },
            },
            practice: {
              hookContext: "Launch Readiness Review · Reliability Check",
              hookSpeaker: "Ada · Infrastructure Skeptic",
              hookPrompt: "Can your infrastructure handle 10x traffic on launch day?",
              timeLimitSeconds: 25,
              differenceSummary:
                "Removing 'I think', 'probably', and 'sort of' turns a hesitant guess into a verifiable commitment backed by a 15x stress test.",
              retryContext: "Speaking Drill · Zero Qualifiers Allowed",
              retryPrompt:
                "Give me your honest assessment: is your current strategy actually working, or are you just hoping the market shifts in your favor?",
              targetMaxWords: 30,
              suggestedRewrite:
                "Our strategy is working. Enterprise win rates rose from 22% to 38% over the last 60 days across 50 qualified deals.",
            },
            roomConfig: {
              experience: "drill",
              drillTarget: "hedging",
              archetype: "skeptic",
              personaName: "Ada",
              behaviorStyle: "aggressive",
            },
          },
          {
            id: "zhc-lesson-2-15-words",
            title: "The 15-Word Ceiling",
            tagline: "Say twice as much in half the words",
            durationMinutes: 5,
            activityType: "drill",
            pattern: "speaking_drill",
            slides: {
              trap: {
                headline: "Thinking Out Loud",
                body: "When you don't know where your sentence is ending, you keep talking until you find the point. In a boardroom, long answers invite interruption.",
                costOfFailure:
                  "After 20 seconds of rambling, the Timekeeper cuts you off and controls the narrative.",
                instinctQuote:
                  "“There are a few different things we're watching right now, including hiring and also enterprise cycles...”",
                flaws: ["Thinking Out Loud", "Multi-Topic Drift", "No Hard Stop"],
                visual: {
                  preset: "word-ceiling",
                  layout: "split",
                },
              },
              mentalModel: {
                headline: "Subject → Verb → Metric → Full Stop",
                body: "Force yourself to answer in a single tight sentence under 15 words. Let the panel ask a follow-up if they want deeper detail.",
                goldenRule:
                  "One sentence. Under 15 words. Stop talking when you hit the period.",
                ruleTheme: "amber",
                steps: [
                  {
                    step: 1,
                    label: "Name the Subject (Words 1–4)",
                    detail: "Identify the single top priority or risk.",
                  },
                  {
                    step: 2,
                    label: "State the Action (Words 5–10)",
                    detail: "Describe the exact mechanism in active voice.",
                  },
                  {
                    step: 3,
                    label: "Land the Metric & Stop (Words 11–15)",
                    detail: "Close on the quantified result and yield the mic.",
                  },
                ],
                visual: {
                  preset: "word-ceiling",
                  layout: "hero",
                },
              },
              tape: {
                headline: "The One-Sentence Challenge",
                prompt: "What is the single biggest risk to your Q4 plan?",
                speakerName: "Marcus · Executive Timekeeper",
                weakResponse:
                  "There are a few different things we're watching, including hiring senior engineers and making sure enterprise procurement doesn't drag past December...",
                weakCritique:
                  "Lists multiple vague worries and runs past 25 words without a sharp priority.",
                weakBadges: ["Unfocused List", "24+ Word Drift", "No Countermeasure"],
                strongResponse:
                  "Enterprise procurement cycle time is our top risk; we've added legal pre-reviews to cut 14 days.",
                strongWhy:
                  "16 words. Names the #1 risk and the exact countermeasure.",
                strongBadges: ["16 Words Total", "Single Priority", "14-Day Fix"],
                differenceSummary:
                  "Instead of listing multiple vague worries, the stronger response names one priority and one quantified countermeasure in a single 16-word sentence.",
              },
              mission: {
                briefing:
                  "Marcus (The Timekeeper) is enforcing strict brevity. If you ramble past 15–20 words, he will interrupt and reset you.",
                passCriteria:
                  "Keep every single response under 20 words.",
                passCriteriaList: [
                  "Deliver your complete answer in a single sentence",
                  "Stay strictly under 20 words per turn",
                  "Stop immediately after the metric lands",
                ],
                openingAttack:
                  "In one sentence: what is your strongest competitive advantage right now?",
              },
            },
            practice: {
              hookContext: "Board Timekeeper Drill · 15-Word Limit",
              hookSpeaker: "Marcus · Executive Timekeeper",
              hookPrompt: "What is the single biggest risk to your Q4 plan?",
              timeLimitSeconds: 20,
              differenceSummary:
                "Instead of listing multiple vague worries, the stronger response names one priority and one quantified countermeasure in a single tight sentence.",
              retryContext: "Word Economy Drill · Under 20 Words",
              retryPrompt:
                "In one sentence: what is your strongest competitive advantage right now?",
              targetMaxWords: 20,
              suggestedRewrite:
                "Our proprietary integrations with 400 clinics give us an 18-month data lead over competitors.",
            },
            roomConfig: {
              experience: "drill",
              drillTarget: "over-explaining",
              archetype: "timekeeper",
              personaName: "Marcus",
              behaviorStyle: "aggressive",
            },
          },
        ],
      },
    ],
  },
  {
    id: "boardroom-curveballs",
    slug: "boardroom-curveballs",
    title: "Boardroom Curveballs",
    subtitle: "Handle unexpected questions without losing composure.",
    description:
      "Train your reflexes for moments when an ally suddenly pivots to your weakest link or a skeptic demands an instant response under pressure.",
    learningOutcomes: [
      "Recognize and survive the friendly warm-up ambush without dropping your guard",
      "Steelman the hardest counter-argument and anchor on structural moats",
      "Begin speaking with a clean, filler-free vocal onset within 2 seconds",
    ],
    category: "Pressure practice",
    difficulty: "Intermediate",
    estimatedMinutes: 10,
    status: "published",
    updatedAt: "2026-10-22T10:00:00.000Z",
    modules: [
      {
        id: "bc-mod-1",
        title: "Stage 1: Composure & Structural Defense",
        description: "Hold your ground when a friendly question suddenly turns into a sharp test.",
        lessons: [
          {
            id: "bc-lesson-1-ally-pivot",
            title: "Surviving the Friendly Trap",
            tagline: "Acknowledge the concern, then prove your structural moat",
            durationMinutes: 5,
            activityType: "lesson",
            pattern: "concept",
            slides: {
              trap: {
                headline: "The Warm-Up Ambush",
                body: "When a friendly stakeholder praises your vision ('I love this direction...'), speakers relax—and get blindsided by the '...but what happens when operating conditions change?' follow-up.",
                costOfFailure:
                  "Emotional whiplash leads to a casual, cliché dismissal on your biggest blind spot.",
                instinctQuote:
                  "“Thanks! Yeah, big companies usually move pretty slowly so we'll just keep shipping faster...”",
                flaws: ["False Security", "Cliché Dismissal", "Unprotected Flank"],
                visual: {
                  preset: "steelman-moat",
                  layout: "split",
                },
              },
              mentalModel: {
                headline: "Acknowledge, Concede Surface, Prove Moat",
                body: "Accept praise briefly, concede what is easy to replicate on the surface, and immediately state the structural evidence or moat that protects your position.",
                goldenRule:
                  "Never coast on praise. Concede the surface layer, then lock in your structural barrier.",
                ruleTheme: "cyan",
                steps: [
                  {
                    step: 1,
                    label: "Acknowledge the Concern",
                    detail: "Validate the question directly without defensive filler or clichés.",
                  },
                  {
                    step: 2,
                    label: "State the Structural Barrier",
                    detail: "Separate the easy-to-copy surface from your proprietary data, contracts, or switching costs.",
                  },
                  {
                    step: 3,
                    label: "Quantify How It Holds Under Pressure",
                    detail: "Cite the concrete lead time, contract duration, or downside protection.",
                  },
                ],
                visual: {
                  preset: "steelman-moat",
                  layout: "hero",
                },
              },
              tape: {
                headline: "The Ally's Pivot",
                prompt:
                  "I love the product velocity. But what stops an incumbent from copying this feature in 60 days?",
                speakerName: "Priya · Constructive Ally",
                weakResponse:
                  "Thanks! Yeah, big companies usually move pretty slowly so we'll just keep shipping faster than them.",
                weakCritique:
                  "Dismisses a lethal threat with a cliché ('big companies move slowly').",
                weakBadges: ["Wishful Cliché", "Ignores Distribution", "Zero Moat Cited"],
                strongResponse:
                  "The UI is easy to copy, but our proprietary dataset comes from 400 exclusive clinic integrations that take 18 months to contract.",
                strongWhy:
                  "Concedes the surface layer, then locks in the true structural moat.",
                strongBadges: ["Concedes Surface", "400 Exclusive Clinics", "18-Month Moat"],
                differenceSummary:
                  "The ineffective response relies on wishful thinking ('incumbents move slowly'); the stronger response concedes the UI is copyable and proves an 18-month contract barrier.",
              },
              mission: {
                briefing:
                  "Priya (The Ally) will validate your strength and then immediately probe your most vulnerable flank. Stay sharp and defend with structural facts.",
                passCriteria:
                  "Acknowledge the counter-argument directly and cite a structural defense.",
                passCriteriaList: [
                  "Do not dismiss the competitor threat with clichés",
                  "Concede what is easy to copy, then pivot to your structural moat",
                  "Quantify the switching cost or replication lead-time",
                ],
                openingAttack:
                  "Your core thesis is genuinely compelling. If I'm sitting on the other side of the table, though, what is the single sharpest argument against you—and how do you beat it?",
              },
            },
            practice: {
              hookContext: "Board Strategy Session · Priya agrees with your proposal, then pivots.",
              hookSpeaker: "Priya · Constructive Ally",
              hookPrompt:
                "I agree that this proposal could improve performance. But what stops an incumbent from copying this feature in 60 days?",
              timeLimitSeconds: 30,
              differenceSummary:
                "The ineffective response dismisses the concern with a cliché ('big companies move slowly'); the stronger response concedes the surface UI is easy to copy and proves an 18-month structural barrier.",
              retryContext: "New Situation · Operating Conditions Shift",
              retryPrompt:
                "I agree that your early traction looks strong. But what happens to this proposal when enterprise operating budgets tighten by 30% next quarter?",
              targetMaxWords: 40,
              suggestedRewrite:
                "If budgets tighten by 30%, discretionary tools get cut first. Because our workflow replaces three legacy audit vendors and saves $180k annually within 60 days, CFOs classify us as cost-consolidation rather than new spend.",
            },
            roomConfig: {
              experience: "open_spar",
              drillTarget: null,
              archetype: "ally",
              personaName: "Priya",
              behaviorStyle: "moderate",
            },
          },
          {
            id: "bc-lesson-2-rapid-recovery",
            title: "Two-Second Recovery",
            tagline: "Command the room with immediate, filler-free vocal onset",
            durationMinutes: 5,
            activityType: "simulation",
            pattern: "ai_roleplay",
            slides: {
              trap: {
                headline: "The Five-Second Freeze",
                body: "When hit with an unexpected question, pausing for 5+ seconds in silence—or filling the air with 'Um, that's a great question'—signals that you are scrambling.",
                costOfFailure:
                  "Long pauses drain your authority in the room.",
                instinctQuote:
                  "“Um... well, that's a really tough question. Let me think about how we'd prioritize...”",
                flaws: ["5-Second Freeze", "'Great Question' Stall", "Audible Panic"],
                visual: {
                  preset: "onset-latency",
                  layout: "split",
                },
              },
              mentalModel: {
                headline: "Clean Onset Within 2 Seconds",
                body: "Take one silent breath (1 second) and begin with your anchor noun or conclusion. Never say 'That's a great question'—just answer it.",
                goldenRule:
                  "Zero filler preambles. Begin speaking with your core point within 2 seconds.",
                ruleTheme: "emerald",
                steps: [
                  {
                    step: 1,
                    label: "1-Second Silent Breath",
                    detail: "Pause silently instead of saying 'Um' or 'Great question'.",
                  },
                  {
                    step: 2,
                    label: "Open with Anchor Noun",
                    detail: "Start your sentence with 'We pause...', 'Priority one is...', or 'Our floor is...'.",
                  },
                  {
                    step: 3,
                    label: "Commit to One Action",
                    detail: "Name the immediate triage move decisively.",
                  },
                ],
                visual: {
                  preset: "onset-latency",
                  layout: "hero",
                },
              },
              tape: {
                headline: "Instant Onset Under Fire",
                prompt: "If we cut your budget by 40% tomorrow, what gets cut first?",
                speakerName: "Ada · Board Chair",
                weakResponse:
                  "Um... well, that's a really tough question. Let me think about how we'd prioritize...",
                weakCritique:
                  "Wastes 4 seconds stalling with verbal crutches.",
                weakBadges: ["'Um... well'", "Stalling Preamble", "Zero Decision"],
                strongResponse:
                  "We pause paid acquisition immediately and focus 100% of resources on our three highest-margin enterprise renewals.",
                strongWhy:
                  "Immediate, decisive prioritization on the first beat.",
                strongBadges: ["1.1s Clean Onset", "Decisive Triage", "Margin Protection"],
                differenceSummary:
                  "The ineffective response stalls with 'Um, that's a tough question'; the stronger response names the exact cut and the protected priority in the first sentence.",
              },
              mission: {
                briefing:
                  "Ada is running a Recovery Speed Drill. Begin your answer decisively within 2 seconds of her question ending.",
                passCriteria:
                  "Respond within 2 seconds with zero 'That's a great question' filler.",
                passCriteriaList: [
                  "Begin speaking within 2.0 seconds of the question ending",
                  "Zero filler openers ('Um', 'Well', 'That's a great question')",
                  "State a decisive first-order action immediately",
                ],
                openingAttack:
                  "You have 15 seconds: if your primary distribution channel disappears tomorrow morning, how do you hit this quarter's target?",
              },
            },
            practice: {
              hookContext: "Emergency Triage Simulation · Surprise Budget Cut",
              hookSpeaker: "Ada · Board Chair",
              hookPrompt: "If we cut your budget by 40% tomorrow, what gets cut first?",
              timeLimitSeconds: 20,
              differenceSummary:
                "The ineffective response wastes 4 seconds stalling with 'Um, tough question'; the stronger response commits to a decisive triage action on beat one.",
              retryContext: "Rapid Recovery Challenge · Channel Shock",
              retryPrompt:
                "You have 15 seconds: if your primary distribution channel disappears tomorrow morning, how do you hit this quarter's target?",
              targetMaxWords: 30,
              suggestedRewrite:
                "We shift 100% of outbound capacity to our 45 existing enterprise accounts via direct co-selling, where expansion deals close in 21 days without paid acquisition.",
            },
            roomConfig: {
              experience: "drill",
              drillTarget: "recovery-speed",
              archetype: "skeptic",
              personaName: "Ada",
              behaviorStyle: "aggressive",
            },
          },
        ],
      },
    ],
  },
];
