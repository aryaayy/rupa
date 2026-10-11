import { generateKeyPairSync, sign, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bytesToHex, hexToBytes, sha256, toBytes } from "viem";
import type { Hex } from "viem";
import {
  approvalHash, assertionFromResponse, base64url, decodeDerSignature,
  decodeRegistrationAuthData, P256_ORDER, validateClientData,
} from "../src/index.js";

const challenge = `0x${"ab".repeat(32)}` as Hex;
const origin = "http://localhost:5173";
const client = JSON.stringify({ type: "webauthn.get", challenge: base64url(hexToBytes(challenge)), origin, crossOrigin: false });
const auth = new Uint8Array([...hexToBytes(sha256(toBytes("localhost"))), 5, 0, 0, 0, 0]);

describe("approval binding", () => {
  const input = {
    chainId: 10143n, ledger: "0x2222222222222222222222222222222222222222" as const,
    owner: "0x1111111111111111111111111111111111111111" as const,
    assetId: 42n, targetAppId: 2, mappingId: challenge, nonce: 0n, deadline: 2000n,
  };
  it("binds every domain and port field", () => {
    const initial = approvalHash(input);
    for (const variation of [
      { chainId: 1n }, { ledger: input.owner }, { owner: input.ledger },
      { assetId: 43n }, { targetAppId: 3 }, { mappingId: `0x${"cd".repeat(32)}` as Hex },
      { nonce: 1n }, { deadline: 2001n },
    ]) expect(approvalHash({ ...input, ...variation })).not.toBe(initial);
    expect(() => approvalHash({ ...input, targetAppId: -1 })).toThrow();
    expect(() => approvalHash({ ...input, deadline: 1n << 64n })).toThrow();
  });
});

describe("DER and client data", () => {
  it("normalizes real OpenSSL P256 signatures without invalidating them", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    for (let i = 0; i < 20; i++) {
      const message = Buffer.from(`Rupa ${i}`);
      const der = sign("sha256", message, privateKey);
      const { r, s } = decodeDerSignature(der);
      expect(s).toBeLessThanOrEqual(P256_ORDER / 2n);
      const compact = Buffer.from(r.toString(16).padStart(64, "0") + s.toString(16).padStart(64, "0"), "hex");
      expect(verify("sha256", message, { key: publicKey, dsaEncoding: "ieee-p1363" }, compact)).toBe(true);
    }
  });

  it.each([
    "", "3006020100020101", "3006020180020101", "300702020001020101",
    "308106020101020101", "300602010102010100", "3006020101030101",
  ])("rejects malformed DER %s", (hex) => {
    expect(() => decodeDerSignature(Buffer.from(hex, "hex"))).toThrow();
  });

  it("accepts exact client data and rejects nested, duplicate, and cross-origin fields", () => {
    expect(validateClientData(toBytes(client), challenge, origin)).toBe(client);
    const unsupported = [
      client.replace("webauthn.get", "webauthn.create"),
      client.replace('"crossOrigin":false', '"crossOrigin":true'),
      client.replace('{"type"', '{"nested":{"type"') + "}",
      client.replace('"type":', '"type":"webauthn.create","type":'),
      client.replace("localhost", "evil.test"),
      client.replace('{"type"', '{ "type"'),
      "\uFEFF" + client,
    ];
    for (const value of unsupported) expect(() => validateClientData(toBytes(value), challenge, origin)).toThrow();
  });

  it("accepts Chromium extra keys after crossOrigin:false and rejects them elsewhere", () => {
    const extra = client.slice(0, -1) + ',"other_keys_can_be_added_here":"do not compare clientDataJSON against a template. See https://goo.gl/yabPex"}';
    expect(validateClientData(toBytes(extra), challenge, origin)).toBe(extra);
    const noCrossOrigin = client.replace(',"crossOrigin":false}', ',"other_keys_can_be_added_here":"x"}');
    const crossTrue = client.replace('"crossOrigin":false}', '"crossOrigin":true,"extra":"x"}');
    const noClose = client.slice(0, -1) + ',"extra":"x"';
    const emptyExtra = client.slice(0, -1) + ",}";
    for (const value of [noCrossOrigin, crossTrue, noClose, emptyExtra]) expect(() => validateClientData(toBytes(value), challenge, origin)).toThrow();
  });

  it("checks RP, UP/UV and returns Solidity-compatible fields", () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const der = sign("sha256", Buffer.from("test"), privateKey);
    const response = {
      authenticatorData: auth.buffer,
      clientDataJSON: Uint8Array.from(toBytes(client)).buffer,
      signature: Uint8Array.from(der).buffer,
    };
    const result = assertionFromResponse(response, { challenge, rpId: "localhost", origin });
    expect(result.challengeIndex).toBe(23n);
    expect(result.authenticatorData).toBe(bytesToHex(auth));
    for (const flags of [0, 1, 4, 0x15]) {
      const changed = Uint8Array.from(auth);
      changed[32] = flags;
      expect(() => assertionFromResponse({ ...response, authenticatorData: changed.buffer }, { challenge, rpId: "localhost", origin })).toThrow();
    }
    expect(() => assertionFromResponse(response, { challenge, rpId: "other.test", origin })).toThrow();
  });
});

describe("COSE registration", () => {
  function registration() {
    const { publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const jwk = publicKey.export({ format: "jwk" });
    const x = Buffer.from(jwk.x!, "base64url");
    const y = Buffer.from(jwk.y!, "base64url");
    const cred = Buffer.from("test-credential");
    const cose = Buffer.concat([Buffer.from([0xa5, 1, 2, 3, 0x26, 0x20, 1, 0x21, 0x58, 32]), x, Buffer.from([0x22, 0x58, 32]), y]);
    const data = Buffer.concat([Buffer.from(auth.subarray(0, 32)), Buffer.from([0x45, 0, 0, 0, 0]), Buffer.alloc(16), Buffer.from([0, cred.length]), cred, cose]);
    return { data, x, y, cred };
  }
  it("extracts the bound credential and P256 point", () => {
    const { data, x, y, cred } = registration();
    const result = decodeRegistrationAuthData(data, "localhost");
    expect(result.qx).toBe(BigInt(bytesToHex(x)));
    expect(result.qy).toBe(BigInt(bytesToHex(y)));
    expect(Buffer.from(result.credentialId)).toEqual(cred);
  });
  it("rejects truncated, wrong-RP, trailing, and non-curve data", () => {
    const { data } = registration();
    expect(() => decodeRegistrationAuthData(data, "evil.test")).toThrow();
    expect(() => decodeRegistrationAuthData(data.subarray(0, 60), "localhost")).toThrow();
    expect(() => decodeRegistrationAuthData(Buffer.concat([data, Buffer.from([0])]), "localhost")).toThrow();
    data.fill(0, data.length - 32);
    expect(() => decodeRegistrationAuthData(data, "localhost")).toThrow();
  });
});
