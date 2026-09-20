// Spar — In-memory session cache
//
// Caches the persona system prompt + session data after the first spar-stream
// call. Subsequent calls within the same session skip the DB query and prompt
// building entirely (~2s saved).
//
// This is a simple Map — not Redis. It's process-local and resets on restart.
// For a single-server deployment, this is fine. For multi-server, upgrade to Redis.

interface CachedSession {
  systemPrompt: string;
  personaIds: string[];
  personaMap: Map<string, {
    id: string;
    archetype: string;
    name: string;
    behaviorStyle: string;
    seatOrder: number;
  }>;
  claims: Array<{ id: number; label: string; claim: string; evidence?: string }>;
  scenarioLabel: string;
  roomContext: string;
  experience: string;
  drillTarget: string | null;
  coachingEnabled: boolean;
  lastUsed: number;
}

const sessionCache = new Map<string, CachedSession>();

// Max 50 sessions cached (LRU-ish — we just clear oldest when full)
const MAX_CACHE_SIZE = 50;

export function getCachedSession(sessionId: string): CachedSession | undefined {
  const cached = sessionCache.get(sessionId);
  if (cached) {
    cached.lastUsed = Date.now();
  }
  return cached;
}

export function setCachedSession(sessionId: string, data: Omit<CachedSession, "lastUsed">) {
  // Evict oldest if cache is full
  if (sessionCache.size >= MAX_CACHE_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, val] of sessionCache.entries()) {
      if (val.lastUsed < oldestTime) {
        oldestTime = val.lastUsed;
        oldestKey = key;
      }
    }
    if (oldestKey) sessionCache.delete(oldestKey);
  }

  sessionCache.set(sessionId, {
    ...data,
    lastUsed: Date.now(),
  });
}

export function invalidateSession(sessionId: string) {
  sessionCache.delete(sessionId);
}

// ─── System prompt cache ────────────────────────────────────────────────
// Separately cache the system prompt since it doesn't change during a session.
// The persona system prompt is ~2000 tokens — building it takes string
// concatenation + pattern memory formatting. Caching saves ~100ms per call.

const promptCache = new Map<string, string>();

export function getCachedPrompt(sessionId: string, personaId: string): string | undefined {
  return promptCache.get(`${sessionId}:${personaId}`);
}

export function setCachedPrompt(sessionId: string, personaId: string, prompt: string) {
  promptCache.set(`${sessionId}:${personaId}`, prompt);
}

export function clearPromptCache(sessionId: string) {
  for (const key of promptCache.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      promptCache.delete(key);
    }
  }
}

// ─── In-flight live turns ─────────────────────────────────────────────
// Partial text is deliberately separate from the persisted transcript cache.
// A cancelled/failed turn is abandoned; only the service's successful
// persistence boundary removes a finalized buffer.
interface LiveTurnBuffer {
  sessionId: string;
  turnId: string;
  text: string;
}

const liveTurnBuffers = new Map<string, LiveTurnBuffer>();

function liveTurnKey(sessionId: string, turnId: string): string {
  return `${sessionId}:${turnId}`;
}

export function beginLiveTurnBuffer(sessionId: string, turnId: string): void {
  liveTurnBuffers.set(liveTurnKey(sessionId, turnId), { sessionId, turnId, text: "" });
}

export function appendLiveTurnBuffer(sessionId: string, turnId: string, delta: string): void {
  const buffer = liveTurnBuffers.get(liveTurnKey(sessionId, turnId));
  if (buffer) buffer.text += delta;
}

export function resetLiveTurnBuffer(sessionId: string, turnId: string): void {
  const buffer = liveTurnBuffers.get(liveTurnKey(sessionId, turnId));
  if (buffer) buffer.text = "";
}

export function finalizeLiveTurnBuffer(sessionId: string, turnId: string): string | null {
  const key = liveTurnKey(sessionId, turnId);
  const buffer = liveTurnBuffers.get(key);
  liveTurnBuffers.delete(key);
  return buffer?.text ?? null;
}

export function abandonLiveTurnBuffer(sessionId: string, turnId: string): void {
  liveTurnBuffers.delete(liveTurnKey(sessionId, turnId));
}
