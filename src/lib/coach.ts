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
- Do not score. Do not grade. Just observe and anticipate.`;

  const claimsBlock =
    params.claims.length > 0
      ? params.claims
          .map((c) => `  ${c.id}. ${c.label}: ${c.claim}`)
          .join("\n")
      : "(No claims extracted — user presented from memory or topic.)";

  const focusBlock = params.coachingFocus
    ? `\n# USER'S COACHING FOCUS\n${params.coachingFocus}\n\nPrioritize this in your analysis.`
    : "";

  const userPrompt = `# PRESENTATION TRANSCRIPT
${params.presentationTranscript || "(The user presented but the transcript was empty.)"}

# CLAIMS THEY WERE DEFENDING
${claimsBlock}
${focusBlock}

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
    return {
      strengths: ["You presented your material. That's the work."],
      weakness: "We couldn't analyze the presentation in detail.",
      anticipatedAttack: "The panel will likely start with your central claim.",
      coachRead:
        "Quick read: you've presented your material. The panel is reviewing. They'll come at your weakest point first. Be ready to defend your central claim with evidence.",
    };
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
