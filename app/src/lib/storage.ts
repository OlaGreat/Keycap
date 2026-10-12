import type { Address } from "viem";
import { FACTORY_ADDRESS } from "./contracts";

// Scoped to the factory: accounts aren't upgradeable, so a contract change
// ships as a new factory, and an account from an older one must not be
// silently reused as if it had the new behavior.
const KEY = `keycap.wallet.${FACTORY_ADDRESS}`;
const AGENT_KEY = "keycap.agentAddress";

export interface StoredWallet {
  credentialId: string;
  publicKeyX: string;
  publicKeyY: string;
  accountAddress: Address;
}

export function loadWallet(): StoredWallet | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredWallet;
  } catch {
    return null;
  }
}

export function saveWallet(wallet: StoredWallet): void {
  localStorage.setItem(KEY, JSON.stringify(wallet));
}

export function loadAgentAddress(): string {
  return localStorage.getItem(AGENT_KEY) ?? "";
}

export function saveAgentAddress(address: string): void {
  localStorage.setItem(AGENT_KEY, address);
}
