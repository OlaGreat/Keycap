import { createWalletClient, createPublicClient, http, type Address } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { monadTestnet } from "./monad";

const STORAGE_KEY = "keycap.relayerPrivateKey";

/**
 * A local, browser-held EOA used only to pay gas and broadcast transactions.
 * It is NOT the account owner — it has no authority over PasskeyAccount funds
 * or session key permissions, both of which are gated entirely by the
 * passkey/session-key signatures embedded in each `execute()` call. Every EVM
 * transaction still needs *some* signer to originate it; this is that signer,
 * kept deliberately low-stakes (fund it with a small amount of testnet MON,
 * never more).
 */
function getOrCreateRelayerKey(): `0x${string}` {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing as `0x${string}`;
  const key = generatePrivateKey();
  localStorage.setItem(STORAGE_KEY, key);
  return key;
}

export const relayerAccount = privateKeyToAccount(getOrCreateRelayerKey());

export const relayerAddress: Address = relayerAccount.address;

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

export const relayerWalletClient = createWalletClient({
  account: relayerAccount,
  chain: monadTestnet,
  transport: http(),
});
