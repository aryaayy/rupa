import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { keccak256, stringToHex } from "viem";
import { applyMapping, canonicalize, hashCanonical, MappingError, parseStrictJson } from "../src/index.js";
import { socialSchema, swordContext, swordSocialMapping } from "./fixtures.js";

describe("T-DSL-04 JCS and content hash", () => {
  it("matches RFC 8785 key order and shared Solidity fixture", () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe("{\"a\":1,\"b\":2}");
    expect(canonicalize({ rupa: "mapping/v1", targetAppId: 2 })).toBe("{\"rupa\":\"mapping/v1\",\"targetAppId\":2}");
    const vector = JSON.parse(readFileSync(new URL("../../../contracts/test/vectors/dsl-jcs.json", import.meta.url), "utf8")) as {
      canonical: string;
      contentHash: `0x${string}`;
      object: unknown;
    };
    expect(canonicalize(vector.object)).toBe(vector.canonical);
    expect(hashCanonical(vector.object)).toBe(vector.contentHash);
    expect(keccak256(stringToHex(vector.canonical))).toBe(vector.contentHash);
  });

  it("rejects duplicate keys, unsafe integers, BOM, and hash mismatch", () => {
    expect(() => parseStrictJson("{\"a\":1,\"a\":2}")).toThrowError(MappingError);
    expect(() => parseStrictJson("{\"n\":9007199254740993}")).toThrowError(MappingError);
    expect(() => parseStrictJson("\uFEFF{\"a\":1}")).toThrowError(MappingError);
    expect(() => applyMapping(swordSocialMapping, swordContext(), {
      targetSchema: socialSchema,
      expectedMappingHash: `0x${"ab".repeat(32)}`,
    })).toThrowError(MappingError);
  });
});
