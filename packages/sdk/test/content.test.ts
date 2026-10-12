import { describe, expect, it, vi } from "vitest";
import { keccak256, toBytes, zeroHash } from "viem";
import { createContentReader, inlineContent } from "../src/index.js";

it("verifies canonical inline bytes and returns isolated cached objects", async () => {
  const read = createContentReader(), item = inlineContent({ title: "Flame", tier: "gold" });
  const value = await read(item.uri, item.hash); value.title = "changed";
  expect((await read(item.uri, item.hash)).title).toBe("Flame");
  await expect(read(item.uri, zeroHash)).rejects.toMatchObject({ code: "CONTENT_HASH_MISMATCH" });
});
it("blocks arbitrary and redirected origins, malformed IPFS and oversize responses", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response("x".repeat(70_000)));
  const read = createContentReader({ fetch, allowedOrigins: ["https://content.example"] });
  await expect(read("http://169.254.169.254/", zeroHash)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  await expect(read("ipfs://../private", zeroHash)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  expect(fetch).not.toHaveBeenCalled();
  await expect(read("https://content.example/file", zeroHash)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  expect(fetch.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
});
it("rejects duplicate-key JSON even when its raw digest was registered", async () => {
  const raw = '{"x":1,"x":2}', read = createContentReader();
  await expect(read(`data:application/json;base64,${btoa(raw)}`, keccak256(toBytes(raw)))).rejects.toThrow();
});

describe("boundedText status detail", () => {
  it("includes the HTTP status in RupaError.detail", async () => {
    const { boundedText } = await import("../src/content.js");
    await expect(boundedText(new Response("no", { status: 401 }))).rejects.toMatchObject({ code: "DEPENDENCY_UNAVAILABLE", detail: "HTTP 401" });
  });
});
