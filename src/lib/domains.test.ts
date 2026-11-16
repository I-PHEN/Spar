import { describe, expect, test } from "bun:test";
import {
  ATTACK_ANGLE_LIST,
  buildCustomRoomBlock,
  buildDomainRoleBlock,
  extractCustomRoomFromContext,
  extractDomainFromRoomContext,
  extractRoomBlueprintFromContext,
  formatSessionRoomContext,
  inferDomainFromText,
  resolveActiveDomain,
  STANCE_PRESET_LIST,
  stripCustomRoomFromContext,
} from "./domains";

describe("domains", () => {
  test("inferDomainFromText classifies educational and scientific topics as academic", () => {
    expect(
      inferDomainFromText("Teaching fractions and decimals to 5th grade students")
    ).toBe("academic");
    expect(
      inferDomainFromText("Newton method of optimization and Hessian convergence")
    ).toBe("academic");
    expect(
      inferDomainFromText("Lewis-Sorel distillation column tray calculations")
    ).toBe("academic");
  });

  test("inferDomainFromText classifies resumes and candidate backgrounds as interview", () => {
    expect(
      inferDomainFromText(
        "Work Experience: Senior Software Engineer at Acme. Promoted to lead architect.",
        "Michael_Resume_2026.pdf"
      )
    ).toBe("interview");
  });

  test("inferDomainFromText classifies startup GTM and SaaS pitches as commercial", () => {
    expect(
      inferDomainFromText(
        "Enterprise SaaS go-to-market strategy with 14-month CAC payback and $2.4M ARR"
      )
    ).toBe("commercial");
  });

  test("formatSessionRoomContext embeds domain tag, custom instructions, and hotspots", () => {
    const formatted = formatSessionRoomContext({
      domain: "academic",
      customRoom: "High school curriculum committee",
      hotspots: [
        {
          id: "h1",
          target: "Prerequisite gap",
          reason: "Assumes algebra before teaching ratios",
          suggestedChallenge: "How do students without algebra handle step 2?",
        },
      ],
    });

    expect(extractDomainFromRoomContext(formatted)).toBe("academic");
    expect(formatted).toContain("Custom Room Instructions: High school curriculum committee");
    expect(formatted).toContain("Priority Attack Hotspots:");
    expect(formatted).toContain("Prerequisite gap");
  });

  test("buildDomainRoleBlock injects positive academic role anchor and forbids commercial framing", () => {
    const block = buildDomainRoleBlock({
      rawMaterial: "Pedagogical framework for teaching chemical equilibrium in secondary school",
    });

    expect(resolveActiveDomain({
      rawMaterial: "Pedagogical framework for teaching chemical equilibrium in secondary school",
    })).toBe("academic");
    expect(block).toContain("ROLE ANCHOR [ACADEMIC_EDUCATIONAL]");
    expect(block).toContain("Academic Examiner");
    expect(block).toContain("Never ask about commercial monetization");
  });

  test("serializes stance, attack angles, and drill strictness into room blueprint", () => {
    expect(STANCE_PRESET_LIST.length).toBe(3);
    expect(ATTACK_ANGLE_LIST.length).toBe(6);

    const formatted = formatSessionRoomContext({
      domain: "sparring",
      stance: "opposing",
      attackAngles: ["causal_links", "counterfactuals"],
      drillStrictness: "blitz",
      customRoom: "Act as WUDC finals panel chair",
    });

    const parsed = extractRoomBlueprintFromContext(formatted);
    expect(parsed.stance).toBe("opposing");
    expect(parsed.attackAngles).toEqual(["causal_links", "counterfactuals"]);
    expect(parsed.drillStrictness).toBe("blitz");

    const block = buildDomainRoleBlock({
      domain: "sparring",
      roomContext: formatted,
    });
    expect(block).toContain("CUSTOM ROOM BLUEPRINT (MANDATORY)");
    expect(block).toContain("STANCE [OPPOSING / OPPOSITION]");
    expect(block).toContain("[Causal Links & Logic]");
    expect(block).toContain("[Counterfactuals & Weighing]");
  });

  test("preserves multi-line custom room instructions without hotspot truncation and strips cleanly", () => {
    const customRule =
      "Focus strictly on unit economics.\nChallenge any churn assumptions below 3%.";
    const longHotspots = Array.from({ length: 4 }, (_, i) => ({
      id: `h${i + 1}`,
      target: `Long Hotspot Target ${i + 1} `.repeat(8).trim(),
      reason: `Detailed justification for attack hotspot ${i + 1} `.repeat(6).trim(),
      suggestedChallenge: `Ask a pointed follow-up on item ${i + 1} `.repeat(6).trim(),
    }));

    const formatted = formatSessionRoomContext({
      domain: "commercial",
      customRoom: customRule,
      hotspots: longHotspots,
    });

    const extracted = extractCustomRoomFromContext(formatted);
    expect(extracted).toContain("Focus strictly on unit economics.");
    expect(extracted).toContain("Challenge any churn assumptions below 3%.");

    const customBlock = buildCustomRoomBlock(formatted);
    expect(customBlock).toContain("# CUSTOM ROOM INSTRUCTIONS (MUST FOLLOW)");
    expect(customBlock).toContain("Challenge any churn assumptions below 3%.");

    const roleBlock = buildDomainRoleBlock({
      domain: "commercial",
      roomContext: formatted,
    });
    expect(roleBlock).toContain("# CUSTOM ROOM INSTRUCTIONS (MUST FOLLOW)");
    expect(roleBlock).toContain("Focus strictly on unit economics.");

    const stripped = stripCustomRoomFromContext(formatted);
    expect(stripped).not.toContain("Custom Room Instructions:");
    expect(stripped).not.toContain("Focus strictly on unit economics.");
    expect(stripped).toContain("Priority Attack Hotspots:");
  });

  test("embeds voice accent and tone tags before Custom Room Instructions without leaking into custom extraction", () => {
    const formatted = formatSessionRoomContext({
      domain: "academic",
      voiceAccent: "british",
      voiceTone: "crisp",
      seatAccents: { 0: "british", 1: "australian" },
      customRoom: "Act as an Oxford admissions tutor.",
    });

    expect(extractCustomRoomFromContext(formatted)).toBe(
      "Act as an Oxford admissions tutor.",
    );
    expect(formatted).toContain("[VoiceAccent: british]");
    expect(formatted).toContain("[VoiceTone: crisp]");
    expect(formatted).toContain("[SeatAccents: 0=british,1=australian]");
  });

  test("formatRoomDisplaySubtitle hides raw prompt tags while keeping custom or domain role label", async () => {
    const { formatRoomDisplaySubtitle } = await import("./domains");
    const commercial = formatSessionRoomContext({
      domain: "commercial",
      stance: "defending",
      attackAngles: ["evidence_audit", "incentives"],
    });
    const commercialLabel = formatRoomDisplaySubtitle(commercial);
    expect(commercialLabel).not.toContain("[Domain:");
    expect(commercialLabel).not.toContain("[Stance:");
    expect(commercialLabel).toContain("Venture Partner");

    const custom = formatSessionRoomContext({
      domain: "academic",
      stance: "opposing",
      customRoom: "Focus only on my clinical trial methodology.",
    });
    expect(formatRoomDisplaySubtitle(custom)).toBe(
      "Focus only on my clinical trial methodology.",
    );
  });
});
