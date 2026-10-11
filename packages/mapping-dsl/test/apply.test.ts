import { describe, expect, it } from "vitest";
import { applyMapping, MappingError, parseMapping } from "../src/index.js";
import { socialSchema, swordContext, swordSocialMapping } from "./fixtures.js";

function expectCode(code: string, run: () => unknown): void {
  expect(run).toThrowError(MappingError);
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(MappingError);
    expect((error as MappingError).code).toBe(code);
  }
}

describe("T-DSL-01 operators and paths", () => {
  it("applies const, from, map, template, and default", () => {
    expect(applyMapping(swordSocialMapping, swordContext(), { targetSchema: socialSchema })).toEqual({
      kind: "profile_frame",
      color: "#FF5A1F",
      title: "Fire Sword — 7 wins",
      tier: "gold",
    });
    expect(applyMapping(swordSocialMapping, swordContext({ element: "ice" }), { targetSchema: socialSchema }).color).toBe("#4FC3F7");
    expect(applyMapping(swordSocialMapping, swordContext({ element: "wind" }), { targetSchema: socialSchema }).color).toBe("#999999");
    expect(applyMapping(swordSocialMapping, swordContext({ name: "炎の剣", wins: 0 }), { targetSchema: socialSchema }).title)
      .toBe("炎の剣 — 0 wins");
  });

  it("rejects duplicate, unsafe, and unknown rule fields", () => {
    expectCode("DUPLICATE_TARGET", () => parseMapping({
      ...swordSocialMapping,
      rules: [{ target: "kind", const: "a" }, { target: "kind", const: "b" }],
    }));
    expectCode("INVALID_SOURCE_PATH", () => parseMapping({
      ...swordSocialMapping,
      rules: [{ target: "kind", from: "attrs.__proto__" }],
    }));
    expectCode("INVALID_SOURCE_PATH", () => parseMapping({
      ...swordSocialMapping,
      rules: [{ target: "kind", from: "wallet.address" }],
    }));
    expectCode("UNKNOWN_OPERATOR", () => parseMapping({
      ...swordSocialMapping,
      rules: [{ target: "kind", eval: "1+1" }],
    }));
    expectCode("MISSING_SOURCE", () => applyMapping({
      ...swordSocialMapping,
      rules: [
        { target: "kind", const: "profile_frame" },
        { target: "color", from: "attrs.missing" },
        { target: "title", const: "x" },
        { target: "tier", const: "gold" },
      ],
    }, swordContext(), { targetSchema: socialSchema }));
  });
});
