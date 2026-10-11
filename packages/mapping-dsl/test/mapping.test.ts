import { describe, expect, it } from "vitest";
import { applyMapping, canonicalize, MappingError, parseJson } from "../src/index.js";
import type { AssetContext, JsonObject, Mapping } from "../src/index.js";

const schema: JsonObject = { type: "object", properties: { title: { type: "string", maxLength: 256 }, tier: { enum: ["bronze", "silver", "steel", "gold", "legend"] } }, required: ["title", "tier"], additionalProperties: false };
const mapping: Mapping = { rupa: "mapping/v1", assetType: "rupa.weapon.sword", targetAppId: 2, targetSchemaVersion: 1, rationale: "Test rules", rules: [{ target: "title", template: "{{attrs.name}} — {{history.wins}} wins" }, { target: "tier", from: "base.rarity", map: { "0": "bronze", "1": "silver", "2": "steel", "3": "gold", "4": "legend" } }] };
const context: AssetContext = { base: { rarity: 3 }, attrs: { name: "Api 🔥", element: "fire" }, history: { wins: 7 } };
describe("mapping DSL", () => {
  it("executes reusable history rules and enforces tier across all rarities", () => {
    expect(applyMapping(mapping, context, schema)).toEqual({ title: "Api 🔥 — 7 wins", tier: "gold" });
    for (let rarity = 0; rarity < 5; rarity++) for (let wins = 0; wins < 30; wins++) {
      const input = { ...context, base: { rarity }, history: { wins } };
      expect(applyMapping(mapping, input, schema)).toEqual(applyMapping(mapping, structuredClone(input), schema));
    }
  });
  it("supports exact map/default semantics and returns no mutable aliases", () => {
    const rule = { ...mapping, rules: [{ target: "title", from: "attrs.unknown", default: "No name" }, { target: "tier", const: "bronze" }] };
    expect(applyMapping(rule, context, schema)).toEqual({ title: "No name", tier: "bronze" });
    const output = applyMapping(rule, context, schema); output.title = "Mutated";
    expect(applyMapping(rule, context, schema).title).toBe("No name");
  });
  it.each([
    { target: "tier", const: "legend" },
    { target: "tier", from: "attrs.constructor" },
    { target: "tier", eval: "process.env" },
    { target: "tier", const: "gold", from: "base.rarity" },
    { target: "tier", template: "{{globalThis.fetch}}" },
    { target: "tier", from: "attrs.missing" },
  ])("rejects malicious or ambiguous rules %#", rule => {
    expect(() => applyMapping({ ...mapping, rules: [mapping.rules[0], rule] }, context, schema)).toThrow(MappingError);
  });
  it("rejects duplicate targets, external URLs, oversize strings, schema refs and regex", () => {
    expect(() => applyMapping({ ...mapping, rules: [mapping.rules[0], mapping.rules[0]] }, context, schema)).toThrow();
    for (const name of ["https://evil.example", "javascript:alert(1)", "x".repeat(300)]) expect(() => applyMapping(mapping, { ...context, attrs: { name } }, schema)).toThrow(MappingError);
    expect(() => applyMapping(mapping, context, { $ref: "https://evil.example/schema" })).toThrow(MappingError);
    expect(() => applyMapping(mapping, context, { type: "object", patternProperties: { "(a+)+": {} } })).toThrow(MappingError);
  });
  it("canonicalizes UTF-16 key order, negative zero and finite numbers; rejects ambiguous JSON", () => {
    expect(canonicalize({ z: -0, a: 1e-8, b: "🔥" })).toBe('{"a":1e-8,"b":"🔥","z":0}');
    for (const raw of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"__proto__":{}}', '{"n":9007199254740993}', '{"a":"\\ud800"}']) expect(() => parseJson(raw)).toThrow(MappingError);
    expect(() => canonicalize({ n: Infinity })).toThrow(MappingError);
  });
  it("bounded fuzz inputs produce a validated view or a typed error", () => {
    let seed = 12345;
    for (let i = 0; i < 300; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const name = ["Relic", "<img onerror=alert(1)>", "https://evil.example", "🔥", "x".repeat(257)][seed % 5]!;
      const source = { base: { rarity: seed % 7 }, attrs: { name }, history: { wins: seed % 10 } };
      try { const value = applyMapping(mapping, source, schema); expect(typeof value.title).toBe("string"); expect(String(value.title).length).toBeLessThanOrEqual(256); }
      catch (error) { expect(error).toBeInstanceOf(MappingError); }
    }
  });
});
