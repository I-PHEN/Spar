// Spar — Coach LLM module (SERVER-SIDE ONLY)
//
// The coach analyzes the user's presentation and gives a read before Q&A.
// This is the "executive communication coach" moment — the coach anticipates
// what the panel will attack, based on how the user presented.
//
// IMPORTANT: z-ai-web-dev-sdk MUST be used in backend code only.

import ZAI from "z-ai-web-dev-sdk";
import type { ExtractedClaim } from "./types";

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZai() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

function extractJson<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice) as T;
  } catch {
    try {
      const cleaned = slice.replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }
}

interface PresentationAnalysis {
  /** What the user did well in the presentation (2-3 observations) */
  strengths: string[];
  /** The main weakness in how they presented (1 observation) */
  weakness: string;
  /** What the panel is likely to attack first */
  anticipatedAttack: string;
  /** The coach's read — 1-2 sentences the user sees before Q&A */
  coachRead: string;
}

/**
 * Heuristic check on the presentation transcript — used to build a richer
 * fallback if the LLM fails, and to give the coach context about structure.
 */
function analyzePresentationStructure(transcript: string) {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length;
  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;

  // Detect hedge words (same regex as telemetry)
  const hedgeRegex = /\b(i think|i feel|i guess|i believe|i suppose|maybe|perhaps|possibly|probably|sort of|kind of|like|you know|somewhat|rather|quite|fairly|relatively)\b/gi;
  const hedgeCount = (transcript.match(hedgeRegex) || []).length;

  // Detect if there's a clear thesis statement (first 2 sentences should
  // contain a declarative claim, not a question or hedge)
  const opening = sentences.slice(0, 2).join(" ").toLowerCase();
  const opensWithHedge = /\b(i think|i believe|maybe|perhaps|sort of|kind of)\b/i.test(opening);
  const opensWithQuestion = opening.trim().endsWith("?");

  // Detect rambling (avg >25 words/sentence = long, winding sentences)
  const isRambling = avgWordsPerSentence > 25 && sentenceCount > 3;

  // Detect vague quantifiers
  const vagueRegex = /\b(huge|significant|a lot|many|various|numerous|substantial|considerable)\b/gi;
  const vagueCount = (transcript.match(vagueRegex) || []).length;

  return {
    wordCount,
    sentenceCount,
    avgWordsPerSentence: Math.round(avgWordsPerSentence),
    hedgeCount,
    opensWithHedge,
    opensWithQuestion,
    isRambling,
    vagueCount,
    isTooShort: wordCount < 30,
    isVeryShort: wordCount < 15,
  };
}

/**
 * Analyze the user's presentation transcript and generate a coach read.
 *
 * This runs AFTER the user clicks "Done presenting" and BEFORE the Q&A begins.
 * The coach gives the user a quick read on their presentation and anticipates
 * what the panel will attack.
 *
 * @param presentationTranscript The full text of what the user said during presentation
 * @param claims The extracted claims from the material
 * @param coachingFocus Optional: what the user said they're working on
 */
export async function analyzePresentation(params: {
  presentationTranscript: string;
  claims: ExtractedClaim[];
  coachingFocus?: string | null;
}): Promise<PresentationAnalysis> {
  const zai = await getZai();

  // Heuristic structure analysis — gives the coach concrete signals to
  // reference (word count, hedge count, rambling, etc.)
  const structure = analyzePresentationStructure(params.presentationTranscript);

  const systemPrompt = `You are the Coach on Spar — an executive communication coach. You've just watched the user present their material. Now you're giving them a quick read before the Q&A begins.

Your voice:
- Honest, specific, anticipatory. Like a coach who has seen this a thousand times.
- You're on the user's side, but you don't soften. You tell them the truth.
- You focus on HOW they presented, not WHAT they said. Delivery, not content.
- You anticipate the panel's attacks. You tell the user what's coming.

You evaluate:
- Structure: Did they open with a clear thesis? Did they signpost? Did they land the close?
- Pace: Too fast? Too slow? Inconsistent?
- Confidence: Did they hedge their central claim? Did they trail off?
- Clarity: Was the core message understandable?
- Weak spots: Where will the panel attack first?

# YOUR OUTPUT — STRICT JSON
{
  "strengths": ["<2-3 specific, evidence-based observations about what they did well>"],
  "weakness": "<The main weakness in how they presented — 1 sentence>",
  "anticipatedAttack": "<What the panel will likely attack first — 1 sentence>",
  "coachRead": "<The read the user sees before Q&A. 2-3 sentences. Honest, anticipatory. Foreshadow the attack.>"
}

# RULES
- Reference SPECIFIC moments from the transcript. Don't generalize.
- The coachRead should feel like a trusted advisor whispering in your ear before the hard part.
- If the user provided a coaching focus, prioritize that in your analysis.
- Do not score. Do not grade. Just observe and anticipate.
- Use the STRUCTURE ANALYSIS below to ground your observations in concrete signals.`;

  const claimsBlock =
    params.claims.length > 0
      ? params.claims
          .map((c) => `  ${c.id}. ${c.label}: ${c.claim}`)
          .join("\n")
      : "(No claims extracted — user presented from memory or topic.)";

  const focusBlock = params.coachingFocus
    ? `\n# USER'S COACHING FOCUS\n${params.coachingFocus}\n\nPrioritize this in your analysis.`
    : "";

  const structureBlock = `\n# STRUCTURE ANALYSIS (heuristic — use these signals)
- Word count: ${structure.wordCount}
- Sentence count: ${structure.sentenceCount}
- Avg words per sentence: ${structure.avgWordsPerSentence}
- Hedge words detected: ${structure.hedgeCount}
- Vague quantifiers detected: ${structure.vagueCount}
- Opens with a hedge: ${structure.opensWithHedge ? "YES (weak opening)" : "no"}
- Opens with a question: ${structure.opensWithQuestion ? "YES (weak opening)" : "no"}
- Rambling (long winding sentences): ${structure.isRambling ? "YES" : "no"}
- Too short: ${structure.isTooShort ? "YES" : "no"}${structure.isVeryShort ? " (very short — barely a presentation)" : ""}`;

  const userPrompt = `# PRESENTATION TRANSCRIPT
${params.presentationTranscript || "(The user presented but the transcript was empty.)"}

# CLAIMS THEY WERE DEFENDING
${claimsBlock}${structureBlock}${focusBlock}

Analyze the presentation and produce your JSON read.`;

  const completion = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    thinking: { type: "disabled" },
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJson<PresentationAnalysis>(raw);

  if (!parsed) {
    // Rich fallback — uses the structure analysis to give a specific read
    // even when the LLM fails to return valid JSON.
    return buildFallbackRead(structure);
  }

  return {
    strengths: Array.isArray(parsed.strengths)
      ? parsed.strengths.slice(0, 3).map((s) => s.slice(0, 400))
      : [],
    weakness: parsed.weakness?.slice(0, 400) || "",
    anticipatedAttack: parsed.anticipatedAttack?.slice(0, 400) || "",
    coachRead: parsed.coachRead?.slice(0, 800) || "",
  };
}

/**
 * Build a specific, useful fallback read using the heuristic structure analysis.
 * This runs when the LLM fails to return valid JSON — the user still gets a
 * grounded, specific read instead of a generic "we couldn't analyze" message.
 */
function buildFallbackRead(s: ReturnType<typeof analyzePresentationStructure>): PresentationAnalysis {
  const strengths: string[] = [];
  const issues: string[] = [];

  if (s.wordCount >= 100) {
    strengths.push(`You presented substantive material (${s.wordCount} words) — that's the work.`);
  }
  if (s.hedgeCount === 0 && s.wordCount > 20) {
    strengths.push("You avoided hedge words in your opening — declarative tone.");
  }
  if (s.vagueCount === 0 && s.wordCount > 30) {
    strengths.push("No vague quantifiers — your claims were specific.");
  }
  if (strengths.length === 0) {
    strengths.push("You presented your material. That's the start.");
  }

  if (s.isVeryShort) {
    issues.push("Your presentation was very short — barely a sentence. The panel will attack the lack of substance.");
  } else if (s.isTooShort) {
    issues.push("Your presentation was too short to establish your argument. The panel will probe for depth.");
  } else if (s.opensWithHedge) {
    issues.push("You opened with a hedge ('I think', 'maybe'). The panel will attack your central claim's confidence.");
  } else if (s.isRambling) {
    issues.push(`Your sentences were long and winding (avg ${s.avgWordsPerSentence} words). The panel will attack your clarity.`);
  } else if (s.hedgeCount > 2) {
    issues.push(`You hedged ${s.hedgeCount} times. The panel will attack your confidence in your own claims.`);
  } else if (s.vagueCount > 0) {
    issues.push(`You used ${s.vagueCount} vague quantifier(s). The panel will attack your specificity.`);
  } else {
    issues.push("Be ready for the panel to probe your central claim's evidence.");
  }

  const weakness = issues[0];
  const anticipatedAttack = s.isTooShort
    ? "The panel will start by asking you to actually explain your argument — they haven't heard enough."
    : s.opensWithHedge
    ? "The panel will attack your opening — 'I think' invites 'Why do you think that?'"
    : s.isRambling
    ? "The panel will interrupt to ask you to get to the point."
    : "The panel will attack your central claim first — be ready with evidence.";

  const coachRead = `Quick read: ${weakness} ${anticipatedAttack} Don't defend everything — pick your strongest claim and hold it.`;

  return {
    strengths,
    weakness,
    anticipatedAttack,
    coachRead,
  };
}
