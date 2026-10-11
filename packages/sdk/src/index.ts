export { RupaError } from "./errors.js";
export type { RupaErrorCode } from "./errors.js";
export { approvalHash, approvalChallenge } from "./approval.js";
export type { PortApproval } from "./approval.js";
export {
  assertionDigest, assertionFromResponse, base64url, createPasskey,
  decodeDerSignature, decodeRegistrationAuthData, requestAssertion,
  validateClientData, P256_ORDER,
} from "./passkey.js";
export type { PasskeyAssertion, RegisteredPasskey } from "./passkey.js";
export { hashPortRecord, verifyProvenance } from "./provenance.js";
export type { PortRecord } from "./provenance.js";
