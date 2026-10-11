import { fail } from "./errors.js";
import { canonicalize, isIdentifier, parseStrictJson, utf8Bytes } from "./json.js";
import { LIMITS, MAPPING_VERSION } from "./limits.js";
import { parseSourcePath } from "./path.js";
import type { MappingDocument, MappingRule } from "./types.js";

const RULE_KEYS = new Set(["target", "const", "from", "map", "template", "default"]);
const MAPPING_KEYS = new Set(["rupa", "assetType", "targetAppId", "targetSchemaVersion", "rules", "rationale"]);

export function parseMapping(input: unknown): MappingDocument {
  const raw = typeof input === "string" ? parseStrictJson(input, "mapping") : input;
  if (!isRecord(raw)) fail("INVALID_MAPPING", "Mapping must be a JSON object.");
  for (const key of Object.keys(raw)) {
    if (!MAPPING_KEYS.has(key)) fail("INVALID_MAPPING", `Unknown mapping field "${key}".`);
  }
  if (raw.rupa !== MAPPING_VERSION) fail("INVALID_MAPPING", "Unsupported mapping version.");
  if (typeof raw.assetType !== "string" || raw.assetType.length === 0) {
    fail("INVALID_MAPPING", "assetType must be a non-empty string.");
  }
  if (!isUint32(raw.targetAppId)) fail("INVALID_MAPPING", "targetAppId must be a uint32.");
  if (!isSafeVersion(raw.targetSchemaVersion)) fail("INVALID_MAPPING", "targetSchemaVersion must be a safe integer.");
  if (!Array.isArray(raw.rules)) fail("INVALID_MAPPING", "rules must be an array.");
  if (raw.rules.length > LIMITS.maxRules) fail("LIMIT_EXCEEDED", "Mapping exceeds the rule limit.");
  if (raw.rationale !== undefined) {
    if (typeof raw.rationale !== "string") fail("INVALID_MAPPING", "rationale must be a string.");
    if (raw.rationale.length > LIMITS.maxRationaleChars) fail("LIMIT_EXCEEDED", "rationale exceeds the character limit.");
  }
  const encoded = typeof input === "string" ? input : canonicalize(raw);
  if (utf8Bytes(encoded) > LIMITS.maxJsonBytes) fail("LIMIT_EXCEEDED", "Mapping exceeds the JSON size limit.");

  const targets = new Set<string>();
  const rules = raw.rules.map((rule) => parseRule(rule, targets));
  return {
    rupa: MAPPING_VERSION,
    assetType: raw.assetType,
    targetAppId: raw.targetAppId,
    targetSchemaVersion: raw.targetSchemaVersion,
    rules,
    ...(raw.rationale === undefined ? {} : { rationale: raw.rationale }),
  };
}

function parseRule(rule: unknown, targets: Set<string>): MappingRule {
  if (!isRecord(rule)) fail("INVALID_MAPPING", "Each rule must be an object.");
  for (const key of Object.keys(rule)) {
    if (!RULE_KEYS.has(key)) fail("UNKNOWN_OPERATOR", `Unknown rule field "${key}".`);
  }
  if (typeof rule.target !== "string" || !isIdentifier(rule.target)) {
    fail("INVALID_MAPPING", "Rule target must be a top-level identifier.");
  }
  if (targets.has(rule.target)) fail("DUPLICATE_TARGET", `Duplicate rule target "${rule.target}".`);
  targets.add(rule.target);

  const hasConst = Object.prototype.hasOwnProperty.call(rule, "const");
  const hasFrom = Object.prototype.hasOwnProperty.call(rule, "from");
  const hasTemplate = Object.prototype.hasOwnProperty.call(rule, "template");
  const hasMap = Object.prototype.hasOwnProperty.call(rule, "map");
  const hasDefault = Object.prototype.hasOwnProperty.call(rule, "default");
  const producers = Number(hasConst) + Number(hasFrom) + Number(hasTemplate);
  if (producers !== 1) fail("INVALID_MAPPING", "Each rule needs exactly one of const, from, or template.");
  if ((hasMap || hasDefault) && !hasFrom) fail("INVALID_MAPPING", "map and default can only be used with from.");
  if (hasFrom) {
    if (typeof rule.from !== "string") fail("INVALID_SOURCE_PATH", "from must be a source path string.");
    parseSourcePath(rule.from);
  }
  if (hasTemplate) {
    if (typeof rule.template !== "string") fail("INVALID_MAPPING", "template must be a string.");
    for (const match of rule.template.matchAll(/\{\{([^{}]+)\}\}/g)) {
      parseSourcePath(match[1]!.trim());
    }
    if (/\{\{|\}\}/.test(rule.template.replaceAll(/\{\{[^{}]+\}\}/g, ""))) {
      fail("INVALID_MAPPING", "template cannot contain operators or malformed placeholders.");
    }
  }
  if (hasMap) {
    if (!isRecord(rule.map) || Array.isArray(rule.map)) fail("INVALID_MAPPING", "map must be an object.");
    for (const key of Object.keys(rule.map)) {
      if (FORBIDDEN_IN_MAP(key)) fail("INVALID_MAPPING", "map contains a forbidden key.");
    }
  }
  return {
    target: rule.target,
    ...(hasConst ? { const: rule.const } : {}),
    ...(hasFrom ? { from: rule.from as string } : {}),
    ...(hasMap ? { map: rule.map as Record<string, unknown> } : {}),
    ...(hasTemplate ? { template: rule.template as string } : {}),
    ...(hasDefault ? { default: rule.default } : {}),
  };
}

function FORBIDDEN_IN_MAP(key: string): boolean {
  return key === "__proto__" || key === "prototype" || key === "constructor";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isUint32(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff;
}

function isSafeVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
