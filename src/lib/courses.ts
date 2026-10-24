// Spar — Executive Coach Courses & Lesson-to-Chamber Linking Contract

import { ARCHETYPES } from "./personas";
import type { ExperienceKey, DrillTarget } from "./experiences";
import type { ArchetypeKey, BehaviorStyle, PersonaConfig, SessionMode } from "./types";

export type CourseDifficulty = "Foundation" | "Intermediate" | "Advanced";
export type CourseStatus = "draft" | "published";

export interface LessonSlideTrap {
  headline: string;
  body: string;
  costOfFailure: string;
}

export interface LessonSlideMentalModel {
  headline: string;
  body: string;
  goldenRule: string;
}

export interface LessonSlideTape {
  headline: string;
  prompt: string;
  weakResponse: string;
  weakCritique: string;
  strongResponse: string;
  strongWhy: string;
}

export interface LessonSlideMission {
  briefing: string;
  passCriteria: string;
  openingAttack: string;
}

export interface LessonSlides {
  trap: LessonSlideTrap;
  mentalModel: LessonSlideMentalModel;
  tape: LessonSlideTape;
  mission: LessonSlideMission;
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
  slides: LessonSlides;
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
  title: string;
  subtitle: string;
  description: string;
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
    slides: {
      trap: {
        headline: "The Defensive Backstory Trap",
        body: "When challenged on a hard metric or missed milestone, most speakers spend 40 seconds explaining the history before answering the question.",
        costOfFailure: "The panel assumes you are evading accountability and interrupts before you reach your point.",
      },
      mentalModel: {
        headline: "The Headline-First Protocol",
        body: "Deliver the direct answer in your first sentence. Follow with at most two concrete drivers, then stop speaking and yield the floor.",
        goldenRule: "First 5 seconds = the direct answer. Next 10 seconds = two proof points. Then stop.",
      },
      tape: {
        headline: "Tape Comparison: Rambling vs. Executive",
        prompt: "Why did enterprise onboarding slip by three weeks this quarter?",
        weakResponse:
          "Well, we had a lot of moving pieces with the security audit and the client's IT team was also changing their SSO provider, so things took longer...",
        weakCritique:
          "Starts with 'Well', blames external factors first, and never directly owns the timeline.",
        strongResponse:
          "Enterprise onboarding took 5 weeks instead of 2 due to SSO compliance gating. We automated that check on Tuesday, bringing cycle time back to 10 days.",
        strongWhy:
          "Owns the exact number immediately, names the single root cause, and closes with the verified fix.",
      },
      mission: {
        briefing:
          "Ada will press you on a slipped milestone or key metric. Apply the Headline-First Protocol immediately without defensive preamble.",
        passCriteria:
          "Answer directly in your first sentence in under 25 words with zero hedge words.",
        openingAttack:
          "Your team missed the Q3 launch window by three weeks. Can you actually hit the Q4 target, or are we looking at another slip?",
      },
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
    title: `Module ${index}: Core Foundations`,
    description: "Master the fundamental response patterns under pressure.",
    lessons: [createEmptyLesson(1)],
  };
}

/** Factory for a new draft course in the Creator Studio */
export function createEmptyCourse(): Course {
  return {
    id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: "Untitled Executive Course",
    subtitle: "High-stakes communication drills for skeptical rooms",
    description:
      "A practical training track designed to sharpen executive clarity, eliminate defensive rambling, and command high-pressure Q&A.",
    category: "Executive Presence",
    difficulty: "Intermediate",
    estimatedMinutes: 15,
    status: "draft",
    updatedAt: new Date().toISOString(),
    modules: [createEmptyModule(1)],
  };
}

// ─── Seeded Partner Courses ─────────────────────────────────────────────────

export const DEFAULT_COURSES: Course[] = [
  {
    id: "defending-under-fire",
    title: "Defending Under Fire",
    subtitle: "Command high-stakes Q&A against skeptical stakeholders",
    description:
      "Learn how to open with authority, defend foundational assumptions, and hold your ground when an adversarial panel challenges your thesis.",
    category: "Executive Defense",
    difficulty: "Advanced",
    estimatedMinutes: 15,
    status: "published",
    updatedAt: "2026-10-20T10:00:00.000Z",
    modules: [
      {
        id: "duf-mod-1",
        title: "Module 1: The First 5 Seconds",
        description:
          "Control the frame of any hostile question in your very first sentence.",
        lessons: [
          {
            id: "duf-lesson-1-bluf",
            title: "BLUF: Bottom-Line Up Front",
            tagline: "Never bury your conclusion inside your backstory",
            durationMinutes: 5,
            slides: {
              trap: {
                headline: "The Backstory Spiral",
                body: "When a board member or investor asks a sharp question about margins or timelines, 80% of speakers instinctively start with chronological history. By second 25, the room thinks you are dodging.",
                costOfFailure:
                  "Skeptics cut you off mid-setup, and you never get to deliver your strongest proof.",
              },
              mentalModel: {
                headline: "Bottom-Line Up Front (BLUF)",
                body: "Reverse your structure. State the conclusion—a clear 'Yes', 'No', or exact figure—in the first 5 seconds. Then give at most two supporting drivers and stop.",
                goldenRule:
                  "Sentence 1 = The direct answer. Sentence 2 = Two concrete drivers. Period.",
              },
              tape: {
                headline: "The Margin Compression Question",
                prompt: "Why did gross margin drop 4 points this quarter?",
                weakResponse:
                  "Well, as we talked about in the pre-read, we started migrating our cloud infrastructure in July and there were some overlapping vendor contracts...",
                weakCritique:
                  "Buries the answer under process excuses. Sounds defensive and unprepared.",
                strongResponse:
                  "Gross margin dipped 4 points to 68% due to one-time dual-cloud migration costs. That overlap ended October 1st, returning margins to 72% this quarter.",
                strongWhy:
                  "Names the number immediately, isolates the single cause, and states the current recovery.",
              },
              mission: {
                briefing:
                  "Ada is going to press you on unit economics and margin pressure. Deliver your conclusion in the first sentence, back it with one concrete driver, and stop.",
                passCriteria:
                  "Start with a direct declarative answer in under 25 words without setup fluff.",
                openingAttack:
                  "Your customer acquisition cost jumped 18% while gross margins tightened. Are your unit economics fundamentally breaking as you scale?",
              },
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
            tagline: "Turn 'What if you're wrong?' into evidence",
            durationMinutes: 5,
            slides: {
              trap: {
                headline: "Arguing the Hypothetical",
                body: "When a skeptic says 'That assumes X—what if X fails?', speakers often argue that X won't fail using optimism instead of downside thresholds.",
                costOfFailure:
                  "You look blind to risk. High-stakes decision makers trust leaders who know their exact break-even floor.",
              },
              mentalModel: {
                headline: "Acknowledge, Bound, Prove",
                body: "Don't deny the risk. State the exact threshold where your thesis still holds, and cite the pilot or baseline data that proves you're above it.",
                goldenRule:
                  "Name the downside floor, cite your baseline metric, and show the buffer.",
              },
              tape: {
                headline: "The Adoption Rate Challenge",
                prompt:
                  "Your whole model assumes 30% enterprise conversion. What if it's 15%?",
                weakResponse:
                  "We really believe 30% is achievable because customers love the product and our sales team is super experienced...",
                weakCritique:
                  "Pure hope. Zero numbers, zero downside math.",
                strongResponse:
                  "Our break-even floor is 14% conversion. Across our first 40 pilot accounts, conversion is tracking at 34%, giving us a 2x buffer above break-even.",
                strongWhy:
                  "Proves the model survives the downside scenario and anchors on measured pilot data.",
              },
              mission: {
                briefing:
                  "Victor will attack the methodology and assumptions behind your forecast. Use Acknowledge, Bound, Prove to anchor on concrete data.",
                passCriteria:
                  "Cite a specific baseline figure or downside threshold in every answer.",
                openingAttack:
                  "Your projection assumes retention stays above 90%, yet your sample size is tiny. What happens to this plan if retention drops to 75%?",
              },
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
        title: "Module 2: Holding the Frame",
        description:
          "Stay composed when panelists question whether your work matters at all.",
        lessons: [
          {
            id: "duf-lesson-3-so-what",
            title: "Answering the 'So What?'",
            tagline: "Translate technical features into stakeholder stakes",
            durationMinutes: 5,
            slides: {
              trap: {
                headline: "The Feature Echo Chamber",
                body: "When asked 'Why does this matter?', builders often repeat how hard the technology was to build rather than who wins or loses money.",
                costOfFailure:
                  "Decision makers tune out when you describe effort instead of commercial or real-world consequence.",
              },
              mentalModel: {
                headline: "Stakeholder + Quantified Consequence",
                body: "Every 'So What?' answer must name a specific person/role and the measurable before-and-after impact on their bottom line or risk.",
                goldenRule:
                  "Name who cares, what pain they have today, and the measurable delta.",
              },
              tape: {
                headline: "The Relevance Probe",
                prompt:
                  "So what? Lots of teams are building workflow automation. Why does yours matter?",
                weakResponse:
                  "Ours uses a custom multi-agent architecture that we spent eight months tuning for higher accuracy...",
                weakCritique:
                  "Talks about internal engineering effort, not customer outcome.",
                strongResponse:
                  "Compliance officers at mid-market banks spend 18 hours a week auditing wire logs manually. We cut that to 20 minutes with zero false negatives.",
                strongWhy:
                  "Names the exact buyer, quantifies the painful baseline, and gives the sharp outcome.",
              },
              mission: {
                briefing:
                  "Chiara will challenge whether your thesis or project matters in the real world. Anchor every response on a specific stakeholder and quantified impact.",
                passCriteria:
                  "Name a concrete stakeholder and a measurable outcome in under 30 words.",
                openingAttack:
                  "I hear the technical details, but so what? Who actually changes their budget or behavior tomorrow because this exists?",
              },
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
    title: "Zero-Hedge Concision",
    subtitle: "Eliminate qualifiers, filler words, and rambling under pressure",
    description:
      "Break the habit of softening your claims with 'I think', 'sort of', and 'hopefully'. Train crisp, 15-word executive responses.",
    category: "Vocal Authority",
    difficulty: "Foundation",
    estimatedMinutes: 10,
    status: "published",
    updatedAt: "2026-10-21T10:00:00.000Z",
    modules: [
      {
        id: "zhc-mod-1",
        title: "Module 1: Killing Qualifiers",
        description: "Remove verbal cushions that signal doubt to the room.",
        lessons: [
          {
            id: "zhc-lesson-1-no-hedges",
            title: "Surgical Declaratives",
            tagline: "Replace 'I think we can' with 'We will'",
            durationMinutes: 5,
            slides: {
              trap: {
                headline: "The Politeness Tax",
                body: "Under pressure, smart speakers unconsciously insert 'I think', 'kind of', 'probably', or 'we're hoping to' to protect themselves from being wrong.",
                costOfFailure:
                  "One hedge word erases the credibility of a right answer. The panel hears uncertainty, not humility.",
              },
              mentalModel: {
                headline: "The Zero-Cushion Rule",
                body: "Strip every qualifier before the verb. If a metric is an estimate, state the range explicitly ('between 12% and 15%') rather than hedging with 'sort of around 14%'.",
                goldenRule:
                  "Never soften a verb with 'think', 'feel', 'maybe', or 'sort of'. State facts or explicit ranges.",
              },
              tape: {
                headline: "Commitment Under Scrutiny",
                prompt: "Can your infrastructure handle 10x traffic on launch day?",
                weakResponse:
                  "I think we should probably be fine because we sort of load-tested most of the endpoints last week.",
                weakCritique:
                  "Four hedges ('I think', 'should', 'probably', 'sort of') in one sentence destroys confidence.",
                strongResponse:
                  "Yes. We load-tested all core endpoints at 15x peak volume yesterday with zero latency degradation.",
                strongWhy:
                  "Zero qualifiers. Direct affirmation backed by the exact stress-test multiple.",
              },
              mission: {
                briefing:
                  "Ada is running a live Hedging Drill. Every time you use 'I think', 'maybe', 'probably', or 'sort of', she will cut you off.",
                passCriteria:
                  "Complete your defense with zero hedge words.",
                openingAttack:
                  "Give me your honest assessment: is your current strategy actually working, or are you just hoping the market shifts in your favor?",
              },
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
            slides: {
              trap: {
                headline: "Thinking Out Loud",
                body: "When you don't know where your sentence is ending, you keep talking until you find the point. In a boardroom, long answers invite interruption.",
                costOfFailure:
                  "After 20 seconds of rambling, the Timekeeper cuts you off and controls the narrative.",
              },
              mentalModel: {
                headline: "Subject → Verb → Metric → Full Stop",
                body: "Force yourself to answer in a single tight sentence under 15 words. Let the panel ask a follow-up if they want deeper detail.",
                goldenRule:
                  "One sentence. Under 15 words. Stop talking when you hit the period.",
              },
              tape: {
                headline: "The One-Sentence Challenge",
                prompt: "What is the single biggest risk to your Q4 plan?",
                weakResponse:
                  "There are a few different things we're watching, including hiring senior engineers and making sure enterprise procurement doesn't drag past December...",
                weakCritique:
                  "Lists multiple vague worries and runs past 25 words without a sharp priority.",
                strongResponse:
                  "Enterprise procurement cycle time is our top risk; we've added legal pre-reviews to cut 14 days.",
                strongWhy:
                  "16 words. Names the #1 risk and the exact countermeasure.",
              },
              mission: {
                briefing:
                  "Marcus (The Timekeeper) is enforcing strict brevity. If you ramble past 15–20 words, he will interrupt and reset you.",
                passCriteria:
                  "Keep every single response under 20 words.",
                openingAttack:
                  "In one sentence: what is your strongest competitive advantage right now?",
              },
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
    title: "Boardroom Curveballs",
    subtitle: "Recover instantly from interruptions, friendly traps, and rapid fire",
    description:
      "Train your reflexes for moments when an ally suddenly pivots to your weakest link or a skeptic demands an instant response.",
    category: "High-Pressure Recovery",
    difficulty: "Intermediate",
    estimatedMinutes: 10,
    status: "published",
    updatedAt: "2026-10-22T10:00:00.000Z",
    modules: [
      {
        id: "bc-mod-1",
        title: "Module 1: Reflex & Recovery",
        description: "Eliminate the deer-in-headlights pause when hit with a curveball.",
        lessons: [
          {
            id: "bc-lesson-1-ally-pivot",
            title: "Surviving the Friendly Trap",
            tagline: "Don't drop your guard when a panelist agrees with you",
            durationMinutes: 5,
            slides: {
              trap: {
                headline: "The Warm-Up Ambush",
                body: "When a friendly stakeholder praises your vision ('I love this direction...'), speakers relax—and get blindsided by the '...but how do you survive X?' follow-up.",
                costOfFailure:
                  "Emotional whiplash leads to a stumbled, defensive answer on your biggest blind spot.",
              },
              mentalModel: {
                headline: "Steelman the Counter-Argument",
                body: "Accept praise in one word ('Thank you'), then immediately name the strongest version of the counter-argument yourself and dismantle it with evidence.",
                goldenRule:
                  "Never coast on praise. Own the hardest counter-argument before they finish pressing it.",
              },
              tape: {
                headline: "The Ally's Pivot",
                prompt:
                  "I love the product velocity. But what stops an incumbent from copying this feature in 60 days?",
                weakResponse:
                  "Thanks! Yeah, big companies usually move pretty slowly so we'll just keep shipping faster than them.",
                weakCritique:
                  "Dismisses a lethal threat with a cliché ('big companies move slowly').",
                strongResponse:
                  "The UI is easy to copy, but our proprietary dataset comes from 400 exclusive clinic integrations that take 18 months to contract.",
                strongWhy:
                  "Concedes the surface layer, then locks in the true structural moat.",
              },
              mission: {
                briefing:
                  "Priya (The Ally) will validate your strength and then immediately probe your most vulnerable flank. Stay sharp and defend with structural facts.",
                passCriteria:
                  "Acknowledge the counter-argument directly and cite a structural defense.",
                openingAttack:
                  "Your core thesis is genuinely compelling. If I'm sitting on the other side of the table, though, what is the single sharpest argument against you—and how do you beat it?",
              },
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
            tagline: "Command the room with immediate vocal onset",
            durationMinutes: 5,
            slides: {
              trap: {
                headline: "The Five-Second Freeze",
                body: "When hit with an unexpected question, pausing for 5+ seconds in silence—or filling the air with 'Um, that's a great question'—signals that you are scrambling.",
                costOfFailure:
                  "Long pauses drain your authority in the room.",
              },
              mentalModel: {
                headline: "Clean Onset Within 2 Seconds",
                body: "Take one silent breath (1 second) and begin with your anchor noun or conclusion. Never say 'That's a great question'—just answer it.",
                goldenRule:
                  "Zero filler preambles. Begin speaking with your core point within 2 seconds.",
              },
              tape: {
                headline: "Instant Onset Under Fire",
                prompt: "If we cut your budget by 40% tomorrow, what gets cut first?",
                weakResponse:
                  "Um... well, that's a really tough question. Let me think about how we'd prioritize...",
                weakCritique:
                  "Wastes 4 seconds stalling with verbal crutches.",
                strongResponse:
                  "We pause paid acquisition immediately and focus 100% of resources on our three highest-margin enterprise renewals.",
                strongWhy:
                  "Immediate, decisive prioritization on the first beat.",
              },
              mission: {
                briefing:
                  "Ada is running a Recovery Speed Drill. Begin your answer decisively within 2 seconds of her question ending.",
                passCriteria:
                  "Respond within 2 seconds with zero 'That's a great question' filler.",
                openingAttack:
                  "You have 15 seconds: if your primary distribution channel disappears tomorrow morning, how do you hit this quarter's target?",
              },
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
