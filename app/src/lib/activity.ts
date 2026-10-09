import { createPublicClient, http, type Address } from "viem";
import { monadTestnet } from "./monad";
import { ReasoningLogAbi } from "./contracts";

const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });

// Monad Testnet's public RPC caps eth_getLogs at a 100-block range per call
// (confirmed: a wider range errors with "eth_getLogs is limited to a 100
// range"), so a full history scan isn't practical here. Polling a recent
// window instead doubles as a better demo anyway: open the page, run the
// agent, and watch reasoning entries appear as they're confirmed.
const LOG_WINDOW_BLOCKS = 99n;

export interface ReasoningEntry {
  key: string;
  reasoning: string;
  blockNumber: bigint;
  txHash: string;
}

/** Fetches ReasoningLogged events for `sessionKeyAddress` from the last ~100 blocks. */
export async function pollRecentReasoning(
  reasoningLogAddress: Address,
  sessionKeyAddress: Address,
): Promise<ReasoningEntry[]> {
  const latest = await publicClient.getBlockNumber();
  const fromBlock = latest > LOG_WINDOW_BLOCKS ? latest - LOG_WINDOW_BLOCKS : 0n;

  const logs = await publicClient.getContractEvents({
    address: reasoningLogAddress,
    abi: ReasoningLogAbi,
    eventName: "ReasoningLogged",
    args: { agent: sessionKeyAddress },
    fromBlock,
    toBlock: latest,
  });

  return logs.map((log) => {
    const args = log.args as { reasoning?: string };
    return {
      key: `${log.transactionHash}-${log.logIndex}`,
      reasoning: args.reasoning ?? "",
      blockNumber: log.blockNumber ?? 0n,
      txHash: log.transactionHash ?? "",
    };
  });
}
