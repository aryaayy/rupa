import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { createPublicClient, http } from "viem";
import type { Address } from "viem";
import { createRupa, passkeyApproverAbi, rupaAssetAbi } from "@rupa/sdk";
import type { RupaDeployment } from "@rupa/sdk";

test("Arena → mint → Social and Gallery → real virtual-passkey approvals", async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", { options: {
    protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true,
    isUserVerified: true, automaticPresenceSimulation: true,
  } });
  const manifest = JSON.parse(await readFile(".local/deployment.json", "utf8")) as RupaDeployment & { apps: { arena: number; social: number; gallery: number } };
  const client = createPublicClient({ transport: http(manifest.rpcUrl), pollingInterval: 100 });
  const translates: number[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith("/translate") && request.method() === "POST") translates.push((request.postDataJSON() as { targetAppId: number }).targetAppId); });
  await page.goto("/arena");
  await page.getByRole("button", { name: "Create demo wallet", exact: true }).click();
  await expect(page.locator("#notice")).toContainText("Demo wallet created");
  const ready = () => expect(page.locator("#app")).toHaveAttribute("aria-busy", "false");
  await ready();
  await expect(page.locator(".wallet-panel")).toHaveAttribute("data-owner", /^0x[0-9a-fA-F]{40}$/);
  const owner = await page.locator(".wallet-panel").getAttribute("data-owner") as Address;
  await page.getByRole("button", { name: "Get demo MON", exact: true }).click();
  await expect(page.locator("#notice")).toContainText("Demo MON confirmed");
  async function win() {
    await page.getByRole("button", { name: "Start duel", exact: true }).click();
    await page.getByRole("button", { name: "Strike", exact: true }).click();
    await page.getByRole("button", { name: "Guard", exact: true }).click();
    await page.getByRole("button", { name: "Strike", exact: true }).click();
    await expect(page.locator("#notice")).toContainText("Victory!");
  }
  await win();
  await page.getByRole("button", { name: "Mint relic", exact: true }).click();
  await expect(page.locator("#notice")).toContainText("minted to your wallet");
  const minted = (await client.getContractEvents({ address: manifest.contracts.RupaAsset, abi: rupaAssetAbi, eventName: "AssetMinted", fromBlock: 0n, strict: true })).filter(log => log.args.to.toLowerCase() === owner.toLowerCase());
  expect(minted).toHaveLength(1); const assetId = minted[0]!.args.id;
  await page.getByRole("button", { name: "Register passkey", exact: true }).click();
  await expect(page.locator("#notice")).toContainText("Passkey registered onchain");
  await ready();
  for (const [route, label] of [["social", "Social"], ["gallery", "Gallery"]] as const) {
    await page.getByRole("navigation").getByRole("link", { name: label, exact: true }).click();
    await page.getByRole("button", { name: `Bring to ${label}`, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Approve with passkey", exact: true }).click();
    await expect(page.locator("#notice")).toContainText(`active in ${label}`);
    await ready();
    await expect(page.getByText("Hash chain verified ✓", { exact: true })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(`/${route}`);
  }
  const sdk = createRupa({ publicClient: client, deployment: manifest });
  const history = await sdk.getProvenance(assetId);
  expect(history.map(record => record.toAppId)).toEqual([manifest.apps.social, manifest.apps.gallery]);
  expect(await client.readContract({ address: manifest.contracts.RupaAsset, abi: rupaAssetAbi, functionName: "ownerOfAsset", args: [assetId] })).toBe(owner);
  expect(await client.readContract({ address: manifest.contracts.PasskeyApprover, abi: passkeyApproverAbi, functionName: "nonces", args: [owner] })).toBe(2n);
  expect(translates).toEqual([manifest.apps.social, manifest.apps.gallery]);
  // Fresh targets require separate mappings. Re-reading active forms must not request another translation.
  await page.getByRole("navigation").getByRole("link", { name: "Arena", exact: true }).click();
  await win();
  await page.getByRole("button", { name: "Record victory", exact: true }).click();
  await expect(page.locator("#notice")).toContainText("New WIN recorded");
  await ready();
  await page.getByRole("navigation").getByRole("link", { name: "Social", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fire Sword — 1 wins", exact: true })).toBeVisible();
  expect(translates).toHaveLength(2);
  await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
});

test("direct SPA routes, mobile navigation, docs and capture remain reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs");
  await expect(page.getByRole("heading", { name: "Build on the primitive.", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open passkey capture →", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Passkey capture", exact: true })).toBeVisible();
  await expect(page.locator("#owner")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
