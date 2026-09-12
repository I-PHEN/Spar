// Spar — shared types

export type ArchetypeKey =
  | "skeptic"
  | "nitpicker"
  | "so_what"
  | "timekeeper"
  | "ally";

export type BehaviorStyle = "gentle" | "moderate" | "aggressive";

export type ScenarioKey =
  | "thesis_defense"
  | "investor_pitch"
  | "board_update"
  | "performance_review"
  | "grant_defense"
  | "client_presentation"
  | "custom";

export type SessionMode = "with_material" | "without_material";

export type SessionStatus =
  | "configured"
  | "active"
  | "ended"
  | "debriefed";

export type MessageType =
  | "normal"
  | "interruption"
  | "coach_whisper"
  | "opening"
  | "system";

export type PersonaMood =
  | "neutral"
  | "listening"
  | "thinking"
  | "speaking"
  | "pressing"
  | "skeptical"
  | "curious"
  | "satisfied"
  | "frustrated";

export interface ExtractedClaim {
  /** 1-indexed claim number for reference */
  id: number;
  /** The claim statement, in the user's words */
  claim: string;
  /** Any evidence the user provided for this claim (may be empty) */
  evidence?: string;
  /** Short label for display */
  label: string;
}

export interface PersonaConfig {
  archetype: ArchetypeKey;
  name: string;
  behaviorStyle: BehaviorStyle;
  seatOrder: number;
}

export interface PersonaResponse {
  personaId: string;
  content: string;
  type: MessageType;
  /** 1-indexed claim reference (which extracted claim this challenges), if any */
  claimRef?: number;
  mood: PersonaMood;
}

export interface TelemetrySnapshot {
  /** Total user messages sent */
  userTurns: number;
  /** Total words across all user messages */
  totalWords: number;
  /** Average words per user response */
  avgWordsPerResponse: number;
  /** Hedge/qualifier count across all user messages */
  hedgeCount: number;
  /** Hedges per user response */
  hedgesPerResponse: number;
  /** Average latency (ms) between persona's last message and user's next */
  avgResponseMs: number;
  /** Number of times user answered a direct question with a question */
  deflections: number;
  /** Number of times user cited a number or specific data point */
  evidenceCitations: number;
  /** Array of per-turn metrics, for charting later */
  turns: TurnTelemetry[];
}

export interface TurnTelemetry {
  turnIndex: number;
  wordCount: number;
  hedgeCount: number;
  responseMs: number;
  answeredDirectly: boolean;
  citedEvidence: boolean;
}

export interface DebriefPayload {
  momentDescription: string;
  whatWentWell: string[]; // 2-3 observations
  thePattern: string;
  oneThingToPractice: string;
  telemetryInsights: {
    pace: string;
    fillers: string;
    recovery: string;
    evidence: string;
  };
  shareableSummary: string;
}

export interface SessionWithRelations {
  id: string;
  scenario: string;
  mode: string;
  rawMaterial: string | null;
  materialTitle: string | null;
  extractedClaims: string | null;
  status: string;
  startedAt: Date | null;
  endedAt: Date | null;
  telemetry: string | null;
  personas: Array<{
    id: string;
    archetype: string;
    name: string;
    behaviorStyle: string;
    seatOrder: number;
  }>;
  messages: Array<{
    id: string;
    role: string;
    personaId: string | null;
    content: string;
    type: string;
    claimRef: number | null;
    createdAt: Date;
  }>;
  summary: {
    momentDescription: string;
    whatWentWell: string;
    thePattern: string;
    oneThingToPractice: string;
    telemetryInsights: string;
    shareableSummary: string;
  } | null;
}
