export type MappingErrorCode =
  | "INVALID_MAPPING"
  | "UNKNOWN_OPERATOR"
  | "INVALID_SOURCE_PATH"
  | "MISSING_SOURCE"
  | "DUPLICATE_TARGET"
  | "LIMIT_EXCEEDED"
  | "SCHEMA_INVALID"
  | "INVARIANT_VIOLATION"
  | "CONTENT_HASH_MISMATCH";

export class MappingError extends Error {
  readonly code: MappingErrorCode;

  constructor(code: MappingErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MappingError";
    this.code = code;
  }
}

export function fail(code: MappingErrorCode, message: string, cause?: unknown): never {
  if (cause === undefined) throw new MappingError(code, message);
  throw new MappingError(code, message, { cause });
}
