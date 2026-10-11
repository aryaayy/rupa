import type { AssetContext } from "../src/index.js";

export const socialSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["kind", "color", "title", "tier"],
  properties: {
    kind: { type: "string", enum: ["profile_frame"] },
    color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    title: { type: "string", minLength: 1, maxLength: 256 },
    tier: { type: "string", enum: ["bronze", "silver", "steel", "gold", "legend"] },
  },
} as const;

export const swordSocialMapping = {
  rupa: "mapping/v1",
  assetType: "rupa.weapon.sword",
  targetAppId: 2,
  targetSchemaVersion: 1,
  rules: [
    { target: "kind", const: "profile_frame" },
    { target: "color", from: "attrs.element", map: { fire: "#FF5A1F", ice: "#4FC3F7" }, default: "#999999" },
    { target: "title", template: "{{attrs.name}} — {{history.wins}} wins" },
    { target: "tier", from: "base.rarity", map: { "0": "bronze", "1": "silver", "2": "steel", "3": "gold", "4": "legend" } },
  ],
  rationale: "Elemen menentukan warna frame; history kemenangan menentukan judul.",
} as const;

export function swordContext(overrides?: Partial<{ rarity: number; name: string; element: string; wins: number }>): AssetContext {
  return {
    base: { rarity: overrides?.rarity ?? 3 },
    attrs: { name: overrides?.name ?? "Fire Sword", element: overrides?.element ?? "fire" },
    history: { wins: overrides?.wins ?? 7 },
  };
}
