import { describe, expect, it } from "vitest";
import { zeroHash } from "viem";
import { hashPortRecord, verifyProvenance } from "../src/index.js";
import type { PortRecord } from "../src/index.js";

describe("provenance", () => {
  const first: PortRecord = {
    assetId: 42n, fromAppId: 1, toAppId: 2, mappingId: zeroHash,
    agentId: 1n, approver: "0x1111111111111111111111111111111111111111", at: 1000n, prevRecord: zeroHash,
  };
  const a = { ...first, recordId: hashPortRecord(first) };
  const second = { ...first, fromAppId: 2, toAppId: 3, at: 1001n, prevRecord: a.recordId };
  const b = { ...second, recordId: hashPortRecord(second) };

  it("validates the full ordered chain and empty genesis", () => {
    expect(() => verifyProvenance([a, b], b.recordId, 42n)).not.toThrow();
    expect(() => verifyProvenance([], zeroHash, 42n)).not.toThrow();
  });

  it("rejects truncation, reordering, mutation, and another asset", () => {
    for (const records of [[b], [a], [b, a], [{ ...a, approver: "0x2222222222222222222222222222222222222222" as const }, b], [a, { ...b, assetId: 43n }]]) {
      expect(() => verifyProvenance(records, b.recordId, 42n)).toThrow(/Provenance/);
    }
    expect(() => verifyProvenance([], b.recordId, 42n)).toThrow();
    expect(() => verifyProvenance([a, b], b.recordId, 43n)).toThrow();
  });
});
