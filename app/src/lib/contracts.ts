import { PasskeyAccountFactoryAbi } from "./abi/PasskeyAccountFactory";
import { PasskeyAccountAbi } from "./abi/PasskeyAccount";
import { PaidAPIAbi } from "./abi/PaidAPI";

export const FACTORY_ADDRESS = import.meta.env.VITE_FACTORY_ADDRESS;
export const PAID_API_ADDRESS = import.meta.env.VITE_PAID_API_ADDRESS;
export const NEWS_API_ADDRESS = import.meta.env.VITE_NEWS_API_ADDRESS;
export const MARKET_DATA_API_ADDRESS = import.meta.env.VITE_MARKET_DATA_API_ADDRESS;

// The full set of targets a granted session key is allowed to call. Several
// competing options (rather than one single target) so the agent has to
// genuinely prioritize within its budget, not just pass/fail a single gate.
export const CANDIDATE_TARGETS = [PAID_API_ADDRESS, NEWS_API_ADDRESS, MARKET_DATA_API_ADDRESS];

export { PasskeyAccountFactoryAbi, PasskeyAccountAbi, PaidAPIAbi };
