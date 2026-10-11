import { keccak256, stringToHex } from "viem";
import type { Hex } from "viem";
import { fail } from "./errors.js";
import { FORBIDDEN_KEYS, LIMITS } from "./limits.js";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function assertJsonSize(text: string, label: string): void {
  if (utf8Bytes(text) > LIMITS.maxJsonBytes) fail("LIMIT_EXCEEDED", `${label} exceeds ${LIMITS.maxJsonBytes} bytes.`);
}

export function parseStrictJson(text: string, label = "JSON"): unknown {
  if (text.charCodeAt(0) === 0xfeff) fail("INVALID_MAPPING", `${label} must not start with a BOM.`);
  assertJsonSize(text, label);
  scanJson(text, label);
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    fail("INVALID_MAPPING", `${label} is not valid JSON.`, cause);
  }
}

export function canonicalize(value: unknown): string {
  return serialize(value, 0);
}

export function hashCanonical(value: unknown): Hex {
  return keccak256(stringToHex(canonicalize(value)));
}

function serialize(value: unknown, depth: number): string {
  if (depth > LIMITS.maxDepth) fail("LIMIT_EXCEEDED", "JSON nesting exceeds the evaluator limit.");
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("INVALID_MAPPING", "Non-finite numbers cannot be canonicalized.");
    return es6NumberToString(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => serialize(item, depth + 1)).join(",")}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const key of keys) {
      if (FORBIDDEN_KEYS.has(key)) fail("INVALID_MAPPING", "Forbidden object key in JSON value.");
    }
    return `{${keys.map((key) => `${JSON.stringify(key)}:${serialize(value[key], depth + 1)}`).join(",")}}`;
  }
  fail("INVALID_MAPPING", "Value cannot be represented in canonical JSON.");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** ES6 NumberToString for finite numbers, matching RFC 8785 JCS. */
function es6NumberToString(value: number): string {
  if (Object.is(value, -0)) return "0";
  if (Number.isInteger(value) && Number.isSafeInteger(value)) return String(value);
  return JSON.stringify(value);
}

function scanJson(text: string, label: string): void {
  let index = 0;
  const end = text.length;

  const peek = (): string | undefined => text[index];
  const skipWs = (): void => {
    while (index < end && /[ \t\n\r]/.test(text[index]!)) index += 1;
  };
  const consume = (expected: string): void => {
    if (text.startsWith(expected, index)) {
      index += expected.length;
      return;
    }
    fail("INVALID_MAPPING", `${label} has unexpected token.`);
  };

  const parseString = (): string => {
    if (peek() !== "\"") fail("INVALID_MAPPING", `${label} expected a string.`);
    let i = index + 1;
    let out = "";
    while (i < end) {
      const ch = text[i]!;
      if (ch === "\"") {
        index = i + 1;
        return out;
      }
      if (ch === "\\") {
        const next = text[i + 1];
        if (next === undefined) fail("INVALID_MAPPING", `${label} has a truncated escape.`);
        i += 2;
        out += next;
        continue;
      }
      if (ch.charCodeAt(0) < 0x20) fail("INVALID_MAPPING", `${label} has an unescaped control character.`);
      out += ch;
      i += 1;
    }
    fail("INVALID_MAPPING", `${label} has an unterminated string.`);
  };

  const parseNumber = (): void => {
    const start = index;
    if (peek() === "-") index += 1;
    if (peek() === "0") index += 1;
    else if (peek() !== undefined && peek()! >= "1" && peek()! <= "9") {
      while (peek() !== undefined && peek()! >= "0" && peek()! <= "9") index += 1;
    } else fail("INVALID_MAPPING", `${label} has an invalid number.`);
    if (peek() === ".") {
      index += 1;
      if (peek() === undefined || peek()! < "0" || peek()! > "9") fail("INVALID_MAPPING", `${label} has an invalid number.`);
      while (peek() !== undefined && peek()! >= "0" && peek()! <= "9") index += 1;
    }
    if (peek() === "e" || peek() === "E") {
      index += 1;
      if (peek() === "+" || peek() === "-") index += 1;
      if (peek() === undefined || peek()! < "0" || peek()! > "9") fail("INVALID_MAPPING", `${label} has an invalid number.`);
      while (peek() !== undefined && peek()! >= "0" && peek()! <= "9") index += 1;
    }
    const token = text.slice(start, index);
    const value = Number(token);
    if (!Number.isFinite(value)) fail("INVALID_MAPPING", `${label} contains a non-finite number.`);
    const integer = /^-?\d+$/.test(token);
    if (integer && !Number.isSafeInteger(value)) {
      fail("INVALID_MAPPING", `${label} contains an integer that cannot be represented precisely.`);
    }
  };

  const parseValue = (depth: number): void => {
    if (depth > LIMITS.maxDepth) fail("LIMIT_EXCEEDED", `${label} nesting exceeds the evaluator limit.`);
    skipWs();
    const ch = peek();
    if (ch === "\"") {
      parseString();
      return;
    }
    if (ch === "{") {
      parseObject(depth + 1);
      return;
    }
    if (ch === "[") {
      parseArray(depth + 1);
      return;
    }
    if (ch === "t") {
      consume("true");
      return;
    }
    if (ch === "f") {
      consume("false");
      return;
    }
    if (ch === "n") {
      consume("null");
      return;
    }
    if (ch === "-" || (ch !== undefined && ch >= "0" && ch <= "9")) {
      parseNumber();
      return;
    }
    fail("INVALID_MAPPING", `${label} has unexpected token.`);
  };

  const parseObject = (depth: number): void => {
    consume("{");
    skipWs();
    if (peek() === "}") {
      index += 1;
      return;
    }
    const keys = new Set<string>();
    while (true) {
      skipWs();
      const key = parseString();
      if (keys.has(key)) fail("INVALID_MAPPING", `${label} contains a duplicate object key.`);
      if (FORBIDDEN_KEYS.has(key)) fail("INVALID_MAPPING", `${label} contains a forbidden object key.`);
      keys.add(key);
      skipWs();
      consume(":");
      parseValue(depth);
      skipWs();
      if (peek() === ",") {
        index += 1;
        continue;
      }
      if (peek() === "}") {
        index += 1;
        return;
      }
      fail("INVALID_MAPPING", `${label} has a malformed object.`);
    }
  };

  const parseArray = (depth: number): void => {
    consume("[");
    skipWs();
    if (peek() === "]") {
      index += 1;
      return;
    }
    while (true) {
      parseValue(depth);
      skipWs();
      if (peek() === ",") {
        index += 1;
        continue;
      }
      if (peek() === "]") {
        index += 1;
        return;
      }
      fail("INVALID_MAPPING", `${label} has a malformed array.`);
    }
  };

  parseValue(0);
  skipWs();
  if (index !== end) fail("INVALID_MAPPING", `${label} has trailing data.`);
}

export function isIdentifier(value: string): boolean {
  return IDENTIFIER.test(value) && !FORBIDDEN_KEYS.has(value);
}
