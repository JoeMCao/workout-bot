/** Typed failure for WHOOP sync; safe for API mapping (never includes tokens). */
export class WhoopSyncError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details: unknown;

  constructor(code: string, message: string, httpStatus: number, details?: unknown) {
    super(message);
    this.name = "WhoopSyncError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
