import { canonicalize, MAX_JSON_BYTES, object, parseJson } from "@rupa/mapping-dsl";
import type { JsonObject } from "@rupa/mapping-dsl";
import { keccak256, toBytes } from "viem";
import type { Hex } from "viem";
import { RupaError } from "./errors.js";

export async function boundedText(response: Response, maxBytes = MAX_JSON_BYTES): Promise<string> {
  if (!response.ok || Number(response.headers.get("content-length") ?? 0) > maxBytes || !response.body) throw new RupaError("DEPENDENCY_UNAVAILABLE", "Content response is unavailable or too large.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new RupaError("INVALID_REQUEST", "Response exceeds the size limit.");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
}

export function createContentReader(options: {
  gateway?: string; allowedOrigins?: readonly string[]; fetch?: typeof fetch;
} = {}): (uri: string, expectedHash: Hex) => Promise<JsonObject> {
  const gateway = options.gateway ?? "https://ipfs.io/ipfs/";
  const fetcher = options.fetch ?? globalThis.fetch;
  const cache = new Map<string, string>();
  return async (uri, expectedHash) => {
    const cached = cache.get(expectedHash.toLowerCase());
    if (cached) return parseJson(cached) as JsonObject;
    try {
      let raw: string;
      if (uri.startsWith("data:application/json;base64,")) {
        const encoded = uri.slice(29);
        if (encoded.length > MAX_JSON_BYTES * 1.4 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(encoded)) throw new RupaError("INVALID_REQUEST", "Invalid inline JSON.");
        raw = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)));
      } else {
        let url: URL;
        if (uri.startsWith("ipfs://")) {
          const path = uri.slice(7);
          if (!/^[a-zA-Z0-9]{32,100}(?:\/[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)*$/.test(path)) throw new RupaError("INVALID_REQUEST", "Invalid IPFS locator.");
          url = new URL(path, gateway.endsWith("/") ? gateway : `${gateway}/`);
        } else {
          url = new URL(uri);
          if (!options.allowedOrigins?.includes(url.origin)) throw new RupaError("INVALID_REQUEST", "Content origin is not allowlisted.");
        }
        if (url.username || url.password || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost"))) throw new RupaError("INVALID_REQUEST", "Unsupported content URL.");
        raw = await boundedText(await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(12_000) }));
      }
      const parsed = parseJson(raw);
      if (!object(parsed) || canonicalize(parsed) !== raw || keccak256(toBytes(raw)).toLowerCase() !== expectedHash.toLowerCase()) throw new RupaError("CONTENT_HASH_MISMATCH", "Content does not match the canonical onchain hash.");
      if (cache.size >= 128) cache.delete(cache.keys().next().value!);
      cache.set(expectedHash.toLowerCase(), raw);
      return parsed;
    } catch (error) {
      if (error instanceof RupaError) throw error;
      throw new RupaError("DEPENDENCY_UNAVAILABLE", "Unable to load verified content.");
    }
  };
}

/** Portable fixture storage for the mock demo. Real publishers may return ipfs:// URIs. */
export function inlineContent(value: unknown): { uri: string; hash: Hex } {
  const raw = canonicalize(value);
  const bytes = toBytes(raw);
  const uri = `data:application/json;base64,${btoa(String.fromCharCode(...bytes))}`;
  if (uri.length > 2048) throw new RupaError("INVALID_REQUEST", "Inline content exceeds the contract URI limit; use an IPFS publisher.");
  return { uri, hash: keccak256(bytes) };
}
