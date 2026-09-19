export type ErrorCode =
  | "malformed"
  | "not_found"
  | "schema_invalid"
  | "revision_conflict"
  | "rate_limited"
  | "forbidden"
  | "capability_unavailable"
  | "internal";

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "DomainError";
  }
}
