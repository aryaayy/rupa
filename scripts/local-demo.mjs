import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, defineChain, http, parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { mappingRegistryAbi, passkeyApproverAbi } from "../packages/sdk/dist/index.js";
import { createTranslationChain } from "../services/agent/dist/chain.js";
import { createDemoAccess, RELIC_TYPE, RELIC_TYPE_HASH } from "../services/agent/dist/demo.js";
import { createDemoActions } from "../services/agent/dist/demo-chain.js";
import { inlinePublisher, mockProvider } from "../services/agent/dist/provider.js";
import { createTranslator } from "../services/agent/dist/translator.js";
import { createAgentApp, nodeServer } from "../services/agent/dist/server.js";
import { registerDemo } from "../services/agent/dist/setup.js";
import { sha256, toBytes } from "viem";

const children = [];
let server;
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill("SIGTERM"); server?.close(); process.exitCode = code; }
process.on("SIGTERM", () => stop()); process.on("SIGINT", () => stop());
function child(command, args, options = {}) {
  const process = spawn(command, args, { stdio: "ignore", ...options });
  children.push(process);
  process.on("error", () => { console.error(`Unable to start ${command}.`); stop(1); });
  process.on("exit", (code, signal) => { if (!stopping) { console.error(`${command} exited before the demo finished (${signal || code}).`); stop(code || 1); } });
  return process;
}
try {
  const rpcUrl = "http://localhost:8545";
  const fork = process.env.RUPA_LOCAL_FORK_RPC_URL;
  // Always a disposable chain 31337. This script never submits a transaction to Monad.
  const anvil = child("anvil", ["--port", "8545", "--chain-id", "31337", "--hardfork", "cancun", "--silent", ...(fork ? ["--fork-url", fork] : [])]);
  const chain = defineChain({ id: 31337, name: "Rupa local Anvil", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
  const client = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 0, timeout: 1000 }), pollingInterval: 100 });
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (anvil.exitCode !== null || stopping) throw new Error("Anvil could not bind its local port.");
    try { ready = await client.getChainId() === 31337; if (ready) break; } catch { /* Bounded startup polling. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("Anvil startup timed out.");
  const accounts = await client.request({ method: "eth_accounts" });
  const admin = createWalletClient({ chain, transport: http(rpcUrl), account: accounts[0] });
  // Random signer lives only in this process; neither a committed key nor a shared browser key.
  const agent = createWalletClient({ chain, transport: http(rpcUrl), account: privateKeyToAccount(generatePrivateKey()) });
  const funding = await admin.sendTransaction({ to: agent.account.address, value: parseEther("10") });
  await client.waitForTransactionReceipt({ hash: funding });
  async function artifact(file, name) { return JSON.parse(await readFile(`contracts/out/${file}.sol/${name}.json`, "utf8")); }
  async function deploy(file, name, args = []) {
    const build = await artifact(file, name);
    const hash = await admin.deployContract({ abi: build.abi, bytecode: build.bytecode.object, args });
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`Local ${name} deployment failed.`);
    return receipt.contractAddress;
  }
  const identityRegistry = await deploy("CoreContracts.t", "IdentityMock", [agent.account.address]);
  const p256 = await artifact("P256TestVerifier", "P256TestVerifier");
  await client.request({ method: "anvil_setCode", params: ["0x0000000000000000000000000000000000000100", p256.deployedBytecode.object] });
  const contracts = {};
  contracts.AppRegistry = await deploy("AppRegistry", "AppRegistry");
  contracts.RupaAsset = await deploy("RupaAsset", "RupaAsset", [contracts.AppRegistry]);
  contracts.MappingRegistry = await deploy("MappingRegistry", "MappingRegistry", [contracts.AppRegistry, identityRegistry, admin.account.address]);
  contracts.PasskeyApprover = await deploy("PasskeyApprover", "PasskeyApprover", [sha256(toBytes("localhost")), "http://localhost:5173", admin.account.address]);
  contracts.PortLedger = await deploy("PortLedger", "PortLedger", [contracts.AppRegistry, contracts.RupaAsset, contracts.MappingRegistry, contracts.PasskeyApprover, parseEther("0.001"), admin.account.address, admin.account.address]);
  for (const [address, abi] of [[contracts.MappingRegistry, mappingRegistryAbi], [contracts.PasskeyApprover, passkeyApproverAbi]]) {
    const hash = await admin.writeContract({ address, abi, functionName: "bindLedger", args: [contracts.PortLedger] });
    await client.waitForTransactionReceipt({ hash });
  }
  const deployment = { chainId: 31337, rpcUrl, rpId: "localhost", origin: "http://localhost:5173", deploymentBlock: "0", contracts };
  const setup = await registerDemo({ publicClient: client, admin, agent, deployment, identityRegistry, publish: inlinePublisher, agentUrl: "http://localhost:8787", agentId: 1n });
  const translator = createTranslator({ chain: createTranslationChain({ publicClient: client, walletClient: agent, deployment, identityRegistry, agentId: 1n }), provider: mockProvider, publish: inlinePublisher, namespace: `31337:${contracts.MappingRegistry}`, types: { [RELIC_TYPE_HASH.toLowerCase()]: RELIC_TYPE } });
  const demo = createDemoAccess({ origin: deployment.origin, chainId: deployment.chainId, actions: createDemoActions({ publicClient: client, admin, funder: admin, deployment, arena: setup.apps.arena }) });
  server = nodeServer(createAgentApp({ config: { deployment, apps: setup.apps, agentId: setup.agentId, llmMode: "mock", faucet: true }, translator, demo }));
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(8787, "localhost", resolve); });
  await mkdir(".local", { recursive: true });
  await writeFile(".local/deployment.json", JSON.stringify({ ...deployment, ...setup, identityRegistry }, null, 2) + "\n");
  child("pnpm", ["--filter", "@rupa/web", "dev"], { stdio: "inherit" });
  console.log("Rupa local demo: http://localhost:5173 — mock LLM, local Identity fixture, real P256 math and local transactions. No Monad state is changed.");
} catch (error) { console.error(error instanceof Error ? error.message : "Local demo failed."); stop(1); }
