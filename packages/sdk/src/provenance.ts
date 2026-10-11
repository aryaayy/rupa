import { encodeAbiParameters, keccak256, zeroHash } from "viem";
import type { Address, Hex } from "viem";
import { RupaError } from "./errors.js";

export interface PortRecord {
  assetId: bigint;
  fromAppId: number;
  toAppId: number;
  mappingId: Hex;
  agentId: bigint;
  approver: Address;
  at: bigint;
  prevRecord: Hex;
}

export function hashPortRecord(record: PortRecord): Hex {
  return keccak256(encodeAbiParameters([{ type: "tuple", components: [
    { name: "assetId", type: "uint256" }, { name: "fromAppId", type: "uint32" },
    { name: "toAppId", type: "uint32" }, { name: "mappingId", type: "bytes32" },
    { name: "agentId", type: "uint256" }, { name: "approver", type: "address" },
    { name: "at", type: "uint64" }, { name: "prevRecord", type: "bytes32" },
  ] }], [record]));
}

/** Verify complete, ordered records against a head read from the same chain snapshot. */
export function verifyProvenance(records: readonly (PortRecord & { recordId: Hex })[], expectedHead: Hex, assetId: bigint): void {
  let head: Hex = zeroHash;
  let previous: PortRecord | undefined;
  try {
    for (const record of records) {
      if (record.assetId !== assetId || record.prevRecord.toLowerCase() !== head.toLowerCase()) throw new Error("Broken predecessor or asset ID.");
      if (previous && (record.fromAppId !== previous.toAppId || record.at < previous.at)) throw new Error("Invalid record order.");
      const computed = hashPortRecord(record);
      if (computed.toLowerCase() !== record.recordId.toLowerCase()) throw new Error("Record hash mismatch.");
      head = computed;
      previous = record;
    }
    if (head.toLowerCase() !== expectedHead.toLowerCase()) throw new Error("Incomplete history or mismatched head.");
  } catch (cause) {
    throw new RupaError("PROVENANCE_INVALID", "Provenance does not match the ledger head.", { cause });
  }
}
