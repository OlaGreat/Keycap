import "dotenv/config";
import { createPublicClient, createWalletClient, http, encodeFunctionData, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "./monad.js";
import { hashCall } from "./callHash.js";
import { prioritizeCandidates, type Candidate } from "./decide.js";
import { PasskeyAccountAbi } from "./abi/PasskeyAccount.js";
import { PaidAPIAbi } from "./abi/PaidAPI.js";
import { ReasoningLogAbi } from "./abi/ReasoningLog.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const ACCOUNT_ADDRESS = requireEnv("ACCOUNT_ADDRESS") as Address;
const SESSION_KEY_PRIVATE_KEY = requireEnv("SESSION_KEY_PRIVATE_KEY") as Hex;
const REASONING_LOG_ADDRESS = requireEnv("REASONING_LOG_ADDRESS") as Address;

// Static demo metadata for each candidate target. Prices are read live from
// each contract on-chain below, not hardcoded here, since price is the one
// fact that actually governs affordability and must never drift from truth.
const CANDIDATE_TARGETS: { id: string; description: string; address: Address }[] = [
  {
    id: "weather-api",
    description: "Weather forecast API — cheap, broadly useful for trip-planning style queries",
    address: requireEnv("PAID_API_ADDRESS") as Address,
  },
  {
    id: "news-api",
    description: "Breaking news digest API — moderate cost, relevance depends on timeliness",
    address: requireEnv("NEWS_API_ADDRESS") as Address,
  },
  {
    id: "market-data-api",
    description: "Premium real-time market data API — expensive, only worth it for active trading tasks",
    address: requireEnv("MARKET_DATA_API_ADDRESS") as Address,
  },
];

const sessionKey = privateKeyToAccount(SESSION_KEY_PRIVATE_KEY);

const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });
const walletClient = createWalletClient({ account: sessionKey, chain: monadTestnet, transport: http() });

async function attemptCall(target: Address, priceWei: bigint, reasoning: string): Promise<void> {
  const nonce = await publicClient.readContract({
    address: ACCOUNT_ADDRESS,
    abi: PasskeyAccountAbi,
    functionName: "getNonce",
    args: [sessionKey.address],
  });

  const callData = encodeFunctionData({ abi: PaidAPIAbi, functionName: "callApi" });
  const call = { target, value: priceWei, data: callData };
  const chainId = BigInt(monadTestnet.id);
  const challenge = hashCall(call, nonce, chainId, ACCOUNT_ADDRESS);
  const signature = await sessionKey.sign({ hash: challenge });

  const txHash = await walletClient.writeContract({
    address: ACCOUNT_ADDRESS,
    abi: PasskeyAccountAbi,
    functionName: "execute",
    args: [call, { authType: 1, nonce, signer: sessionKey.address, signature }],
    chain: monadTestnet,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`[agent] confirmed in block ${receipt.blockNumber}: ${txHash}`);

  // Logged only after a confirmed spend, bound to the same call hash that was
  // signed — so every real spend has an inspectable, on-chain "why" attached
  // to it, not just a pass/fail gate.
  const logTxHash = await walletClient.writeContract({
    address: REASONING_LOG_ADDRESS,
    abi: ReasoningLogAbi,
    functionName: "logReasoning",
    args: [challenge, reasoning],
    chain: monadTestnet,
  });
  await publicClient.waitForTransactionReceipt({ hash: logTxHash });
  console.log(`[agent] reasoning logged: ${logTxHash}`);
}

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

  const candidates: Candidate[] = await Promise.all(
    CANDIDATE_TARGETS.map(async (t) => ({
      id: t.id,
      description: t.description,
      priceWei: await publicClient.readContract({ address: t.address, abi: PaidAPIAbi, functionName: "pricePerCall" }),
    })),
  );

  const { ranking } = await prioritizeCandidates({
    candidates,
    spentWei: spent,
    spendingLimitWei: spendingLimit,
    validUntil,
  });

  if (ranking.length === 0) {
    console.log("[agent] decided nothing is worth calling right now.");
    return;
  }

  console.log(`[agent] ranking (most valuable first): ${ranking.map((r) => r.id).join(" > ")}`);

  for (const choice of ranking) {
    const target = CANDIDATE_TARGETS.find((t) => t.id === choice.id);
    if (!target) {
      console.log(`[agent] skipping unknown candidate id "${choice.id}" — not one of the available targets.`);
      continue;
    }
    const candidate = candidates.find((c) => c.id === choice.id)!;

    console.log(`[agent] attempting "${choice.id}" (${candidate.priceWei} wei) — ${choice.reasoning}`);
    try {
      await attemptCall(target.address, candidate.priceWei, choice.reasoning);
    } catch (err) {
      // The contract is the final arbiter of affordability: a later candidate
      // in the ranking may no longer fit after earlier ones in this same run
      // already spent part of the budget. That's expected, not a failure —
      // skip it and keep going rather than aborting the whole run.
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[agent] "${choice.id}" was not executable (likely exceeds remaining budget): ${message.split("\n")[0]}`);
    }
  }
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
