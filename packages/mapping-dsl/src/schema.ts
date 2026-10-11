import { Ajv2020 } from "ajv/dist/2020.js";
import { fail } from "./errors.js";
import { canonicalize, parseStrictJson, utf8Bytes } from "./json.js";
import { LIMITS, TIER_RANK, type DemoTier } from "./limits.js";
import type { AssetContext } from "./types.js";

const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
  validateSchema: true,
  discriminator: false,
  unicodeRegExp: true,
});

export function loadSchema(input: unknown): object {
  const schema = typeof input === "string" ? parseStrictJson(input, "schema") : input;
  if (schema === null || typeof schema !== "object") fail("SCHEMA_INVALID", "Target schema must be a JSON object.");
  const encoded = typeof input === "string" ? input : canonicalize(schema);
  if (utf8Bytes(encoded) > LIMITS.maxJsonBytes) fail("LIMIT_EXCEEDED", "Schema exceeds the JSON size limit.");
  rejectRemoteRefs(schema, 0);
  try {
    if (!ajv.validateSchema(schema)) fail("SCHEMA_INVALID", "Target schema is not a valid JSON Schema 2020-12 document.");
  } catch (cause) {
    fail("SCHEMA_INVALID", "Target schema could not be compiled.", cause);
  }
  return schema;
}

export function validateOutput(schema: object, output: Record<string, unknown>): void {
  let valid = false;
  try {
    valid = ajv.validate(schema, output) === true;
  } catch (cause) {
    fail("SCHEMA_INVALID", "Target schema could not be applied to the mapping output.", cause);
  }
  if (!valid) fail("SCHEMA_INVALID", "Mapping output does not match the target schema.");
}

export function enforceInvariants(output: Record<string, unknown>, context: AssetContext): void {
  walkStrings(output, 0, (value, key) => {
    if ((key === "title" || key === "name") && value.length > LIMITS.maxNameChars) {
      fail("LIMIT_EXCEEDED", "Output name or title exceeds the character limit.");
    }
    if (isIpfsUri(value)) {
      if (value.length > LIMITS.maxUriChars) fail("LIMIT_EXCEEDED", "Output URI exceeds the character limit.");
      return;
    }
    if (containsExternalUrl(value)) fail("INVARIANT_VIOLATION", "Output may not contain external URLs.");
  });

  if (Object.prototype.hasOwnProperty.call(output, "tier")) {
    const tier = output.tier;
    if (typeof tier !== "string" || !isDemoTier(tier)) fail("INVARIANT_VIOLATION", "Unknown tier value.");
    if (TIER_RANK[tier] > context.base.rarity) fail("INVARIANT_VIOLATION", "tier rank cannot exceed source rarity.");
  }
}

function rejectRemoteRefs(value: unknown, depth: number): void {
  if (depth > LIMITS.maxDepth) fail("LIMIT_EXCEEDED", "Schema nesting exceeds the evaluator limit.");
  if (Array.isArray(value)) {
    for (const item of value) rejectRemoteRefs(item, depth + 1);
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const ref = record.$ref;
  if (typeof ref === "string" && !ref.startsWith("#")) {
    fail("SCHEMA_INVALID", "Remote JSON Schema references are not allowed.");
  }
  for (const nested of Object.values(record)) rejectRemoteRefs(nested, depth + 1);
}

function walkStrings(value: unknown, depth: number, visit: (value: string, key: string | undefined) => void, key?: string): void {
  if (depth > LIMITS.maxDepth) fail("LIMIT_EXCEEDED", "Output nesting exceeds the evaluator limit.");
  if (typeof value === "string") {
    visit(value, key);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkStrings(item, depth + 1, visit, key);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [nestedKey, nested] of Object.entries(value)) walkStrings(nested, depth + 1, visit, nestedKey);
  }
}

function isIpfsUri(value: string): boolean {
  return /^ipfs:\/\/[A-Za-z0-9._\-/:]+$/.test(value);
}

function containsExternalUrl(value: string): boolean {
  return /(?:^|[\s"'<>({\[])(?:https?:\/\/|\/\/|data:|javascript:|blob:|file:|ws:|wss:)/i.test(value);
}

function isDemoTier(value: string): value is DemoTier {
  return Object.prototype.hasOwnProperty.call(TIER_RANK, value);
}

export function validateContext(context: AssetContext): void {
  if (!Number.isInteger(context.base.rarity) || context.base.rarity < 0 || context.base.rarity > 4) {
    fail("INVARIANT_VIOLATION", "base.rarity must be an integer from 0 to 4.");
  }
  if (!Number.isSafeInteger(context.history.wins) || context.history.wins < 0) {
    fail("INVARIANT_VIOLATION", "history.wins must be a non-negative safe integer.");
  }
  const attrsJson = canonicalize(context.attrs);
  if (utf8Bytes(attrsJson) > LIMITS.maxJsonBytes) fail("LIMIT_EXCEEDED", "attrs exceeds the JSON size limit.");
}
