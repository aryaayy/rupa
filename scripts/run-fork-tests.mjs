import { spawnSync } from "node:child_process";

if (!process.env.MONAD_RPC_URL) {
  console.error("NOT RUN: MONAD_RPC_URL is required for explicit Monad fork tests.");
  process.exit(1);
}
console.log("Fork results alone do not prove the remote node executes its native P256 precompile. Also run pnpm verify:monad for direct eth_call checks.");
const result = spawnSync("forge", ["test", "--root", "contracts", "--match-path", "test/fork/*", "--fork-url", process.env.MONAD_RPC_URL], { stdio: "inherit" });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
