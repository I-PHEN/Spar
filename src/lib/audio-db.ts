// Spar — IndexedDB audio clip storage (CLIENT-SIDE ONLY)
//
// Stores per-turn audio recordings so users can listen back to their answers
// in the debrief. Keyed by sessionId + messageIndex.
//
// Why IndexedDB (not SQLite/Prisma):
// - Audio is large (~100-200KB per 10s of speech). Base64 in SQLite would
//   bloat the DB fast.
// - The audio is for the user's own review — doesn't need cross-device sync.
// - IndexedDB persists across browser sessions, can be cleared by the user.
// - Keeps the server-side DB lean (only text + telemetry).

const DB_NAME = "spar-audio";
const DB_VERSION = 1;
const STORE_NAME = "clips";

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
  });
  return dbPromise;
}

export interface AudioClip {
  key: string;
  blob: Blob;
  /** ISO timestamp of when the clip was recorded */
  recordedAt: string;
  /** Duration in seconds (approximate) */
  duration: number;
}

/**
 * Save an audio clip to IndexedDB.
 * Key format: `${sessionId}:${messageIndex}`
 */
export async function saveAudioClip(
  key: string,
  blob: Blob,
  durationSec: number
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const clip: AudioClip = {
      key,
      blob,
      recordedAt: new Date().toISOString(),
      duration: durationSec,
    };
    await new Promise<void>((resolve, reject) => {
      const req = store.put(clip);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[audio-db] Failed to save clip:", err);
    // Non-fatal — recording is a nice-to-have, not critical
  }
}

/**
 * Get a single audio clip by key.
 */
export async function getAudioClip(key: string): Promise<AudioClip | null> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Get all audio clips for a session.
 * Returns a map of messageIndex → AudioClip.
 */
export async function getSessionClips(
  sessionId: string
): Promise<Map<number, AudioClip>> {
  const result = new Map<number, AudioClip>();
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const all: AudioClip[] = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as AudioClip[]);
      req.onerror = () => reject(req.error);
    });
    for (const clip of all) {
      // key format: "sessionId:messageIndex"
      if (clip.key.startsWith(sessionId + ":")) {
        const idx = parseInt(clip.key.split(":")[1], 10);
        if (!isNaN(idx)) {
          result.set(idx, clip);
        }
      }
    }
  } catch (err) {
    console.error("[audio-db] Failed to get session clips:", err);
  }
  return result;
}

/**
 * Delete all clips for a session (for cleanup).
 */
export async function deleteSessionClips(sessionId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const all: AudioClip[] = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as AudioClip[]);
      req.onerror = () => reject(req.error);
    });
    for (const clip of all) {
      if (clip.key.startsWith(sessionId + ":")) {
        await new Promise<void>((resolve, reject) => {
          const req = store.delete(clip.key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    }
  } catch (err) {
    console.error("[audio-db] Failed to delete session clips:", err);
  }
}

/**
 * Create an object URL from a clip blob (for <audio> playback).
 * Returns null if the blob is empty or unsupported.
 */
export function createClipURL(blob: Blob): string | null {
  if (!blob || blob.size === 0) return null;
  try {
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
