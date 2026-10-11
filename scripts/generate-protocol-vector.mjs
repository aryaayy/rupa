import { writeFile } from "node:fs/promises";
import { approvalHash, hashPortRecord, base64url } from "../packages/sdk/dist/index.js";
import { hexToBytes, zeroHash } from "viem";

const input = {
  chainId: 10143n, ledger: "0x2222222222222222222222222222222222222222",
  owner: "0x1111111111111111111111111111111111111111",
  assetId: 42n, targetAppId: 2, mappingId: `0x${"ab".repeat(32)}`, nonce: 0n, deadline: 2000n,
};
const record = {
  assetId: 42n, fromAppId: 1, toAppId: 2, mappingId: input.mappingId, agentId: 7n,
  approver: input.owner, at: 1000n, prevRecord: zeroHash,
};
const hash = approvalHash(input);
const vector = { source: "synthetic-public-encoding-fixture-not-a-deployment", approval: input, approvalHash: hash, challenge: base64url(hexToBytes(hash)), record, recordId: hashPortRecord(record) };
await writeFile(new URL("../contracts/test/vectors/protocol.json", import.meta.url), `${JSON.stringify(vector, (_, value) => typeof value === "bigint" ? value.toString() : value, 2)}\n`);
console.log("Updated public ABI/base64 encoding vector; rerun Solidity and SDK vector tests.");
