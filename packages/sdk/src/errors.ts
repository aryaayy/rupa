export type RupaErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_ASSERTION"
  | "INVALID_PUBLIC_KEY"
  | "PASSKEY_UNAVAILABLE"
  | "PASSKEY_CANCELLED"
  | "UNSUPPORTED_CLIENT_DATA"
  | "PROVENANCE_INVALID"
  | "RPC_ERROR";

export class RupaError extends Error {
  readonly code: RupaErrorCode;

  constructor(code: RupaErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RupaError";
    this.code = code;
  }
}
