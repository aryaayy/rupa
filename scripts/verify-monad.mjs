import { readFile } from "node:fs/promises";

const url = process.env.MONAD_RPC_URL;
if (!url) {
  console.error("NOT RUN: set MONAD_RPC_URL for explicit read-only Monad checks. No transactions are sent.");
  process.exit(1);
}
let requestId = 0;
async function rpc(method, params) {
  const response = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const json = await response.json();
  if (json.error || typeof json.result !== "string") throw new Error(`RPC ${method} failed`);
  return json.result;
}
try {
  if (BigInt(await rpc("eth_chainId", [])) !== 10143n) throw new Error("Wrong chain; expected 10143.");
  const block = await rpc("eth_blockNumber", []);
  for (const address of ["0x8004A818BFB912233c491871b3d84c89A494BD9e", "0x8004B663056A597Dffe9eCcC1965A193B7388713"]) {
    if (await rpc("eth_getCode", [address, block]) === "0x") throw new Error(`Registry has no bytecode: ${address}`);
  }
  // Public known-good vector quoted by OpenZeppelin P256; no key material required.
  const input = [
    "bb5a52f42f9c9261ed4361f59422a1e30036e7c32b270c8807a419feca605023",
    "5".padStart(64, "0"), "1".padStart(64, "0"),
    "a71af64de5126a4a4e02b7922d66ce9415ce88a4c9d25514d91082c8725ac957",
    "5d47723c8fbe580bb369fec9c2665d8e30a435b9932645482e7c9f11e872296b",
  ];
  const to = "0x0000000000000000000000000000000000000100";
  const valid = await rpc("eth_call", [{ to, data: `0x${input.join("")}` }, block]);
  if (valid !== `0x${"1".padStart(64, "0")}`) throw new Error("P256 known-good vector failed.");
  input[1] = "0".repeat(64);
  const invalid = await rpc("eth_call", [{ to, data: `0x${input.join("")}` }, block]);
  if (invalid !== "0x") throw new Error("Unexpected invalid-vector return.");
  console.log(JSON.stringify({ chainId: 10143, block, registryCode: "PASS", p256ValidAndInvalid: "PASS" }, null, 2));
  // Optional browser vector additionally proves a captured assertion's signature digest on the actual precompile.
  if (process.argv[2]) {
    const fixture = JSON.parse(await readFile(process.argv[2], "utf8"));
    const values = [fixture.digest.slice(2), ...[fixture.r, fixture.s, fixture.qx, fixture.qy].map(value => BigInt(value).toString(16).padStart(64, "0"))];
    const result = await rpc("eth_call", [{ to, data: `0x${values.join("")}` }, block]);
    if (result !== `0x${"1".padStart(64, "0")}`) throw new Error("Captured signature failed precompile verification.");
    console.log("PASS: captured digest signature; full ledger/nonce flow still requires integration testing.");
  }
} catch (error) {
  // Provider URLs can contain secrets; do not print nested fetch errors or the endpoint.
  console.error(`FAIL: ${error instanceof Error ? error.message : "verification failed"}`);
  process.exitCode = 1;
}
