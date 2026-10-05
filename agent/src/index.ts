import "dotenv/config";
import { createPublicClient, createWalletClient, http, encodeFunctionData, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "./monad.js";
import { hashCall } from "./callHash.js";
import { decideWhetherToCall } from "./decide.js";
import { PasskeyAccountAbi } from "./abi/PasskeyAccount.js";
import { PaidAPIAbi } from "./abi/PaidAPI.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const ACCOUNT_ADDRESS = requireEnv("ACCOUNT_ADDRESS") as Address;
const PAID_API_ADDRESS = requireEnv("PAID_API_ADDRESS") as Address;
const SESSION_KEY_PRIVATE_KEY = requireEnv("SESSION_KEY_PRIVATE_KEY") as Hex;

const sessionKey = privateKeyToAccount(SESSION_KEY_PRIVATE_KEY);

const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });
const walletClient = createWalletClient({ account: sessionKey, chain: monadTestnet, transport: http() });

async function runOnce(): Promise<void> {
  console.log(`\n[agent ${sessionKey.address}] checking session key state…`);

  const info = await publicClient.readContract({
    address: ACCOUNT_ADDRESS,
    abi: PasskeyAccountAbi,
    functionName: "getSessionKeyInfo",
    args: [sessionKey.address],
  });
  // viem decodes a named struct return as an object keyed by its ABI component
  // names, not a positional tuple/array.
  const { spendingLimit, spent, validUntil, revoked, granted } = info as {
    spendingLimit: bigint;
    spent: bigint;
    validUntil: bigint;
    revoked: boolean;
    granted: boolean;
  };

  if (!granted || revoked) {
    console.log("[agent] session key not active (not granted or revoked) — nothing to do.");
    return;
  }

  const pricePerCall = await publicClient.readContract({
    address: PAID_API_ADDRESS,
    abi: PaidAPIAbi,
    functionName: "pricePerCall",
  });

  const decision = await decideWhetherToCall({
    pricePerCallWei: pricePerCall,
    spentWei: spent,
    spendingLimitWei: spendingLimit,
    validUntil,
  });

  console.log(`[agent] decision: ${decision.approve ? "APPROVE" : "DECLINE"} — ${decision.reasoning}`);
  if (!decision.approve) return;

  const nonce = await publicClient.readContract({
    address: ACCOUNT_ADDRESS,
    abi: PasskeyAccountAbi,
    functionName: "getNonce",
    args: [sessionKey.address],
  });

  const callData = encodeFunctionData({ abi: PaidAPIAbi, functionName: "callApi" });
  const call = { target: PAID_API_ADDRESS, value: pricePerCall, data: callData };
  const chainId = BigInt(monadTestnet.id);
  const challenge = hashCall(call, nonce, chainId, ACCOUNT_ADDRESS);

  const signature = await sessionKey.sign({ hash: challenge });

  console.log("[agent] submitting execute()…");
  const txHash = await walletClient.writeContract({
    address: ACCOUNT_ADDRESS,
    abi: PasskeyAccountAbi,
    functionName: "execute",
    args: [call, { authType: 1, nonce, signer: sessionKey.address, signature }],
    chain: monadTestnet,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`[agent] confirmed in block ${receipt.blockNumber}: ${txHash}`);
}

async function main(): Promise<void> {
  const loopSeconds = process.env.LOOP_INTERVAL_SECONDS ? Number(process.env.LOOP_INTERVAL_SECONDS) : undefined;

  await runOnce();

  if (loopSeconds) {
    console.log(`[agent] looping every ${loopSeconds}s (Ctrl+C to stop)`);
    setInterval(() => {
      runOnce().catch((err) => console.error("[agent] run failed:", err));
    }, loopSeconds * 1000);
  }
}

main().catch((err) => {
  console.error("[agent] fatal:", err);
  process.exitCode = 1;
});
