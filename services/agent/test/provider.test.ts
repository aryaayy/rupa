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
  it("jitters backoff below the full exponential delay", async () => {
    const sleeps: number[] = [];
    let now = 0, calls = 0;
    const provider = httpProvider({ ...base, now: () => now, random: () => 0.25, sleep: async ms => { sleeps.push(ms); now += ms; }, fetch: async () => (++calls < 2 ? new Response("", { status: 503 }) : ok({ rules: [] })) });
    await provider(request);
    expect(sleeps).toEqual([250]);
  });
  it("honors Retry-After on 429 and caps it at the remaining deadline", async () => {
    let now = 0, calls = 0;
    const sleeps: number[] = [];
    const provider = httpProvider({ ...base, deadlineMs: 10_000, now: () => now, sleep: async ms => { sleeps.push(ms); now += ms; }, fetch: async () => { calls++; return new Response("", { status: 429, headers: { "retry-after": calls === 1 ? "2" : "120" } }); } });
    await expect(provider(request)).rejects.toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
    expect(sleeps[0]).toBe(2_000);
    expect(sleeps.reduce((sum, ms) => sum + ms, 0)).toBeLessThanOrEqual(10_000);
    expect(sleeps.some(ms => ms >= 120_000)).toBe(false);
  });
  it("honors an HTTP-date Retry-After", async () => {
    let now = Date.parse("2026-01-01T00:00:00.000Z");
    const sleeps: number[] = [];
    let calls = 0;
    const provider = httpProvider({ ...base, deadlineMs: 30_000, now: () => now, sleep: async ms => { sleeps.push(ms); now += ms; }, fetch: async () => { calls++; return calls === 1 ? new Response("", { status: 429, headers: { "retry-after": new Date(now + 3_000).toUTCString() } }) : ok({ rules: [] }); } });
    await provider(request);
    expect(sleeps).toEqual([3_000]);
  });
  it.each([400, 401, 403])("does not retry HTTP %s", async status => {
    let calls = 0;
    const sleeps: number[] = [];
    const provider = httpProvider({ ...base, fallbackModel: "m2", maxRetries: 5, sleep: async ms => { sleeps.push(ms); }, fetch: async () => { calls++; return new Response("no", { status }); } });
    await expect(provider(request)).rejects.toMatchObject({ code: "INVALID_REQUEST", detail: `model m1: HTTP ${status}` });
    expect(calls).toBe(1);
    expect(sleeps).toEqual([]);
  });
  it("retries a timeout at most once", async () => {
    let calls = 0;
    const provider = httpProvider({ ...base, fallbackModel: "m2", maxRetries: 5, deadlineMs: 120_000, timeoutMs: 30_000, sleep: async () => {}, fetch: async () => { calls++; throw Object.assign(new Error("timeout"), { name: "TimeoutError" }); } });
    await expect(provider(request)).rejects.toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
    expect(calls).toBe(2);
  });
});
