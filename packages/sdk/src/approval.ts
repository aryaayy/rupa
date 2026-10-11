import { encodeAbiParameters, hexToBytes, keccak256 } from "viem";
import type { Address, Hex } from "viem";
import { RupaError } from "./errors.js";

export interface PortApproval {
  chainId: bigint;
  ledger: Address;
  owner: Address;
  assetId: bigint;
  targetAppId: number;
  mappingId: Hex;
  nonce: bigint;
  deadline: bigint;
}

export function approvalHash(input: PortApproval): Hex {
  try {
    return keccak256(encodeAbiParameters([
      { type: "string" }, { type: "uint256" }, { type: "address" },
      { type: "address" }, { type: "uint256" }, { type: "uint32" },
      { type: "bytes32" }, { type: "uint256" }, { type: "uint64" },
    ], [
      "RUPA_PORT_V1", input.chainId, input.ledger, input.owner, input.assetId,
      input.targetAppId, input.mappingId, input.nonce, input.deadline,
    ]));
  } catch (cause) {
    throw new RupaError("INVALID_REQUEST", "Invalid port approval fields.", { cause });
  }
}

export function approvalChallenge(input: PortApproval): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(hexToBytes(approvalHash(input)));
}
