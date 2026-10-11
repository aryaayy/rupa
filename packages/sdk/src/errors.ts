export type RupaErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_ASSERTION"
  | "INVALID_PUBLIC_KEY"
  | "PASSKEY_UNAVAILABLE"
  | "PASSKEY_CANCELLED"
  | "UNSUPPORTED_CLIENT_DATA"
  | "PROVENANCE_INVALID"
  | "WRONG_CHAIN" | "WRONG_ORIGIN" | "NO_WALLET" | "NO_PASSKEY" | "NOT_OWNER"
  | "ASSET_NOT_FOUND" | "APP_NOT_FOUND" | "UNSUPPORTED_ASSET" | "MAPPING_REJECTED"
  | "CONTENT_HASH_MISMATCH" | "SCHEMA_OUTDATED" | "NONCE_CHANGED" | "DEADLINE_EXPIRED"
  | "APPROVAL_CANCELLED" | "TX_REVERTED" | "TX_STATUS_UNKNOWN" | "DEPENDENCY_UNAVAILABLE"
  | "RATE_LIMITED" | "INVALID_MAPPING"
  | "RPC_ERROR";

export class RupaError extends Error {
  readonly code: RupaErrorCode;
  readonly txHash: `0x${string}` | undefined;

  constructor(code: RupaErrorCode, message: string, options?: ErrorOptions & { txHash?: `0x${string}` }) {
    super(message, options);
    this.name = "RupaError";
    this.code = code;
    this.txHash = options?.txHash;
  }
}
