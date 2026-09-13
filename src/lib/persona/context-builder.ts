export const MAX_CONTEXT_TOKENS = 1_800;
export const MAX_ROLLING_SUMMARY_TOKENS = 250;
export const MAX_RECENT_MESSAGES = 6;

const SUMMARY_OMISSION_MARKER = "[Earlier context omitted.]";

export type PersonaContextRole = "system" | "user" | "assistant";

export interface PersonaContextMessage {
  role: PersonaContextRole;
  content: string;
  section?: "stable-prefix" | "dynamic-context";
}

export interface PersonaConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface BuildPersonaContextInput {
  stablePrefix: string;
  sessionRules: string;
  rollingSummary: string;
  deterministicState: Readonly<Record<string, unknown>>;
  history: ReadonlyArray<{
    role: "user" | "assistant";
    content: string;
  }>;
  newestUtterance: string;
}

export interface PersonaContext {
  stablePrefix: string;
  sessionRules: string;
  rollingSummary: string;
  recentMessages: PersonaConversationMessage[];
  messages: PersonaContextMessage[];
  systemPrompt: string;
  userPrompt: string;
  rollingSummaryEstimatedTokens: number;
  cacheablePrefixEstimatedTokens: number;
  totalEstimatedTokens: number;
}

export class ContextBudgetError extends Error {
  constructor(
    message: string,
    readonly estimatedTokens: number,
    readonly limit: number = MAX_CONTEXT_TOKENS,
  ) {
    super(message);
    this.name = "ContextBudgetError";
  }
}

/** Conservative deterministic estimate shared by context budgeting and metrics. */
export function estimateInputTokens(
  messages: ReadonlyArray<{
    content: string;
    role?: PersonaContextRole;
  }>,
): number {
  const characterCount = messages.reduce(
    (total, message) => total + message.content.length,
    0,
  );
  return Math.ceil(characterCount / 3.5);
}

export function buildPersonaContext(
  input: BuildPersonaContextInput,
): PersonaContext {
  let rollingSummary = truncateSummaryToEstimatedTokens(
    input.rollingSummary,
    MAX_ROLLING_SUMMARY_TOKENS,
  );
  let recentMessages = selectRecentMessages(
    input.history,
    input.newestUtterance,
  );
  const deterministicState = serializeDeterministicState(
    input.deterministicState,
  );

  const immutableContext = assembleContext(
    input,
    deterministicState,
    "",
    recentMessages.slice(-1),
  );
  if (immutableContext.totalEstimatedTokens > MAX_CONTEXT_TOKENS) {
    throw new ContextBudgetError(
      "Immutable persona instructions and newest utterance exceed the context budget",
      immutableContext.totalEstimatedTokens,
    );
  }

  let context = assembleContext(
    input,
    deterministicState,
    rollingSummary,
    recentMessages,
  );

  while (
    context.totalEstimatedTokens > MAX_CONTEXT_TOKENS &&
    recentMessages.length > 1
  ) {
    const removableHistoryCount = recentMessages.length - 1;
    const removeCount = Math.min(2, removableHistoryCount);
    recentMessages = recentMessages.slice(removeCount);
    context = assembleContext(
      input,
      deterministicState,
      rollingSummary,
      recentMessages,
    );
  }

  if (context.totalEstimatedTokens > MAX_CONTEXT_TOKENS) {
    rollingSummary = longestSummaryWithinBudget(
      input,
      deterministicState,
      rollingSummary,
      recentMessages,
    );
    context = assembleContext(
      input,
      deterministicState,
      rollingSummary,
      recentMessages,
    );
  }

  if (context.totalEstimatedTokens > MAX_CONTEXT_TOKENS) {
    throw new ContextBudgetError(
      "Persona context exceeds the context budget",
      context.totalEstimatedTokens,
    );
  }

  return context;
}

function selectRecentMessages(
  history: BuildPersonaContextInput["history"],
  newestUtterance: string,
): PersonaConversationMessage[] {
  const finalIndex = history.length - 1;
  const finalIsNewest =
    finalIndex >= 0 &&
    history[finalIndex].role === "user" &&
    history[finalIndex].content === newestUtterance;
  const withNewest = finalIsNewest
    ? [...history]
    : [
        ...history,
        { role: "user" as const, content: newestUtterance },
      ];

  return withNewest.slice(-MAX_RECENT_MESSAGES);
}

function assembleContext(
  input: BuildPersonaContextInput,
  deterministicState: string,
  rollingSummary: string,
  recentMessages: PersonaConversationMessage[],
): PersonaContext {
  const systemPrompt = input.stablePrefix;
  const userPrompt = renderDynamicPrompt(
    input.sessionRules,
    rollingSummary,
    deterministicState,
    recentMessages,
  );
  const messages: PersonaContextMessage[] = [
    {
      role: "system",
      content: systemPrompt,
      section: "stable-prefix",
    },
    {
      role: "user",
      content: userPrompt,
      section: "dynamic-context",
    },
  ];
  const cacheablePrefixEstimatedTokens = estimateInputTokens([
    { content: systemPrompt },
  ]);
  const totalEstimatedTokens = estimateInputTokens(messages);

  return {
    stablePrefix: input.stablePrefix,
    sessionRules: input.sessionRules,
    rollingSummary,
    recentMessages,
    messages,
    systemPrompt,
    userPrompt,
    rollingSummaryEstimatedTokens: estimateInputTokens([
      { content: rollingSummary },
    ]),
    cacheablePrefixEstimatedTokens,
    totalEstimatedTokens,
  };
}

function renderDynamicPrompt(
  sessionRules: string,
  rollingSummary: string,
  deterministicState: string,
  recentMessages: PersonaConversationMessage[],
): string {
  const sections = [`# SESSION RULES\n${sessionRules}`];

  if (rollingSummary.length > 0) {
    sections.push(`# ROLLING SUMMARY\n${rollingSummary}`);
  }

  sections.push(`# DETERMINISTIC STATE\n${deterministicState}`);
  sections.push(
    `# RECENT CONVERSATION\n${recentMessages
      .map(
        (message) =>
          `${message.role === "user" ? "User" : "Panelist"}: ${message.content}`,
      )
      .join("\n")}`,
  );
  sections.push(
    "Respond with your JSON object. 1-2 sentences max. Strict JSON only.",
  );

  return sections.join("\n\n");
}

function truncateSummaryToEstimatedTokens(
  value: string,
  maxTokens: number,
): string {
  const maxCharacters = Math.floor(maxTokens * 3.5);
  return truncateSummaryToCharacters(value, maxCharacters);
}

function truncateSummaryToCharacters(
  value: string,
  maxCharacters: number,
): string {
  const normalized = value.trim();
  if (normalized.length <= maxCharacters) return normalized;
  if (maxCharacters < SUMMARY_OMISSION_MARKER.length) return "";

  const source = normalized.endsWith(SUMMARY_OMISSION_MARKER)
    ? normalized
        .slice(0, -SUMMARY_OMISSION_MARKER.length)
        .trimEnd()
    : normalized;
  const contentLimit =
    maxCharacters - SUMMARY_OMISSION_MARKER.length - 1;
  let boundary = 0;

  for (let index = Math.min(contentLimit, source.length); index > 0; index--) {
    const previous = source[index - 1];
    const next = source[index];
    if (previous === "\n") {
      boundary = index - 1;
      break;
    }
    if (
      (previous === "." || previous === "!" || previous === "?") &&
      (next === undefined || /\s/.test(next))
    ) {
      boundary = index;
      break;
    }
  }

  if (boundary === 0) return SUMMARY_OMISSION_MARKER;
  return `${source.slice(0, boundary).trimEnd()} ${SUMMARY_OMISSION_MARKER}`;
}

function longestSummaryWithinBudget(
  input: BuildPersonaContextInput,
  deterministicState: string,
  summary: string,
  recentMessages: PersonaConversationMessage[],
): string {
  let low = 0;
  let high = summary.length;

  while (low < high) {
    const midpoint = Math.ceil((low + high) / 2);
    const candidate = truncateSummaryToCharacters(summary, midpoint);
    const context = assembleContext(
      input,
      deterministicState,
      candidate,
      recentMessages,
    );
    if (context.totalEstimatedTokens <= MAX_CONTEXT_TOKENS) {
      low = midpoint;
    } else {
      high = midpoint - 1;
    }
  }

  return truncateSummaryToCharacters(summary, low);
}

function serializeDeterministicState(
  state: Readonly<Record<string, unknown>>,
): string {
  return JSON.stringify(sortJsonValue(state));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJsonValue(child)]),
  );
}
