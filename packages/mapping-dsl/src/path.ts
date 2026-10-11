import { fail } from "./errors.js";
import { BASE_ALLOWLIST, FORBIDDEN_KEYS, HISTORY_ALLOWLIST, LIMITS, SOURCE_ROOTS } from "./limits.js";
import { isIdentifier } from "./json.js";
import type { AssetContext } from "./types.js";

export function parseSourcePath(path: string): string[] {
  if (typeof path !== "string" || path.length === 0) fail("INVALID_SOURCE_PATH", "Source path must be a non-empty string.");
  const segments = path.split(".");
  if (segments.length > LIMITS.maxPathSegments) fail("LIMIT_EXCEEDED", "Source path exceeds the segment limit.");
  if (segments.some((segment) => !isIdentifier(segment) || FORBIDDEN_KEYS.has(segment))) {
    fail("INVALID_SOURCE_PATH", "Source path contains a forbidden or invalid segment.");
  }
  const root = segments[0];
  if (root === undefined || !(SOURCE_ROOTS as readonly string[]).includes(root)) {
    fail("INVALID_SOURCE_PATH", "Source path must start with base, attrs, or history.");
  }
  if (segments.length < 2) fail("INVALID_SOURCE_PATH", "Source path must include a field after the root.");
  if (root === "base" && (segments.length !== 2 || !BASE_ALLOWLIST.includes(segments[1] as typeof BASE_ALLOWLIST[number]))) {
    fail("INVALID_SOURCE_PATH", "Only allowlisted base fields can be read.");
  }
  if (root === "history" && (segments.length !== 2 || !HISTORY_ALLOWLIST.includes(segments[1] as typeof HISTORY_ALLOWLIST[number]))) {
    fail("INVALID_SOURCE_PATH", "Only allowlisted history fields can be read.");
  }
  return segments;
}

export function readPath(context: AssetContext, path: string): { found: boolean; value: unknown } {
  const segments = parseSourcePath(path);
  let current: unknown = context;
  for (const segment of segments) {
    if (!isOwnObject(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { found: false, value: undefined };
    }
    current = current[segment];
  }
  return { found: true, value: current };
}

function isOwnObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
