import { Ajv2020 } from "ajv/dist/2020.js";
import { keccak256, toBytes } from "viem";
import type { Hex } from "viem";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export type Mapping = {
  rupa: "mapping/v1"; assetType: string; targetAppId: number; targetSchemaVersion: number;
  rules: Rule[]; rationale: string;
};
export type Rule = { target: string; const?: Json; from?: string; map?: JsonObject; default?: Json; template?: string };
export type AssetContext = { base: { rarity: number }; attrs: JsonObject; history: { wins: number } };
export class MappingError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "MappingError"; }
}
function fail(code: string, message: string): never { throw new MappingError(code, message); }
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
export const MAX_JSON_BYTES = 65_536;
const ranks: Record<string, number> = { bronze: 0, silver: 1, steel: 2, gold: 3, legend: 4 };

/** RFC 8785: UTF-16 key order and ECMAScript number/string serialization; reject non-I-JSON values. */
export function canonicalize(value: unknown): string {
  let nodes = 0;
  function encode(v: unknown, depth: number): string {
    if (++nodes > 8192 || depth > 16) fail("LIMIT_EXCEEDED", "JSON nesting or node limit exceeded.");
    if (v === null || typeof v === "boolean") return String(v);
    if (typeof v === "number") {
      if (!Number.isFinite(v) || (Number.isInteger(v) && !Number.isSafeInteger(v))) fail("INVALID_JSON", "Unsafe JSON number.");
      return JSON.stringify(v);
    }
    if (typeof v === "string") {
      if (v.length > MAX_JSON_BYTES) fail("LIMIT_EXCEEDED", "JSON string exceeds the size limit.");
      if ([...v].some(c => { const n = c.codePointAt(0)!; return n >= 0xd800 && n <= 0xdfff; })) fail("INVALID_JSON", "Lone Unicode surrogate.");
      return JSON.stringify(v);
    }
    if (Array.isArray(v)) {
      const keys = Object.keys(v);
      if (keys.length !== v.length || keys.some((key, index) => key !== String(index))) fail("INVALID_JSON", "Sparse or extended arrays are not JSON data.");
      return `[${v.map(x => encode(x, depth + 1)).join(",")}]`;
    }
    if (typeof v !== "object" || !v || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail("INVALID_JSON", "Expected plain JSON data.");
    return `{${Object.keys(v).sort().map(key => {
      if (forbidden.has(key)) fail("INVALID_JSON", "Unsafe object key.");
      return `${encode(key, depth + 1)}:${encode((v as Record<string, unknown>)[key], depth + 1)}`;
    }).join(",")}}`;
  }
  const result = encode(value, 0);
  if (toBytes(result).length > MAX_JSON_BYTES) fail("LIMIT_EXCEEDED", "JSON exceeds 64 KiB.");
  return result;
}

/** JSON.parse alone accepts duplicate keys. Detect them before accepting untrusted content. */
export function parseJson(raw: string): Json {
  if (toBytes(raw).length > MAX_JSON_BYTES) fail("LIMIT_EXCEEDED", "JSON exceeds 64 KiB.");
  try {
    const value: unknown = JSON.parse(raw);
    const stack: (Set<string> | null)[] = [];
    for (const match of raw.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\]]/gs)) {
      const token = match[0];
      if (token === "{") stack.push(new Set());
      else if (token === "[") stack.push(null);
      else if (token === "}" || token === "]") stack.pop();
      else if (/^\s*:/.test(raw.slice(match.index + token.length))) {
        const key: string = JSON.parse(token);
        const keys = stack.at(-1);
        if (!keys || keys.has(key)) fail("INVALID_JSON", "Duplicate object key.");
        keys.add(key);
      }
      if (stack.length > 16) fail("LIMIT_EXCEEDED", "JSON nesting limit exceeded.");
    }
    canonicalize(value);
    return value as Json;
  } catch (error) {
    if (error instanceof MappingError) throw error;
    return fail("INVALID_JSON", "Malformed JSON.");
  }
}
export function contentHash(value: unknown): Hex { return keccak256(toBytes(canonicalize(value))); }
export function object(value: unknown): value is JsonObject { return typeof value === "object" && value !== null && !Array.isArray(value); }

const ajv = new Ajv2020({ strict: true, allErrors: false, validateFormats: false, ownProperties: true });
const validators = new Map<string, ReturnType<typeof ajv.compile>>();
export function validateSchema(schema: JsonObject, output: JsonObject): void {
  const key = canonicalize(schema);
  // Only bounded schemas without regex, recursive/remote references, or unknown formats are accepted.
  const inspect = (node: Json): void => {
    if (Array.isArray(node)) { node.forEach(inspect); return; }
    if (!object(node)) return;
    for (const [name, value] of Object.entries(node)) {
      if (["$ref", "$dynamicRef", "$recursiveRef", "pattern", "patternProperties", "format"].includes(name)) fail("SCHEMA_INVALID", "References, regex, and formats are outside the supported schema profile.");
      inspect(value);
    }
  };
  inspect(schema);
  try {
    let validate = validators.get(key);
    if (!validate) {
      validate = ajv.compile(schema);
      // Our bounded cache owns validator lifetime; avoid retaining every schema in Ajv too.
      ajv.removeSchema(schema);
      if (validators.size >= 64) validators.delete(validators.keys().next().value!);
      validators.set(key, validate);
    }
    if (!validate(output)) fail("SCHEMA_INVALID", "Mapping output does not satisfy the target schema.");
  } catch (error) {
    if (error instanceof MappingError) throw error;
    fail("SCHEMA_INVALID", "Invalid or unsupported target schema.");
  }
}

export function parseMapping(input: unknown): Mapping {
  canonicalize(input);
  if (!object(input) || Object.keys(input).some(key => !["rupa", "assetType", "targetAppId", "targetSchemaVersion", "rules", "rationale"].includes(key)) || input.rupa !== "mapping/v1" || typeof input.assetType !== "string" || !/^[a-zA-Z0-9._-]{1,128}$/.test(input.assetType) || !Number.isSafeInteger(input.targetAppId) || Number(input.targetAppId) < 1 || Number(input.targetAppId) > 0xffffffff || !Number.isSafeInteger(input.targetSchemaVersion) || Number(input.targetSchemaVersion) < 1 || typeof input.rationale !== "string" || input.rationale.length > 1024 || !Array.isArray(input.rules) || input.rules.length === 0 || input.rules.length > 32) fail("INVALID_MAPPING", "Invalid mapping envelope.");
  const targets = new Set<string>();
  for (const rule of input.rules) {
    if (!object(rule) || typeof rule.target !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(rule.target) || forbidden.has(rule.target)) fail("INVALID_MAPPING", "Invalid rule target.");
    if (Object.keys(rule).some(key => !["target", "const", "from", "map", "default", "template"].includes(key))) fail("UNKNOWN_OPERATOR", "Unknown mapping operator.");
    if (targets.has(rule.target)) fail("DUPLICATE_TARGET", "Duplicate rule target.");
    targets.add(rule.target);
    if (["const", "from", "template"].filter(key => own(rule, key)).length !== 1 || ((own(rule, "map") || own(rule, "default")) && !own(rule, "from"))) fail("INVALID_MAPPING", "A rule needs exactly one producer.");
    if (own(rule, "from")) validPath(rule.from);
    if (own(rule, "map") && (!object(rule.map) || Object.keys(rule.map).length > 64)) fail("INVALID_MAPPING", "Invalid lookup map.");
    if (own(rule, "template")) {
      if (typeof rule.template !== "string" || rule.template.length > 256) fail("INVALID_MAPPING", "Invalid template.");
      const remainder = rule.template.replace(/\{\{([^{}]+)\}\}/g, (_, path: string) => { validPath(path); return ""; });
      if (/[{}]/.test(remainder)) fail("INVALID_MAPPING", "Invalid template placeholder.");
    }
  }
  return input as unknown as Mapping;
}
function validPath(path: unknown): asserts path is string {
  if (typeof path !== "string" || !/^(?:base\.rarity|history\.wins|attrs\.[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)$/.test(path) || path.split(".").length > 8 || path.split(".").some(x => forbidden.has(x))) fail("INVALID_SOURCE_PATH", "Source path is not allowed.");
}
function read(context: AssetContext, path: string): Json | undefined {
  validPath(path);
  let value: unknown = context;
  for (const part of path.split(".")) {
    if (!object(value) || !own(value, part)) return undefined;
    value = value[part];
  }
  return value as Json;
}
function scalar(value: Json | undefined): string {
  if (value === undefined || value === null || typeof value === "object") return fail("MISSING_SOURCE", "Expected a source scalar.");
  return String(value);
}
function invariant(value: Json, key = ""): void {
  if (typeof value === "string") {
    if (value.length > (key.toLowerCase().includes("uri") ? 2048 : 256)) fail("LIMIT_EXCEEDED", "Output string is too long.");
    if ([...value.matchAll(/([a-z][a-z0-9+.-]*):\/\//gi)].some(match => match[1]!.toLowerCase() !== "ipfs") || /(?:javascript:|data:|file:|ftp:|www\.)/i.test(value) || value.startsWith("//")) fail("INVARIANT_VIOLATION", "External output URLs are not allowed.");
    if (/(?:uri|url)$/i.test(key) && !/^ipfs:\/\/[a-zA-Z0-9]+(?:\/[a-zA-Z0-9._/-]*)?$/.test(value)) fail("INVARIANT_VIOLATION", "Output URIs must use IPFS.");
  } else if (Array.isArray(value)) value.forEach(x => invariant(x, key));
  else if (object(value)) Object.entries(value).forEach(([name, item]) => invariant(item, name));
}
export function applyMapping(input: unknown, context: AssetContext, schema: JsonObject): JsonObject {
  const mapping = parseMapping(input);
  canonicalize(context);
  if (!Number.isInteger(context.base.rarity) || context.base.rarity < 0 || context.base.rarity > 4 || !Number.isSafeInteger(context.history.wins) || context.history.wins < 0) fail("INVALID_MAPPING", "Invalid source context.");
  const output: JsonObject = {};
  for (const rule of mapping.rules) {
    let value: Json | undefined;
    if (own(rule, "const")) value = rule.const;
    else if (rule.template !== undefined) value = rule.template.replace(/\{\{([^{}]+)\}\}/g, (_, path: string) => scalar(read(context, path)));
    else {
      value = read(context, rule.from!);
      if (value !== undefined && rule.map) {
        const key = scalar(value);
        value = own(rule.map, key) ? rule.map[key] : undefined;
      }
      if (value === undefined && own(rule, "default")) value = rule.default;
    }
    if (value === undefined) fail("MISSING_SOURCE", "Missing source value or map default.");
    output[rule.target] = value;
  }
  invariant(output);
  if (own(output, "tier") && (typeof output.tier !== "string" || !own(ranks, output.tier) || ranks[output.tier]! > context.base.rarity)) fail("INVARIANT_VIOLATION", "Tier exceeds the source rarity.");
  canonicalize(output);
  validateSchema(schema, output);
  return parseJson(canonicalize(output)) as JsonObject;
}
