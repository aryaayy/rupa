import { describe, expect, it } from "vitest";
import { applyMapping, MappingError, parseMapping } from "../src/index.js";
import { LIMITS } from "../src/limits.js";
import { socialSchema, swordContext, swordSocialMapping } from "./fixtures.js";

function expectCode(code: string, run: () => unknown): void {
  try {
    run();
    throw new Error(`expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(MappingError);
    expect((error as MappingError).code).toBe(code);
  }
}

describe("T-DSL-02 invariants and caps", () => {
  it("rejects rarity outside 0-4 and unknown or inflated tiers", () => {
    expectCode("INVARIANT_VIOLATION", () => applyMapping(swordSocialMapping, swordContext({ rarity: 5 }), { targetSchema: socialSchema }));
    const inflated = {
      ...swordSocialMapping,
      rules: swordSocialMapping.rules.map((rule) => rule.target === "tier" ? { target: "tier", const: "legend" } : rule),
    };
    expectCode("INVARIANT_VIOLATION", () => applyMapping(inflated, swordContext({ rarity: 1 }), { targetSchema: socialSchema }));
    const unknownTier = {
      ...swordSocialMapping,
      rules: swordSocialMapping.rules.map((rule) => rule.target === "tier" ? { target: "tier", const: "mythic" } : rule),
    };
    expectCode("INVARIANT_VIOLATION", () => applyMapping(unknownTier, swordContext(), { targetSchema: socialSchema }));
  });

  it("rejects smuggled URLs and oversized payloads", () => {
    const withUrl = {
      ...swordSocialMapping,
      rules: swordSocialMapping.rules.map((rule) => rule.target === "title" ? { target: "title", const: "see https://evil.example" } : rule),
    };
    expectCode("INVARIANT_VIOLATION", () => applyMapping(withUrl, swordContext(), { targetSchema: socialSchema }));
    expectCode("LIMIT_EXCEEDED", () => parseMapping({ ...swordSocialMapping, rationale: "x".repeat(LIMITS.maxRationaleChars + 1) }));
    expectCode("LIMIT_EXCEEDED", () => parseMapping({
      ...swordSocialMapping,
      rules: Array.from({ length: LIMITS.maxRules + 1 }, (_, index) => ({ target: `f${index}`, const: index })),
    }));
    expectCode("SCHEMA_INVALID", () => applyMapping(swordSocialMapping, swordContext(), {
      targetSchema: { $ref: "https://example.com/schema.json" },
    }));
  });
});
