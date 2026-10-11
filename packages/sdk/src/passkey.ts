import { bytesToHex, concat, hexToBytes, keccak256, sha256, toBytes } from "viem";
import type { Address, Hex } from "viem";
import { RupaError } from "./errors.js";

export const P256_ORDER = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const FIELD = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const CURVE_B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;
const textEncoder = new TextEncoder();
// Preserve a BOM so unsupported signed bytes fail validation instead of being silently removed.
const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

export interface PasskeyAssertion {
  authenticatorData: Hex;
  clientDataJSON: string;
  challengeIndex: bigint;
  typeIndex: bigint;
  r: bigint;
  s: bigint;
}

export interface RegisteredPasskey {
  credentialId: Uint8Array<ArrayBuffer>;
  credIdHash: Hex;
  qx: bigint;
  qy: bigint;
}

function invalid(message: string): never {
  throw new RupaError("INVALID_ASSERTION", message);
}

export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Strict ASN.1 DER ECDSA parser: positive, minimal integers, no trailing data. */
export function decodeDerSignature(signature: Uint8Array): { r: bigint; s: bigint } {
  if (signature.length < 8 || signature.length > 72 || signature[0] !== 0x30 || signature[1] !== signature.length - 2) {
    invalid("Malformed DER signature sequence.");
  }
  let offset = 2;
  const readInteger = (): bigint => {
    if (signature[offset++] !== 0x02) invalid("Expected a DER integer.");
    const length = signature[offset++];
    if (length === undefined || length < 1 || length > 33 || offset + length > signature.length) invalid("Invalid DER integer length.");
    const bytes = signature.subarray(offset, offset + length);
    offset += length;
    if ((bytes[0]! & 0x80) !== 0 || (length > 1 && bytes[0] === 0 && (bytes[1]! & 0x80) === 0)) {
      invalid("Non-minimal or negative DER integer.");
    }
    const value = BigInt(bytesToHex(bytes));
    if (value === 0n || value >= P256_ORDER) invalid("P256 signature scalar out of range.");
    return value;
  };
  const r = readInteger();
  const s = readInteger();
  if (offset !== signature.length) invalid("Unexpected trailing DER data.");
  return { r, s: s > P256_ORDER / 2n ? P256_ORDER - s : s };
}

/** Matches the deliberately narrow serialization accepted by WebAuthnLib. */
export function validateClientData(bytes: Uint8Array, challenge: Hex, origin: string): string {
  if (hexToBytes(challenge).length !== 32 || bytes.length > 1024) invalid("Invalid challenge or client data size.");
  let client: string;
  try { client = textDecoder.decode(bytes); } catch { invalid("Invalid UTF-8 client data."); }
  const fields = { type: "webauthn.get", challenge: base64url(hexToBytes(challenge)), origin };
  if (client !== JSON.stringify(fields) && client !== JSON.stringify({ ...fields, crossOrigin: false })) {
    throw new RupaError("UNSUPPORTED_CLIENT_DATA", "Client data does not match the expected challenge, origin, and supported browser serialization.");
  }
  return client;
}

export function assertionFromResponse(
  response: Pick<AuthenticatorAssertionResponse, "authenticatorData" | "clientDataJSON" | "signature">,
  expected: { challenge: Hex; rpId: string; origin: string },
): PasskeyAssertion {
  const auth = new Uint8Array(response.authenticatorData);
  if (auth.length < 37 || auth.length > 1024) invalid("Invalid authenticator data length.");
  if (bytesToHex(auth.subarray(0, 32)) !== sha256(toBytes(expected.rpId))) invalid("RP ID does not match.");
  const flags = auth[32]!;
  if ((flags & 5) !== 5 || ((flags & 0x10) !== 0 && (flags & 8) === 0)) invalid("User presence and verification are required; backup flags must be consistent.");
  const clientDataJSON = validateClientData(new Uint8Array(response.clientDataJSON), expected.challenge, expected.origin);
  return {
    authenticatorData: bytesToHex(auth), clientDataJSON, challengeIndex: 23n, typeIndex: 1n,
    ...decodeDerSignature(new Uint8Array(response.signature)),
  };
}

export function assertionDigest(assertion: Pick<PasskeyAssertion, "authenticatorData" | "clientDataJSON">): Hex {
  return sha256(concat([assertion.authenticatorData, sha256(textEncoder.encode(assertion.clientDataJSON))]));
}

/** Decodes the ES256 EC2 public-key map from attested authenticator data. */
export function decodeRegistrationAuthData(auth: Uint8Array, rpId: string): RegisteredPasskey {
  const fail = (): never => { throw new RupaError("INVALID_PUBLIC_KEY", "Expected a bounded ES256/P256 attested credential."); };
  if (auth.length < 55 || auth.length > 2048 || bytesToHex(auth.subarray(0, 32)) !== sha256(toBytes(rpId))) fail();
  const flags = auth[32]!;
  if ((flags & 0x45) !== 0x45 || ((flags & 0x10) !== 0 && (flags & 8) === 0)) fail();
  const credLength = (auth[53]! << 8) | auth[54]!;
  if (credLength === 0 || credLength > 1024 || 55 + credLength >= auth.length) fail();
  const credentialId = Uint8Array.from(auth.subarray(55, 55 + credLength));
  let offset = 55 + credLength;
  const head = (): [number, number] => {
    if (offset >= auth.length) fail();
    const byte = auth[offset++]!;
    const major = byte >> 5;
    const additional = byte & 31;
    if (additional < 24) return [major, additional];
    if (additional === 24 && offset < auth.length) return [major, auth[offset++]!];
    return fail();
  };
  const [major, count] = head();
  if (major !== 5 || count !== 5) fail();
  const values = new Map<number, number | Uint8Array>();
  for (let i = 0; i < count; i++) {
    const [keyType, keyValue] = head();
    if (keyType !== 0 && keyType !== 1) fail();
    const key = keyType === 1 ? -1 - keyValue : keyValue;
    if (![1, 3, -1, -2, -3].includes(key) || values.has(key)) fail();
    const [type, length] = head();
    if (type === 0 || type === 1) values.set(key, type === 1 ? -1 - length : length);
    else if (type === 2 && length === 32 && offset + length <= auth.length) {
      values.set(key, auth.subarray(offset, offset + length));
      offset += length;
    } else fail();
  }
  // Extensions are not requested by the capture flow; do not ignore an unparsed suffix.
  if (offset !== auth.length || (flags & 0x80) !== 0 || values.get(1) !== 2 || values.get(3) !== -7 || values.get(-1) !== 1) fail();
  const x = values.get(-2);
  const y = values.get(-3);
  if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array)) return fail();
  const qx = BigInt(bytesToHex(x));
  const qy = BigInt(bytesToHex(y));
  const rhs = (((qx * qx % FIELD) * qx - 3n * qx + CURVE_B) % FIELD + FIELD) % FIELD;
  if (qx >= FIELD || qy >= FIELD || qy * qy % FIELD !== rhs) fail();
  return { credentialId, credIdHash: keccak256(credentialId), qx, qy };
}

function browserCredentials(): CredentialsContainer {
  if (!globalThis.isSecureContext || typeof navigator === "undefined" || !navigator.credentials) {
    throw new RupaError("PASSKEY_UNAVAILABLE", "Passkeys require a supported browser and secure origin.");
  }
  return navigator.credentials;
}

function browserError(cause: unknown): never {
  if (cause instanceof RupaError) throw cause;
  if (cause instanceof DOMException && ["NotAllowedError", "AbortError"].includes(cause.name)) {
    throw new RupaError("PASSKEY_CANCELLED", "The passkey request was cancelled or timed out.", { cause });
  }
  throw new RupaError("PASSKEY_UNAVAILABLE", "The browser could not complete the passkey request.", { cause });
}

/** Creates a browser credential only. Register returned coordinates through the owner's wallet separately. */
export async function createPasskey({ rpId, owner }: { rpId: string; owner: Address }): Promise<RegisteredPasskey> {
  try {
    const credential = await browserCredentials().create({ publicKey: {
      rp: { id: rpId, name: "Rupa" },
      user: { id: Uint8Array.from(hexToBytes(owner)), name: owner, displayName: "Rupa asset owner" },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      attestation: "none", timeout: 60_000,
    } }) as PublicKeyCredential | null;
    if (!credential) throw new RupaError("PASSKEY_CANCELLED", "No credential was created.");
    const response = credential.response as AuthenticatorAttestationResponse;
    if (typeof response.getAuthenticatorData !== "function") {
      throw new RupaError("PASSKEY_UNAVAILABLE", "This browser does not expose registration authenticator data.");
    }
    const result = decodeRegistrationAuthData(new Uint8Array(response.getAuthenticatorData()), rpId);
    if (bytesToHex(result.credentialId) !== bytesToHex(new Uint8Array(credential.rawId))) invalid("Credential ID mismatch.");
    return result;
  } catch (cause) { browserError(cause); }
}

export async function requestAssertion(input: {
  challenge: Hex; rpId: string; origin: string; credentialId: Uint8Array;
}): Promise<PasskeyAssertion> {
  if (hexToBytes(input.challenge).length !== 32 || input.credentialId.length === 0) invalid("Invalid challenge or credential ID.");
  try {
    const credential = await browserCredentials().get({ publicKey: {
      challenge: Uint8Array.from(hexToBytes(input.challenge)), rpId: input.rpId,
      allowCredentials: [{ type: "public-key", id: Uint8Array.from(input.credentialId) }],
      userVerification: "required", timeout: 60_000,
    } }) as PublicKeyCredential | null;
    if (!credential) throw new RupaError("PASSKEY_CANCELLED", "No assertion was returned.");
    if (bytesToHex(new Uint8Array(credential.rawId)) !== bytesToHex(input.credentialId)) invalid("Unexpected credential ID.");
    return assertionFromResponse(credential.response as AuthenticatorAssertionResponse, input);
  } catch (cause) { browserError(cause); }
}
