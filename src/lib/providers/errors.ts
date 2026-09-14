import type { GenerationFailureCode, GenerationProvider } from "./types";

/** Only allowlisted metadata crosses the provider boundary. Never attach a cause. */
export class GenerationError extends Error {
  constructor(
    readonly provider: GenerationProvider,
    readonly code: GenerationFailureCode,
    readonly status?: number,
  ) {
    super(`${provider} generation failed (${code}${status ? `, HTTP ${status}` : ""}).`);
    this.name = "GenerationError";
  }
}

export function abortError(): DOMException {
  return new DOMException("Generation cancelled.", "AbortError");
}

export function checkAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
