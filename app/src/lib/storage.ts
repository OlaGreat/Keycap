import type { Address } from "viem";

const KEY = "keycap.wallet";

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
