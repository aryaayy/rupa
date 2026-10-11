import { describe, expect, it } from "vitest";
import { applyMapping, MappingError } from "../src/index.js";
import { socialSchema, swordContext, swordSocialMapping } from "./fixtures.js";

function mutate(seed: number): unknown {
  const choices = [
    null,
    1,
    "x",
    [],
    { ...swordSocialMapping, rules: [] },
    { ...swordSocialMapping, rupa: "mapping/v0" },
    { ...swordSocialMapping, targetSchemaVersion: Number.MAX_SAFE_INTEGER + 1 },
    { ...swordSocialMapping, rules: [{ target: "kind", from: `attrs.${"a.".repeat(seed % 9)}x` }] },
    { ...swordSocialMapping, rules: [{ target: "title", template: "{{attrs.name}} {{missing.path}}" }] },
    { extra: true, ...swordSocialMapping },
  ];
  return choices[seed % choices.length];
}

describe("T-DSL-03 fail-closed on arbitrary input", () => {
  it("never executes code and always returns a schema-valid view or a typed error", () => {
    for (let seed = 0; seed < 64; seed += 1) {
      try {
        const output = applyMapping(mutate(seed), swordContext({ rarity: seed % 5 }), { targetSchema: socialSchema });
        expect(output).toEqual(expect.objectContaining({
          kind: "profile_frame",
          color: expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
          title: expect.any(String),
          tier: expect.stringMatching(/^(bronze|silver|steel|gold|legend)$/),
        }));
      } catch (error) {
        expect(error).toBeInstanceOf(MappingError);
      }
    }
  });
});
