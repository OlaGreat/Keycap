import { encodeAbiParameters, encodeFunctionData, type Address, type Hex } from "viem";
import { hashCall, type Call } from "./callHash";
import { signWithPasskey, type WebAuthnAuth } from "./webauthn";
import { publicClient, relayerWalletClient } from "./relayer";
import { FACTORY_ADDRESS, PasskeyAccountFactoryAbi, PasskeyAccountAbi } from "./contracts";
import { monadTestnet } from "./monad";

const webAuthnAuthTupleType = {
  type: "tuple",
  components: [
    { name: "authenticatorData", type: "bytes" },
    { name: "clientDataJSON", type: "string" },
    { name: "challengeIndex", type: "uint256" },
    { name: "typeIndex", type: "uint256" },
    { name: "r", type: "uint256" },
    { name: "s", type: "uint256" },
  ],
} as const;

/**
 * Matches PasskeyAccount.execute()'s `abi.decode(auth.signature, (WebAuthn.WebAuthnAuth))`
 * exactly — verified byte-for-byte against `cast abi-encode` before relying on it.
 */
function encodeWebAuthnAuth(auth: WebAuthnAuth): Hex {
  return encodeAbiParameters([webAuthnAuthTupleType], [auth]);
}

export async function predictAccountAddress(publicKeyX: bigint, publicKeyY: bigint, salt: bigint): Promise<Address> {
  return publicClient.readContract({
    address: FACTORY_ADDRESS,
    abi: PasskeyAccountFactoryAbi,
    functionName: "getAddress",
    args: [publicKeyX, publicKeyY, salt],
  });
}

export async function createAccount(publicKeyX: bigint, publicKeyY: bigint, salt: bigint): Promise<Address> {
  const hash = await relayerWalletClient.writeContract({
    address: FACTORY_ADDRESS,
    abi: PasskeyAccountFactoryAbi,
    functionName: "createAccount",
    args: [publicKeyX, publicKeyY, salt],
    chain: monadTestnet,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return predictAccountAddress(publicKeyX, publicKeyY, salt);
}

export async function getOwnerNonce(account: Address): Promise<bigint> {
  return publicClient.readContract({
    address: account,
    abi: PasskeyAccountAbi,
    functionName: "getOwnerNonce",
  });
}

/**
 * Signs `call` with the owner's passkey and submits it via the relayer. The
 * relayer only pays gas and broadcasts — authorization comes entirely from
 * the embedded WebAuthn signature, verified on-chain against the owner's P256
 * public key.
 */
export async function executeAsOwner(account: Address, credentialId: string, call: Call): Promise<Hex> {
  const nonce = await getOwnerNonce(account);
  const chainId = BigInt(monadTestnet.id);
  const challenge = hashCall(call, nonce, chainId, account);

  const auth = await signWithPasskey(credentialId, challenge);
  const signature = encodeWebAuthnAuth(auth);

  const hash = await relayerWalletClient.writeContract({
    address: account,
    abi: PasskeyAccountAbi,
    functionName: "execute",
    args: [call, { authType: 0, nonce, signer: "0x0000000000000000000000000000000000000000", signature }],
    chain: monadTestnet,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function grantSessionKey(
  account: Address,
  credentialId: string,
  sessionKey: Address,
  allowedTargets: Address[],
  spendingLimit: bigint,
  validUntil: bigint,
): Promise<Hex> {
  const data = encodeFunctionData({
    abi: PasskeyAccountAbi,
    functionName: "grantSessionKey",
    args: [sessionKey, allowedTargets, spendingLimit, validUntil],
  });

  return executeAsOwner(account, credentialId, { target: account, value: 0n, data });
}

export interface SessionKeyInfo {
  spendingLimit: bigint;
  spent: bigint;
  validUntil: bigint;
  revoked: boolean;
  granted: boolean;
}

export async function getSessionKeyInfo(account: Address, sessionKey: Address): Promise<SessionKeyInfo> {
  const info = await publicClient.readContract({
    address: account,
    abi: PasskeyAccountAbi,
    functionName: "getSessionKeyInfo",
    args: [sessionKey],
  });
  return info as unknown as SessionKeyInfo;
}

export async function getBalance(address: Address): Promise<bigint> {
  return publicClient.getBalance({ address });
}
