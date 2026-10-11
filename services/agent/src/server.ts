import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { object, parseJson } from "@rupa/mapping-dsl";
import type { Json } from "@rupa/mapping-dsl";
import { boundedText, RupaError } from "@rupa/sdk";
import type { RupaDeployment } from "@rupa/sdk";
import type { createDemoAccess } from "./demo.js";
import type { createTranslator } from "./translator.js";
import { RateLimiter } from "./limits.js";

export interface PublicConfig {
  deployment: RupaDeployment; apps: { arena: number; social: number; gallery: number };
  agentId: string; llmMode: "mock" | "openai-compatible"; faucet: boolean;
}
export function createAgentApp(options: { config: PublicConfig; translator: ReturnType<typeof createTranslator>; demo?: ReturnType<typeof createDemoAccess> }) {
  const rate = new RateLimiter();
  async function handle(request: Request, ip: string): Promise<Response> {
    const requestId = randomUUID(), origin = request.headers.get("origin");
    const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff", vary: "Origin" };
    if (origin === options.config.deployment.origin) { headers["access-control-allow-origin"] = origin; headers["access-control-allow-headers"] = "content-type, authorization"; headers["access-control-allow-methods"] = "GET, POST, OPTIONS"; }
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
    try {
      if (origin && origin !== options.config.deployment.origin) return json({ error: { code: "INVALID_REQUEST", message: "Origin is not allowed.", requestId } }, 403);
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
      rate.take(`ip:${ip}`, 90, 60_000);
      const path = new URL(request.url).pathname;
      if (request.method === "GET" && path === "/health") return json({ status: "ok", chainId: options.config.deployment.chainId, mode: options.config.llmMode });
      if (request.method === "GET" && path === "/config") return json(options.config);
      if (request.method === "GET" && path === "/.well-known/agent-card.json") return json({ name: "Rupa Translator", description: "Reusable, deterministically validated asset mapping rules", agentId: options.config.agentId, chainId: options.config.deployment.chainId, mode: options.config.llmMode, services: [{ name: "translation", endpoint: "/translate" }], supportedTrust: [] });
      if (request.method !== "POST") return json({ error: { code: "INVALID_REQUEST", message: "Route not found.", requestId } }, 404);
      if (!request.headers.get("content-type")?.startsWith("application/json")) throw new RupaError("INVALID_REQUEST", "Expected application/json.");
      let body: Json;
      try { body = parseJson(await boundedText(new Response(request.body, { headers: request.headers }))); }
      catch { throw new RupaError("INVALID_REQUEST", "Expected bounded JSON without duplicate or unsafe keys."); }
      if (!object(body)) throw new RupaError("INVALID_REQUEST", "Expected a JSON object.");
      if (path === "/translate") {
        rate.take(`translate:${ip}`, 12, 60_000);
        if (Object.keys(body).some(key => !["assetId", "targetAppId"].includes(key)) || typeof body.assetId !== "string" || !/^[1-9][0-9]{0,77}$/.test(body.assetId) || BigInt(body.assetId) >= 1n << 256n || !Number.isInteger(body.targetAppId) || Number(body.targetAppId) < 1 || Number(body.targetAppId) > 0xffffffff) throw new RupaError("INVALID_REQUEST", "Invalid source asset or target app ID.");
        return json(await options.translator.translate(BigInt(body.assetId), Number(body.targetAppId)));
      }
      const demo = options.demo;
      if (!demo) throw new RupaError("DEPENDENCY_UNAVAILABLE", "Demo admin actions are disabled.");
      const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
      if (path === "/demo/challenge") return json(demo.challenge(body.address, ip));
      if (path === "/demo/session") return json(await demo.authenticate(body.nonce, body.signature, ip));
      if (path === "/demo/fund") return json(await demo.fund(token, ip));
      if (path === "/demo/start") return json(demo.start(token, ip));
      if (path === "/demo/play") return json(demo.play(token, ip, body.move));
      if (path === "/demo/reward") return json(await demo.reward(token, ip));
      return json({ error: { code: "INVALID_REQUEST", message: "Route not found.", requestId } }, 404);
    } catch (error) {
      const safe = error instanceof RupaError ? error : new RupaError("DEPENDENCY_UNAVAILABLE", "Request could not be completed.");
      const status = safe.code === "RATE_LIMITED" ? 429 : safe.code === "INVALID_REQUEST" ? 400 : ["MAPPING_REJECTED", "UNSUPPORTED_ASSET"].includes(safe.code) ? 422 : safe.code === "SCHEMA_OUTDATED" ? 409 : 503;
      if (status === 429) headers["retry-after"] = "60";
      return json({ error: { code: safe.code, message: safe.message, requestId, ...(safe.txHash ? { txHash: safe.txHash } : {}) } }, status);
    }
  }
  return { handle };
}

export function nodeServer(app: ReturnType<typeof createAgentApp>) {
  return createServer({ maxHeaderSize: 16_384, requestTimeout: 15_000, headersTimeout: 10_000 }, async (req, res) => {
    try {
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 65_536) { res.writeHead(413); res.end("Request too large"); return; }
        chunks.push(Buffer.from(chunk));
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) if (typeof value === "string") headers.set(key, value);
      const body = Buffer.concat(chunks);
      const request = new Request(`http://localhost${req.url ?? "/"}`, { method: req.method ?? "GET", headers, ...(body.length ? { body } : {}) });
      const response = await app.handle(request, req.socket.remoteAddress ?? "unknown");
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
    } catch { res.writeHead(500, { "content-type": "application/json" }); res.end('{"error":{"code":"DEPENDENCY_UNAVAILABLE","message":"Request failed."}}'); }
  });
}
