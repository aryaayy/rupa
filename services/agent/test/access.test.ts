import { describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { zeroHash } from "viem";
import { monadTestnetDeployment, RupaError } from "@rupa/sdk";
import { createDemoAccess } from "../src/demo.js";
import { createAgentApp } from "../src/server.js";

function fixture() {
  let now = 1000;
  const actions = { fund: vi.fn(async () => ({ txHash: zeroHash })), reward: vi.fn(async () => ({ assetId: "1", txHash: zeroHash, minted: true })) };
  const demo = createDemoAccess({ origin: "http://localhost:5173", chainId: 31337, actions, now: () => now });
  async function login(ip = "test-peer") {
    const account = privateKeyToAccount(generatePrivateKey());
    const challenge = demo.challenge(account.address, ip);
    const signature = await account.signMessage({ message: challenge.message });
    return { account, challenge, signature, ...await demo.authenticate(challenge.nonce, signature, ip) };
  }
  return { actions, demo, login, advance: (ms: number) => { now += ms; } };
}
describe("demo access", () => {
  it("requires a wallet signature, rejects replay and binds the session to its peer", async () => {
    const f = fixture(), session = await f.login();
    await expect(f.demo.authenticate(session.challenge.nonce, session.signature, "test-peer")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(f.demo.fund(session.token, "other-peer")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(f.demo.reward(session.token, "test-peer")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(f.actions.fund).not.toHaveBeenCalled(); expect(f.actions.reward).not.toHaveBeenCalled();
    f.advance(3_600_001);
    expect(() => f.demo.start(session.token, "test-peer")).toThrow("expired");
  });
  it("expires challenges and rejects signatures from another wallet", async () => {
    const f = fixture(), a = privateKeyToAccount(generatePrivateKey()), b = privateKeyToAccount(generatePrivateKey());
    const c = f.demo.challenge(a.address, "peer"), signature = await b.signMessage({ message: c.message });
    await expect(f.demo.authenticate(c.nonce, signature, "peer")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    const expired = f.demo.challenge(a.address, "peer"); f.advance(120_001);
    await expect(f.demo.authenticate(expired.nonce, await a.signMessage({ message: expired.message }), "peer")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
  it("deduplicates faucet retries including unknown transaction outcomes and caps spending per IP", async () => {
    const f = fixture(), s = await f.login();
    f.actions.fund.mockRejectedValueOnce(new RupaError("TX_STATUS_UNKNOWN", "Submitted", { txHash: zeroHash }));
    for (let i = 0; i < 2; i++) await expect(f.demo.fund(s.token, "test-peer")).rejects.toMatchObject({ code: "TX_STATUS_UNKNOWN" });
    expect(f.actions.fund).toHaveBeenCalledOnce();
    for (let i = 0; i < 2; i++) await f.demo.fund((await f.login()).token, "test-peer");
    await expect(f.demo.fund((await f.login()).token, "test-peer")).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(f.actions.fund).toHaveBeenCalledTimes(3);
  });
  it("only rewards one server-confirmed victory and limits global faucet use", async () => {
    const f = fixture(), s = await f.login();
    f.demo.start(s.token, "test-peer");
    expect(f.demo.play(s.token, "test-peer", "guard").won).toBe(false);
    await expect(f.demo.reward(s.token, "test-peer")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    f.demo.start(s.token, "test-peer");
    for (const move of ["strike", "guard", "strike"]) f.demo.play(s.token, "test-peer", move);
    await f.demo.reward(s.token, "test-peer");
    await expect(f.demo.reward(s.token, "test-peer")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(f.actions.reward).toHaveBeenCalledOnce();
    for (let i = 0; i < 20; i++) { const peer = `peer-${i}`; await f.demo.fund((await f.login(peer)).token, peer); }
    await expect(f.demo.fund((await f.login("last-peer")).token, "last-peer")).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(f.actions.fund).toHaveBeenCalledTimes(20);
  });
});
describe("agent HTTP boundary", () => {
  function app() {
    const translate = vi.fn(async () => ({ mappingId: zeroHash, contentURI: "ipfs://fixture", txHash: null, reused: true }));
    const service = createAgentApp({ config: { deployment: monadTestnetDeployment, apps: { arena: 1, social: 2, gallery: 3 }, agentId: "1", llmMode: "mock", faucet: false }, translator: { translate, stats: { generated: 0, reused: 0, requests: 0 } } });
    const request = (body: string, headers: Record<string, string> = {}) => service.handle(new Request("http://localhost/translate", { method: "POST", headers: { "content-type": "application/json", ...headers }, body }), "real-peer");
    return { translate, service, request };
  }
  it("rejects malformed, duplicate, oversized and attacker-controlled source fields", async () => {
    const f = app();
    for (const body of ['{', '{"assetId":"1","assetId":"2","targetAppId":2}', JSON.stringify({ assetId: "1", targetAppId: 2, attrs: { tier: "legend" } }), JSON.stringify({ assetId: "x".repeat(66000), targetAppId: 2 }), '{"assetId":"0","targetAppId":2}']) expect((await f.request(body)).status).toBe(400);
    expect(f.translate).not.toHaveBeenCalled();
  });
  it("uses exact CORS origins and ignores forged forwarding headers for rate limits", async () => {
    const f = app(), body = '{"assetId":"1","targetAppId":2}';
    expect((await f.request(body, { origin: "https://evil.example" })).status).toBe(403);
    const allowed = await f.request(body, { origin: monadTestnetDeployment.origin });
    expect(allowed.headers.get("access-control-allow-origin")).toBe(monadTestnetDeployment.origin);
    for (let i = 1; i < 12; i++) expect((await f.request(body, { "x-forwarded-for": `fake-${i}` })).status).toBe(200);
    const blocked = await f.request(body, { "x-forwarded-for": "another-peer" });
    expect(blocked.status).toBe(429); expect(blocked.headers.get("retry-after")).toBe("60");
    expect(f.translate).toHaveBeenCalledTimes(12);
  });
  it("redacts unexpected dependency errors and preserves submitted transaction hashes", async () => {
    const f = app();
    f.translate.mockRejectedValueOnce(new Error("private-provider-credential"));
    const error = await f.request('{"assetId":"1","targetAppId":2}');
    expect(error.status).toBe(503); expect(await error.text()).not.toContain("private-provider-credential");
    f.translate.mockRejectedValueOnce(new RupaError("TX_STATUS_UNKNOWN", "Submitted", { txHash: zeroHash }));
    expect(await (await f.request('{"assetId":"1","targetAppId":2}')).json()).toMatchObject({ error: { code: "TX_STATUS_UNKNOWN", txHash: zeroHash } });
  });
  it("keeps the victory when the reward transaction fails", async () => {
    const f = fixture(), s = await f.login();
    f.demo.start(s.token, "test-peer");
    for (const move of ["strike", "guard", "strike"]) f.demo.play(s.token, "test-peer", move);
    f.actions.reward.mockRejectedValueOnce(new Error("rpc down"));
    await expect(f.demo.reward(s.token, "test-peer")).rejects.toThrow("rpc down");
    await expect(f.demo.reward(s.token, "test-peer")).resolves.toMatchObject({ minted: true });
    await expect(f.demo.reward(s.token, "test-peer")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(f.actions.reward).toHaveBeenCalledTimes(2);
  });
});
