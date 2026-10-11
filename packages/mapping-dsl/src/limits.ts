export const LIMITS = {
  maxRules: 32,
  maxJsonBytes: 64 * 1024,
  maxPathSegments: 8,
  maxNameChars: 256,
  maxRationaleChars: 1024,
  maxUriChars: 2048,
  maxDepth: 16,
} as const;

export const TIER_RANK = {
  bronze: 0,
  silver: 1,
  steel: 2,
  gold: 3,
  legend: 4,
} as const;

export type DemoTier = keyof typeof TIER_RANK;

export const SOURCE_ROOTS = ["base", "attrs", "history"] as const;
export const BASE_ALLOWLIST = ["rarity"] as const;
export const HISTORY_ALLOWLIST = ["wins"] as const;
export const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
export const MAPPING_VERSION = "mapping/v1";
