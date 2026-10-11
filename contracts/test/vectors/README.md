# Test vectors

`protocol.json` is a synthetic public encoding vector shared by Solidity and TypeScript.
`dsl-jcs.json` is a synthetic RFC 8785 + keccak256 vector shared by `@rupa/mapping-dsl` and Foundry. Its addresses are illustrative, not deployment addresses. Regenerate only when intentionally changing the protocol encoding, after building the SDK:

```bash
node scripts/generate-protocol-vector.mjs
```

Browser passkey vectors are not yet recorded. Run the local capture app with `pnpm dev`, create a **test** passkey, capture an assertion, and review the downloaded public JSON before placing it here as `passkey-<browser>-<platform>.json`. No private key, biometric data, or credential store belongs in this directory.

The current capture app supports ES256 EC2 COSE keys with five fields, `getAuthenticatorData()`, and exact `type/challenge/origin` serialization with optional `crossOrigin:false`. Extra client-data fields or registration extensions fail closed. Record actual device/browser compatibility rather than assuming it.

Foundry unit tests sign synthetic assertions and use OpenZeppelin's Solidity P256 verifier etched at `0x0100`. They demonstrate local cryptographic verification, not Monad precompile availability or a physical authenticator ceremony.
