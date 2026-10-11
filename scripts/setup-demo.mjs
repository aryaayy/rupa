import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnetDeployment } from "../packages/sdk/dist/index.js";
import { registerDemo } from "../services/agent/dist/setup.js";
import { inlinePublisher, pinataPublisher } from "../services/agent/dist/provider.js";

try {
  // These are separate demo/agent wallets, not the original protocol deployer's key.
  if (!process.env.DEMO_ADMIN_PRIVATE_KEY || !process.env.AGENT_PRIVATE_KEY || !process.env.AGENT_PUBLIC_URL) throw new Error("configuration");
  const d = monadTestnetDeployment;
  const chain = defineChain({ id: d.chainId, name: "Monad testnet", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [process.env.MONAD_RPC_URL || d.rpcUrl] } } });
  const client = createPublicClient({ chain, transport: http() });
  const admin = createWalletClient({ chain, transport: http(), account: privateKeyToAccount(process.env.DEMO_ADMIN_PRIVATE_KEY) });
  const agent = createWalletClient({ chain, transport: http(), account: privateKeyToAccount(process.env.AGENT_PRIVATE_KEY) });
  await mkdir(".local", { recursive: true });
  const checkpointFile = `.local/setup-${chain.id}-${admin.account.address}.json`;
  let checkpoint = {};
  try { checkpoint = JSON.parse(await readFile(checkpointFile, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const setup = await registerDemo({ publicClient: client, admin, agent, deployment: d, identityRegistry: d.identityRegistry,
    publish: process.env.PINATA_JWT ? pinataPublisher(process.env.PINATA_JWT) : inlinePublisher,
    agentUrl: process.env.AGENT_PUBLIC_URL, apps: checkpoint.apps, pending: checkpoint.pending,
    ...((process.env.AGENT_ID || checkpoint.agentId) ? { agentId: BigInt(process.env.AGENT_ID || checkpoint.agentId) } : {}),
    checkpoint: state => writeFile(checkpointFile, JSON.stringify(state, null, 2) + "\n"),
  });
  const output = process.env.RUPA_RUNTIME_FILE || "deployments/demo-monad-testnet.json";
  await writeFile(output, JSON.stringify({ ...d, ...setup, demoAdmin: admin.account.address, agentWallet: agent.account.address, agentUrl: process.env.AGENT_PUBLIC_URL }, null, 2) + "\n");
  console.log(`Public demo IDs written to ${output}. No protocol contract was deployed or rebound.`);
} catch (error) {
  console.error("Demo registration stopped. Check funded DEMO_ADMIN_PRIVATE_KEY/AGENT_PRIVATE_KEY in the local environment, AGENT_PUBLIC_URL, checkpoint, and RPC. Never send keys in chat or commit them.");
  if (error?.txHash) console.error(`Inspect transaction ${error.txHash} before retrying.`);
  process.exitCode = 1;
}
