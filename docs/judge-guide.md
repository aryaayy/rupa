# Judge guide

The existing contracts and Windows Hello verification are confirmed by the project owner at **https://rupa-mu.vercel.app**. The newly built complete demo has not been deployed or tested through the browser here. Live app and agent registration is still required.

## Try the local demo

Run `pnpm install --frozen-lockfile` and `pnpm demo`, then open **http://localhost:5173/arena**. Use localhost exactly. A browser with WebAuthn user verification is required; no wallet extension or shared credentials are needed.

1. Select **Create demo wallet**, then **Get demo MON**. The burner is unique to your tab. Keep the tab open; use only demo funds.
2. Select **Start duel**, then **Strike → Guard → Strike**.
3. Select **Mint relic**. Wait for the confirmed Fire Sword in your wallet.
4. Select **Register passkey** and complete your device prompt. Registration is a wallet transaction.
5. Open **Social**, select **Bring to Social**, review the mapping/agent/schema/fee, then **Approve with passkey**.
6. Inspect the active badge and verified provenance timeline. Open **Gallery** and repeat the review/approval for its artwork form.
7. Return to Arena and win again. Select **Record victory**, then revisit Social: the title shows one WIN with no new rule generation.

The mint earns the relic; subsequent victories create Used(WIN) events, so its initial mapped title has zero recorded wins. Both Social and Gallery need their own mapping on a fresh chain. Reusing either active pair avoids another translation.

Local mode clearly identifies mock LLM rules, an identity fixture and local transactions. The P256 verifier performs real signature math. No local action changes Monad.

## Inspect the protocol

The asset ID and owner stay the same across forms. Timeline entries show source/target app, agent, schema version, approver, block time and record hash. Monad entries link to transactions. The developer panel explains mapping reuse; no reputation score is invented.

Use /docs for integration code and deployed addresses. The original passkey capture tool is still at /capture. These routes remain accessible without the agent backend.

## Recovery

| Symptom | Action |
| --- | --- |
| Demo unavailable | Operator must register apps/agent and connect the hosted service |
| No gas | Use the bounded demo faucet, or the public Monad faucet when enabled for Monad |
| Passkey cancelled | Retry from the same origin when ready |
| Wrong origin | Use the deployment's exact HTTPS domain; local credentials belong to localhost |
| Stale/revoked mapping | Refresh and review the replacement mapping |
| Transaction status unknown | Inspect the returned hash before submitting again |
| Faucet/session limited | Wait for the indicated limit; operators should inspect quotas |
| New tab loses burner | Create a new demo wallet; no shared recovery key is published |

Desktop Windows Hello is owner-confirmed. Additional devices and the new end-to-end product flow still require verification. Live provider, agent hosting and pinning choices remain open; these are setup requirements, not judge credentials.
