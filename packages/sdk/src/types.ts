import type { Address, Hex, PublicClient, WalletClient } from "viem";
import type { AssetContext, JsonObject } from "@rupa/mapping-dsl";
import type { PasskeyAssertion, RegisteredPasskey } from "./passkey.js";
import type { PortRecord } from "./provenance.js";

export interface RupaDeployment {
  chainId: number; rpcUrl: string; rpId: string; origin: string; deploymentBlock?: string | null;
  contracts: { AppRegistry: Address; RupaAsset: Address; MappingRegistry: Address; PasskeyApprover: Address; PortLedger: Address };
}
export type ProvenanceRecord = PortRecord & { recordId: Hex; transactionHash: Hex; blockNumber: bigint; mappingSchemaVersion: bigint };
export type AssetBase = { assetType: Hex; rarity: number; originAppId: number; createdAt: bigint; attrsHash: Hex };
export type MappingData = { assetType: Hex; targetAppId: number; targetSchemaVersion: bigint; agentId: bigint; contentHash: Hex; contentURI: string; createdAt: bigint; approvals: number; revoked: boolean };
export interface RupaAssetView {
  assetId: bigint; status: "active" | "portable" | "unsupported"; base: AssetBase; attrs: JsonObject;
  origin: { appId: number }; provenance: ProvenanceRecord[]; view?: JsonObject; reason?: string;
  mapping?: { id: Hex; schemaVersion: bigint; agentId: bigint };
  activation?: { mappingId: Hex; approver: Address; approvedByPreviousOwner: boolean };
}
export type PortStep = "mapping:cached" | "mapping:requesting" | "passkey:prompt" | "tx:sent" | "tx:confirmed";
export type PortPreview = { assetId: bigint; targetAppId: number; mappingId: Hex; agentId: bigint; schemaVersion: bigint; fee: bigint; view: JsonObject };
export interface PortOptions {
  onStep?: (step: PortStep, detail?: { txHash: Hex }) => void;
  onReview?: (preview: PortPreview) => Promise<boolean>;
}
export interface RupaConfig {
  publicClient: PublicClient; walletClient?: WalletClient; deployment?: RupaDeployment; appId?: number;
  agentUrl?: string; logRange?: bigint; fetch?: typeof fetch;
  content?: (uri: string, hash: Hex) => Promise<JsonObject>;
  contentOrigins?: readonly string[]; ipfsGateway?: string;
  supportedAssetTypes?: readonly Hex[];
  webauthn?: {
    create: (options: { rpId: string; owner: Address }) => Promise<RegisteredPasskey>;
    get: (options: { challenge: Hex; rpId: string; origin: string; credentialId: Uint8Array<ArrayBuffer> }) => Promise<PasskeyAssertion>;
  };
}
export type LoadedAsset = { base: AssetBase; owner: Address; attrs: JsonObject; context: AssetContext };
