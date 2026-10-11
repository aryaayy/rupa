import { createPublicClient, createWalletClient, defineChain, formatEther, http, keccak256, toBytes } from "viem";
import type { Address, Hex, PublicClient, WalletClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { base64url, createRupa, monadTestnetDeployment, passkeyApproverAbi, RupaError } from "@rupa/sdk";
import type { PortPreview, RegisteredPasskey, RupaAssetView, RupaDeployment } from "@rupa/sdk";
import { mountCapture } from "./capture.js";
import captureTemplate from "./capture-template.html?raw";
import "./style.css";

type AppConfig = { deployment: RupaDeployment; apps: { arena: number; social: number; gallery: number }; agentId: string; llmMode: string; faucet: boolean };
const root = document.querySelector<HTMLDivElement>("#app")!;
const agentUrl = (import.meta.env.VITE_AGENT_URL || "/api").replace(/\/$/, "");
const routes = ["arena", "social", "gallery", "docs", "capture"] as const;
const esc = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
let config: AppConfig | undefined, publicClient: PublicClient | undefined, walletClient: WalletClient | undefined;
let passkey: RegisteredPasskey | undefined, session = "", balance = "0", registered = false;
let assets: RupaAssetView[] = [], busy = false, notice = "Choose a form. Keep what you own.", failure = "", move: string | null = null, won = false;
let activeRoute = location.pathname.slice(1).split("/")[0] || "home";
let loadEpoch = 0;

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${agentUrl}${path}`, { method: body === undefined ? "GET" : "POST", headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(session ? { authorization: `Bearer ${session}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(65_000) });
  const result = await response.json();
  if (!response.ok) {
    const message = result.error?.message || "Demo service unavailable.";
    throw new Error(`${message}${result.error?.txHash ? ` Transaction: ${result.error.txHash}` : ""}`);
  }
  return result as T;
}
function sdk() {
  if (!config || !publicClient) throw new Error("Demo service is not connected yet.");
  return createRupa({ publicClient, ...(walletClient ? { walletClient } : {}), deployment: config.deployment, agentUrl, supportedAssetTypes: [keccak256(toBytes("rupa.weapon.sword"))] });
}
function storageKey(name: string) { return `rupa:${config?.deployment.chainId}:${config?.deployment.contracts.PortLedger}:${name}`; }
function keyStorage() { return storageKey(`passkey:${walletClient?.account?.address}`); }
function restorePasskey() {
  passkey = undefined;
  try {
    const saved = sessionStorage.getItem(keyStorage()); if (!saved) return;
    const value = JSON.parse(saved);
    passkey = { credentialId: Uint8Array.from(atob(value.credentialId.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0)), qx: BigInt(value.qx), qy: BigInt(value.qy), credIdHash: value.credIdHash };
  } catch { sessionStorage.removeItem(keyStorage()); }
}
function persistPasskey(key: RegisteredPasskey) {
  sessionStorage.setItem(keyStorage(), JSON.stringify({ credentialId: base64url(key.credentialId), qx: key.qx.toString(), qy: key.qy.toString(), credIdHash: key.credIdHash })); passkey = key;
}
function restoreWallet(secret: Hex) {
  if (!config) return;
  const d = config.deployment;
  const chain = defineChain({ id: d.chainId, name: d.chainId === 10143 ? "Monad testnet" : "Local Anvil", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [import.meta.env.VITE_MONAD_RPC_URL || d.rpcUrl] } } });
  walletClient = createWalletClient({ chain, transport: http(), account: privateKeyToAccount(secret) });
  sessionStorage.setItem(storageKey("burner"), secret); restorePasskey();
}
async function signIn() {
  if (!walletClient?.account) throw new Error("Create a demo wallet first.");
  const challenge = await api<{ nonce: string; message: string }>("/demo/challenge", { address: walletClient.account.address });
  const signature = await walletClient.signMessage({ account: walletClient.account, message: challenge.message });
  session = (await api<{ token: string }>("/demo/session", { nonce: challenge.nonce, signature })).token;
}
async function refresh() {
  const epoch = ++loadEpoch;
  assets = [];
  if (!["arena", "social", "gallery"].includes(activeRoute)) return;
  if (!walletClient?.account || !config || !publicClient) return;
  const account = walletClient.account.address;
  balance = formatEther(await publicClient.getBalance({ address: account }));
  const key = await publicClient.readContract({ address: config.deployment.contracts.PasskeyApprover, abi: passkeyApproverAbi, functionName: "keyOf", args: [account] });
  registered = key[2] !== `0x${"0".repeat(64)}`;
  const target = config.apps[activeRoute as "arena" | "social" | "gallery"];
  if (target) { const result = await sdk().getAssetsFor(account, target); if (epoch === loadEpoch) assets = result; }
}
function status(message: string) { notice = message; const node = document.querySelector("#notice"); if (node) node.textContent = message; }
async function run(action: () => Promise<void>) {
  if (busy) return;
  busy = true; failure = ""; render();
  try {
    await action();
    // The action already succeeded; a failed balance/asset refresh must not report it as failed.
    try { await refresh(); } catch { status(`${notice} Balance refresh failed; reload to update.`); }
  }
  catch (error) {
    failure = error instanceof RupaError ? `${error.code}: ${error.message}${error.txHash ? ` Transaction: ${error.txHash}` : ""}` : error instanceof Error ? error.message : "Unable to complete the action.";
    notice = "That action did not complete. See the error below.";
  } finally { busy = false; render(); }
}
function button(label: string, action: string, disabled = false, className = "") {
  return `<button class="${className}" data-action="${action}" ${busy || disabled ? "disabled" : ""}>${label}</button>`;
}
const sword = `<svg viewBox="0 0 240 280" fill="none" aria-hidden="true"><path d="M136 28 167 63 114 185 94 176Z" fill="#F6E7C8"/><path d="m136 28 10 51-44 105-8-8Z" fill="#FFF9ED"/><path d="m76 164 59 26-8 18-59-26Z" fill="#F2673B"/><path d="m87 186 24 11-21 48-24-11Z" fill="#DCA249"/><path d="m66 230 24 11-7 19-26-12Z" fill="#F2673B"/><path d="m112 55-11-21M166 108l22-4M52 134l19 7" stroke="#DCA249" stroke-width="3" stroke-linecap="round"/></svg>`;
function art(kind: string, color = "#F2673B") {
  const safeColor = ["#F2673B", "#4FC3F7", "#A49AFF"].includes(color) ? color : "#F2673B";
  return `<div class="relic-art ${kind}" style="--relic-color:${safeColor}"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>${sword}<span class="art-index">R / 001</span></div>`;
}
function walletPanel() {
  const address = walletClient?.account?.address;
  return `<aside class="wallet-panel" data-owner="${address || ""}"><div><span class="eyebrow">Your demo wallet</span><strong>${address ? esc(short(address)) : "Start with a fresh wallet"}</strong><span class="muted">${address ? `${esc(Number(balance).toFixed(4))} MON · this browser tab` : "No extension or shared credentials needed."}</span></div><div class="actions">${!address ? button("Create demo wallet", "wallet", !config) : `${config?.faucet ? button("Get demo MON", "fund", false, "secondary") : '<a class="button secondary" href="https://faucet.monad.xyz" target="_blank" rel="noopener noreferrer">Monad faucet ↗</a>'}${button(registered && !passkey ? "Replace passkey" : passkey ? "Passkey registered ✓" : "Register passkey", "register", !!passkey, "secondary")}`}</div><p class="fine">Temporary testnet wallet stored in this tab. Use only demo funds. Passkeys stay on your device.</p></aside>`;
}
function timeline(asset: RupaAssetView) {
  if (!asset.provenance.length) return '<p class="muted">Origin recorded in Arena. No ports yet.</p>';
  const appName = (id: number) => config && Object.entries(config.apps).find(([, value]) => value === id)?.[0] || `App ${id}`;
  return `<div class="provenance"><h3>Provenance <span class="verified">Hash chain verified ✓</span></h3><ol>${asset.provenance.map(record => `<li><span class="timeline-dot"></span><div><strong>${esc(appName(record.fromAppId))} → ${esc(appName(record.toAppId))}</strong><span>Agent #${record.agentId} · schema v${record.mappingSchemaVersion} · approved by ${esc(short(record.approver))}</span><span>${new Date(Number(record.at) * 1000).toLocaleString()} · record ${esc(short(record.recordId))}</span>${config?.deployment.chainId === 10143 ? `<a href="${monadTestnetDeployment.explorerUrl}/tx/${record.transactionHash}" target="_blank" rel="noopener noreferrer">View transaction ↗</a>` : '<span>Local Anvil transaction</span>'}</div></li>`).join("")}</ol></div>`;
}
function assetCard(asset: RupaAssetView, kind: string) {
  const title = asset.view?.title || asset.attrs.name || `Relic #${asset.assetId}`;
  const color = typeof asset.view?.color === "string" ? asset.view.color : "#F2673B";
  return `<article class="asset-card" data-testid="asset-${asset.assetId}"><div>${art(kind, color)}<div class="asset-title"><span class="eyebrow">${esc(kind)} form · asset #${asset.assetId}</span><h2>${esc(title)}</h2><span class="pill">${esc(asset.status)}</span><span class="tier">${esc(asset.view?.tier || "gold")}</span></div></div><div class="asset-detail"><h3>Same relic. A new context.</h3><p>${kind === "social" ? "Your Arena relic becomes a profile badge. Its title follows your wins." : "An artwork with an origin you can trace. Every approved form stays connected."}</p>${asset.activation?.approvedByPreviousOwner ? '<p class="warning">This form was approved by a previous owner. You can approve it again.</p>' : ""}${asset.reason ? `<p class="muted">${esc(asset.reason)}</p>` : ""}${asset.status === "active" && !asset.activation?.approvedByPreviousOwner ? '<p class="active-state">Active in this app ✓</p>' : button(`Bring to ${kind === "social" ? "Social" : "Gallery"}`, `port:${asset.assetId}`, !passkey || asset.status === "unsupported")}${!passkey ? '<p class="fine">Register your passkey above before bringing this relic here.</p>' : ""}${timeline(asset)}</div></article>`;
}
function landing() {
  return `<section class="hero"><div><p class="eyebrow">Portable meaning, on Monad</p><h1>One asset.<br><em>Every form.</em></h1><p class="lede">Win a relic. Wear it as a badge. Collect it as art.<br>Its form changes. Your ownership stays.</p><div class="actions"><a class="button" href="/arena" data-route>Enter Arena <span>↗</span></a><a class="text-link" href="/docs" data-route>Build with Rupa →</a></div><p class="fine">A live protocol, demonstrated through three small apps.</p></div><div class="hero-object">${art("hero-art")}<span class="object-caption">FIRE SWORD / MANY POSSIBILITIES</span></div></section><section class="form-grid"><a href="/arena" data-route><span>01 / ORIGIN</span><h2>Arena</h2><p>Earn something worth bringing with you.</p><b>Play the duel ↗</b></a><a href="/social" data-route><span>02 / IDENTITY</span><h2>Social</h2><p>A profile badge that carries your history.</p><b>Find your form ↗</b></a><a href="/gallery" data-route><span>03 / COLLECTION</span><h2>Gallery</h2><p>Artwork with a verifiable trail.</p><b>Open the gallery ↗</b></a></section><section class="judge-path"><h2>A short path for judges</h2><p>Create a temporary wallet → get test MON → win in Arena → register a passkey → bring your relic to Social and Gallery.</p><p class="muted">The original asset stays in your wallet. Each port records an owner approval and a verifiable history.</p></section>`;
}
function arena() {
  return `<section class="page-heading"><p class="eyebrow">01 / The origin</p><h1>Earn your first form.</h1><p>A three-move training duel. Read the guardian, then make your move.</p></section>${walletPanel()}<section class="arena-grid"><div class="guardian panel"><span class="eyebrow">Training guardian</span><div class="guardian-mark">✦</div><h2>${won ? "Victory. Relic unlocked." : move ? move === "strike" ? "An opening. Strike now." : "Incoming flame. Raise your guard." : "A relic waits on the other side."}</h2><p class="muted">${won ? "Claim the Fire Sword, or record a new win for a relic you already own." : "Strike → Guard → Strike. Your progress is checked by the demo service."}</p><div class="actions">${!move && !won ? button("Start duel", "start", !walletClient) : won ? button(assets.length ? "Record victory" : "Mint relic", "reward") : `${button("Strike", "move:strike")}${button("Guard", "move:guard", false, "secondary")}`}</div></div><div class="arena-relic">${art("arena")}<div><span class="eyebrow">${assets.length ? `In your wallet · asset #${assets[0]!.assetId}` : "Your reward"}</span><h2>Fire Sword</h2><p class="muted">${assets.length ? "Ready for a different life in Social and Gallery." : "One canonical relic. Gold rarity. Fire element."}</p>${assets.length ? '<a class="button" href="/social" data-route>Continue to Social →</a>' : ""}</div></div></section>`;
}
function consumer(kind: "social" | "gallery") {
  return `<section class="page-heading"><p class="eyebrow">${kind === "social" ? "02 / Identity" : "03 / Collection"}</p><h1>${kind === "social" ? "Your history. Your badge." : "A collection with a story."}</h1><p>${kind === "social" ? "Bring a relic into your profile, with rules you can inspect and a passkey approval you control." : "See the same relic as an artwork. Follow every approved form back to its origin."}</p></section>${walletPanel()}${assets.length ? assets.map(asset => assetCard(asset, kind)).join("") : '<section class="empty panel"><span class="empty-mark">◇</span><h2>Your next form starts in Arena.</h2><p>Create a demo wallet and earn your Fire Sword first.</p><a class="button secondary" href="/arena" data-route>Go to Arena →</a></section>'}`;
}
function docs() {
  const snippet = `import { createRupa } from "@rupa/sdk";\n\nconst rupa = createRupa({ publicClient, walletClient, agentUrl });\nconst key = await rupa.passkey.register();\nconst assets = await rupa.getAssetsFor(wallet, appId);\nawait rupa.port(assets[0].assetId, appId, key, {\n  onReview: preview => showApprovalDialog(preview),\n  onStep: step => setStatus(step),\n});\nconst history = await rupa.getProvenance(assets[0].assetId);`;
  return `<section class="page-heading"><p class="eyebrow">For the next app</p><h1>Build on the primitive.</h1><p>Rupa connects asset meaning through reusable rules, owner approval, and provenance.</p></section><div class="docs-grid"><section class="panel"><h2>A small integration surface</h2><p>Install the workspace package or a local SDK tarball. Provide viem public and wallet clients, a registered app ID, and your agent URL.</p><pre>${esc(snippet)}</pre><p class="fine">The deployed passkey is bound to <strong>rupa-mu.vercel.app</strong>. Read methods work elsewhere; approvals must use the matching origin. Local tests use a separate localhost deployment.</p><h3>Mapping rules, not generated assets</h3><p>The model produces a reusable rule. Both the agent and SDK validate it against the target schema on every execution. A cached mapping belongs to a specific asset type, target app, and schema version.</p><h3>Errors are part of the API</h3><p>Handle cancellation, ownership changes, stale schemas, content hash mismatches, and unknown transaction status. Keep a returned transaction hash before retrying.</p></section><aside class="panel"><h2>Monad deployment</h2><p>Chain 10143 · WebAuthn/P256</p><dl class="contracts">${Object.entries(monadTestnetDeployment.contracts).map(([name, address]) => `<dt>${name}</dt><dd><a href="${monadTestnetDeployment.explorerUrl}/address/${address}" target="_blank" rel="noopener noreferrer">${address}</a></dd>`).join("")}</dl><p>Windows Hello verification was confirmed by the project owner. The full demo has separate setup and test requirements.</p><a class="text-link" href="/capture" data-route>Open passkey capture →</a><hr><h3>Run locally</h3><pre>pnpm install\npnpm demo\npnpm test:e2e</pre><p class="fine">Local mode uses Anvil, an identity fixture, mock LLM rules and a Solidity P256 verifier. It is labeled separately from Monad.</p></aside></div>`;
}
function developerPanel() {
  if (!config || ["home", "docs", "capture"].includes(activeRoute)) return "";
  return `<details class="developer"><summary>Developer view <span>SDK · mappings · provenance</span></summary><div><p>Chain ${config.deployment.chainId} · agent #${esc(config.agentId)} · ${esc(config.llmMode)} provider</p><pre>const assets = await rupa.getAssetsFor(wallet, appId);\nconst history = await rupa.getProvenance(assetId);</pre><p class="fine">Gallery has its own mapping. Its first port requests rules unless that exact pair was prepared earlier. Repeat ports reuse the active mapping. No reputation score is claimed.</p></div></details>`;
}
function render() {
  root.setAttribute("aria-busy", String(busy));
  root.innerHTML = `<header class="topbar"><a class="brand" href="/" data-route aria-label="Rupa home"><span class="brand-mark">r</span>rupa<span class="brand-period">.</span></a><nav aria-label="Main navigation">${["arena", "social", "gallery", "docs"].map(route => `<a href="/${route}" data-route ${activeRoute === route ? 'aria-current="page"' : ""}>${route[0]!.toUpperCase()}${route.slice(1)}</a>`).join("")}</nav><span class="network"><i></i>${config?.deployment.chainId === 31337 ? "Local demo" : "Monad testnet"}</span></header><main>${activeRoute === "home" ? landing() : activeRoute === "arena" ? arena() : activeRoute === "social" || activeRoute === "gallery" ? consumer(activeRoute) : activeRoute === "capture" ? captureTemplate : docs()}<div class="messages"><p id="notice" role="status" aria-live="polite">${esc(notice)}</p>${failure ? `<p class="error" role="alert">${esc(failure)}</p>` : ""}</div>${developerPanel()}</main><footer><span>Rupa · One asset. Every form.</span><a href="/capture" data-route>Passkey capture</a><a href="https://github.com/aryaayy/rupa" target="_blank" rel="noopener noreferrer">GitHub ↗</a></footer>`;
  if (activeRoute === "capture") mountCapture();
}
async function review(preview: PortPreview): Promise<boolean> {
  return new Promise(resolve => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.createElement("dialog"); dialog.className = "approval-dialog";
    dialog.innerHTML = `<form method="dialog"><p class="eyebrow">Review your next form</p><h2>Bring this relic here?</h2><p>${esc(preview.view.title)}</p><dl><dt>Target app</dt><dd>${preview.targetAppId}</dd><dt>Agent / schema</dt><dd>#${preview.agentId} / v${preview.schemaVersion}</dd><dt>Port fee</dt><dd>${formatEther(preview.fee)} MON + gas</dd><dt>Mapping</dt><dd>${esc(short(preview.mappingId))}</dd></dl><p class="fine">Your ownership stays the same. Your passkey approves this specific port.</p><div class="actions"><button value="approve">Approve with passkey</button><button value="cancel" class="secondary">Cancel</button></div></form>`;
    document.body.append(dialog);
    dialog.addEventListener("close", () => { const approved = dialog.returnValue === "approve"; dialog.remove(); previous?.focus(); resolve(approved); }, { once: true });
    dialog.showModal();
  });
}
root.addEventListener("click", event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action]"); if (!button || button.disabled) return;
  const action = button.dataset.action!;
  void run(async () => {
    if (action === "wallet") { restoreWallet(generatePrivateKey()); await signIn(); status("Demo wallet created. Get test MON, then play the duel."); }
    else if (action === "fund") { if (!session) await signIn(); const result = await api<{ txHash: string }>("/demo/fund", {}); status(`Demo MON confirmed. Transaction ${short(result.txHash)}.`); }
    else if (action === "register") { status("Complete the passkey prompt, then wait for registration onchain."); persistPasskey(await (registered ? sdk().passkey.rotate() : sdk().passkey.register())); status("Passkey registered onchain. You can approve new forms."); }
    else if (action === "start") { if (!session) await signIn(); const result = await api<{ move: string }>("/demo/start", {}); move = result.move; won = false; status("Duel started. Read the guardian's next move."); }
    else if (action.startsWith("move:")) { const result = await api<{ move: string | null; won: boolean }>("/demo/play", { move: action.slice(5) }); move = result.move; won = result.won; status(won ? "Victory! Claim your reward." : move ? "Good move. Stay focused." : "The guardian won. Start another duel."); }
    else if (action === "reward") { const result = await api<{ assetId: string; minted: boolean }>("/demo/reward", {}); won = false; move = null; status(result.minted ? `Relic #${result.assetId} minted to your wallet.` : `New WIN recorded for relic #${result.assetId}. Refresh Social to see its title change.`); }
    else if (action.startsWith("port:")) {
      if (!passkey || !config) throw new Error("Register a passkey first.");
      const target = config.apps[activeRoute as "social" | "gallery"];
      const labels = { "mapping:cached": "Using this app's cached mapping.", "mapping:requesting": "Requesting a reusable mapping rule…", "passkey:prompt": "Approve this port with your passkey.", "tx:sent": "Port submitted. Waiting for confirmation…", "tx:confirmed": "Port confirmed. Verifying provenance…" };
      await sdk().port(BigInt(action.slice(5)), target, passkey, { onReview: review, onStep: step => status(labels[step]) });
      status(`Relic is active in ${activeRoute === "social" ? "Social" : "Gallery"}. Ownership is unchanged.`);
    }
  });
});
document.addEventListener("click", event => {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-route]");
  if (!link || event.defaultPrevented || (event as MouseEvent).metaKey || (event as MouseEvent).ctrlKey || busy) { if (link && busy) event.preventDefault(); return; }
  event.preventDefault(); history.pushState({}, "", link.href); void navigate();
});
async function navigate() {
  activeRoute = location.pathname.slice(1).split("/")[0] || "home";
  if (activeRoute !== "home" && !routes.includes(activeRoute as typeof routes[number])) activeRoute = "docs";
  failure = ""; assets = []; busy = true; render();
  try { await refresh(); } catch (error) { failure = error instanceof Error ? error.message : "Unable to load assets."; }
  finally { busy = false; }
  render(); window.scrollTo(0, 0);
}
window.addEventListener("popstate", () => { if (!busy) void navigate(); });
render();
void (async () => {
  try {
    config = await api<AppConfig>("/config");
    if (![config.apps.arena, config.apps.social, config.apps.gallery].every(id => Number.isInteger(id) && id > 0)) throw new Error("Demo app registration is incomplete.");
    const d = config.deployment;
    publicClient = createPublicClient({ transport: http(import.meta.env.VITE_MONAD_RPC_URL || d.rpcUrl), pollingInterval: 500 });
    const saved = sessionStorage.getItem(storageKey("burner"));
    if (saved) restoreWallet(saved as Hex);
    await refresh();
    notice = d.chainId === 31337 ? "Local demo · mock LLM · real local transactions and P256 verification." : `Monad testnet · ${config.llmMode === "mock" ? "mock LLM rules" : "configured LLM provider"}.`;
  } catch { failure = "The demo service is unavailable. Try again later. Contract details and passkey capture are available in Docs."; }
  if (activeRoute !== "capture") render();
})();
