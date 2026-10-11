import { isAddress, keccak256, toBytes } from "viem";
import type { Address, Hex } from "viem";
import { assertionDigest, base64url, createPasskey, requestAssertion } from "../../../packages/sdk/src/index.js";
import type { RegisteredPasskey } from "../../../packages/sdk/src/index.js";
import "./style.css";

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const owner = element<HTMLInputElement>("owner");
const challenge = element<HTMLInputElement>("challenge");
const register = element<HTMLButtonElement>("register");
const capture = element<HTMLButtonElement>("capture");
const status = element<HTMLParagraphElement>("status");
const output = element<HTMLPreElement>("output");
const download = element<HTMLAnchorElement>("download");
const rpId = window.location.hostname;
challenge.value = keccak256(toBytes("RUPA_LOCAL_CAPTURE_ONLY"));
element("context").textContent = `Origin: ${window.location.origin} · RP ID: ${rpId}`;
let credential: RegisteredPasskey | undefined;
let objectUrl: string | undefined;

register.addEventListener("click", async () => {
  if (!isAddress(owner.value)) { status.textContent = "Enter a valid test owner address."; return; }
  register.disabled = true;
  capture.disabled = true;
  status.textContent = "Complete the passkey creation prompt on your device.";
  try {
    credential = await createPasskey({ rpId, owner: owner.value as Address });
    status.textContent = "Test passkey created. Capture an assertion next; no key was registered onchain.";
  } catch (error) { status.textContent = error instanceof Error ? error.message : "Unable to create credential."; }
  finally { register.disabled = false; capture.disabled = !credential; }
});

element<HTMLFormElement>("capture-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!credential) return;
  register.disabled = true;
  capture.disabled = true;
  status.textContent = "Complete the passkey approval prompt.";
  try {
    const assertion = await requestAssertion({ challenge: challenge.value as Hex, rpId, origin: location.origin, credentialId: credential.credentialId });
    const fixture = {
      source: "browser-capture", capturedAt: new Date().toISOString(), userAgent: navigator.userAgent,
      rpId, origin: location.origin, challenge: challenge.value,
      credentialId: base64url(credential.credentialId), credIdHash: credential.credIdHash,
      qx: credential.qx, qy: credential.qy, ...assertion, digest: assertionDigest(assertion),
    };
    const json = JSON.stringify(fixture, (_, value: unknown) => typeof value === "bigint" ? value.toString() : value, 2);
    output.textContent = json;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(new Blob([`${json}\n`], { type: "application/json" }));
    download.href = objectUrl;
    download.download = "passkey-browser.json";
    download.hidden = false;
    status.textContent = "Assertion captured and parsed. Download it for contract verification; this page has not verified it on Monad.";
  } catch (error) { status.textContent = error instanceof Error ? error.message : "Unable to capture assertion."; }
  finally { register.disabled = false; capture.disabled = false; }
});
