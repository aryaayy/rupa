export interface AssetContext {
  base: { rarity: number } & Record<string, unknown>;
  attrs: Record<string, unknown>;
  history: { wins: number } & Record<string, unknown>;
}

export interface MappingRule {
  target: string;
  const?: unknown;
  from?: string;
  map?: Record<string, unknown>;
  template?: string;
  default?: unknown;
}

export interface MappingDocument {
  rupa: "mapping/v1";
  assetType: string;
  targetAppId: number;
  targetSchemaVersion: number;
  rules: MappingRule[];
  rationale?: string;
}

export interface ApplyMappingOptions {
  targetSchema: object;
  expectedMappingHash?: `0x${string}`;
  expectedSchemaHash?: `0x${string}`;
  expectedAttrsHash?: `0x${string}`;
}
