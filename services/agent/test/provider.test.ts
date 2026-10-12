import { describe, expect, it } from "vitest";
import { httpProvider } from "../src/provider.js";
import type { RuleRequest } from "../src/provider.js";

const request: RuleRequest = { assetType: "rupa.relic", targetAppId: 2, targetSchemaVersion: 1, source: { base: { rarity: 1 }, attrs: { name: "A", element: "fire" }, history: { wins: 0 } }, schema: { type: "object" }, feedback: "" };
const ok = (content: unknown) => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }] }), { status: 200 });
const base = { baseUrl: "https://llm.example/v1/", apiKey: "k", model: "m1", sleep: async () => {} };

describe("httpProvider", () => {
  it("overwrites server-known envelope fields", async () => {
    const provider = httpProvider({ ...base, fetch: async () => ok({ rupa: true, assetType: "x", targetAppId: 9, targetSchemaVersion: 7, rules: [], rationale: "r" }) });
    expect(await provider(request)).toMatchObject({ rupa: "mapping/v1", assetType: "rupa.relic", targetAppId: 2, targetSchemaVersion: 1 });
  });
  it("retries 503 with backoff then succeeds", async () => {
    let calls = 0;
    const provider = httpProvider({ ...base, fetch: async () => (++calls < 3 ? new Response("busy", { status: 503 }) : ok({ rules: [] })) });
    await provider(request);
    expect(calls).toBe(3);
  });
  it("falls back to LLM_FALLBACK_MODEL after retries are exhausted", async () => {
    const models: string[] = [];
    const provider = httpProvider({ ...base, fallbackModel: "m2", maxRetries: 1, fetch: async (_u, init) => { const model = JSON.parse(String(init?.body)).model; models.push(model); return model === "m1" ? new Response("", { status: 429 }) : ok({ rules: [] }); } });
    await provider(request);
    expect(models).toEqual(["m1", "m1", "m2"]);
  });
  it("throws DEPENDENCY_UNAVAILABLE with the HTTP status in detail", async () => {
    const provider = httpProvider({ ...base, maxRetries: 0, fetch: async () => new Response("", { status: 503 }) });
    await expect(provider(request)).rejects.toMatchObject({ code: "DEPENDENCY_UNAVAILABLE", detail: "model m1: HTTP 503" });
  });
});
