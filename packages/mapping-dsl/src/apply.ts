import { fail } from "./errors.js";
import { canonicalize, hashCanonical } from "./json.js";
import { readPath } from "./path.js";
import { enforceInvariants, loadSchema, validateContext, validateOutput } from "./schema.js";
import { parseMapping } from "./validate.js";
import type { ApplyMappingOptions, AssetContext, MappingDocument, MappingRule } from "./types.js";

export function applyMapping(
  mappingInput: unknown,
  context: AssetContext,
  options: ApplyMappingOptions,
): Record<string, unknown> {
  validateContext(context);
  const mapping = parseMapping(mappingInput);
  const schema = loadSchema(options.targetSchema);
  assertHashes(mapping, mappingInput, context, schema, options);

  const output: Record<string, unknown> = {};
  for (const rule of mapping.rules) output[rule.target] = evaluateRule(rule, context);
  enforceInvariants(output, context);
  validateOutput(schema, output);
  return output;
}

function assertHashes(
  mapping: MappingDocument,
  mappingInput: unknown,
  context: AssetContext,
  schema: object,
  options: ApplyMappingOptions,
): void {
  if (options.expectedMappingHash !== undefined) {
    const value = typeof mappingInput === "string" ? JSON.parse(mappingInput) as unknown : mapping;
    if (hashCanonical(value).toLowerCase() !== options.expectedMappingHash.toLowerCase()) {
      fail("CONTENT_HASH_MISMATCH", "Mapping content hash does not match the expected digest.");
    }
  }
  if (options.expectedSchemaHash !== undefined && hashCanonical(schema).toLowerCase() !== options.expectedSchemaHash.toLowerCase()) {
    fail("CONTENT_HASH_MISMATCH", "Schema content hash does not match the expected digest.");
  }
  if (options.expectedAttrsHash !== undefined && hashCanonical(context.attrs).toLowerCase() !== options.expectedAttrsHash.toLowerCase()) {
    fail("CONTENT_HASH_MISMATCH", "Attribute content hash does not match the expected digest.");
  }
}

function evaluateRule(rule: MappingRule, context: AssetContext): unknown {
  if (Object.prototype.hasOwnProperty.call(rule, "const")) return structuredClone(rule.const);
  if (rule.template !== undefined) return evaluateTemplate(rule.template, context);
  if (rule.from === undefined) fail("INVALID_MAPPING", "Rule is missing a producer.");
  const source = readPath(context, rule.from);
  if (!source.found) {
    if (Object.prototype.hasOwnProperty.call(rule, "default")) return structuredClone(rule.default);
    fail("MISSING_SOURCE", `Source path "${rule.from}" is missing.`);
  }
  if (rule.map === undefined) return source.value;
  const key = mapKey(source.value);
  if (key !== undefined && Object.prototype.hasOwnProperty.call(rule.map, key)) {
    return structuredClone(rule.map[key]);
  }
  if (Object.prototype.hasOwnProperty.call(rule, "default")) return structuredClone(rule.default);
  fail("MISSING_SOURCE", `No map entry for "${rule.from}".`);
}

function evaluateTemplate(template: string, context: AssetContext): string {
  return template.replaceAll(/\{\{([^{}]+)\}\}/g, (_all, rawPath: string) => {
    const path = rawPath.trim();
    const source = readPath(context, path);
    if (!source.found) fail("MISSING_SOURCE", `Template path "${path}" is missing.`);
    return scalarText(source.value, path);
  });
}

function mapKey(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  if (typeof value === "number" && Number.isFinite(value)) return canonicalize(value);
  return undefined;
}

function scalarText(value: unknown, path: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) return canonicalize(value);
  fail("INVALID_MAPPING", `Template path "${path}" must resolve to a scalar.`);
}
