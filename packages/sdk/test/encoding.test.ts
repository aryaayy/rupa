import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { hexToBytes } from "viem";
import { approvalHash, base64url, hashPortRecord } from "../src/index.js";

it("preserves the shared Solidity/TypeScript encoding vector", () => {
  const vector = JSON.parse(readFileSync(new URL("../../../contracts/test/vectors/protocol.json", import.meta.url), "utf8"));
  const input = { ...vector.approval };
  for (const key of ["chainId", "assetId", "nonce", "deadline"]) input[key] = BigInt(input[key]);
  expect(approvalHash(input)).toBe(vector.approvalHash);
  expect(base64url(hexToBytes(vector.approvalHash))).toBe(vector.challenge);
  const record = { ...vector.record };
  for (const key of ["assetId", "agentId", "at"]) record[key] = BigInt(record[key]);
  expect(hashPortRecord(record)).toBe(vector.recordId);
});
