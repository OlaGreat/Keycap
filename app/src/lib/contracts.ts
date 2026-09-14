import { PasskeyAccountFactoryAbi } from "./abi/PasskeyAccountFactory";
import { PasskeyAccountAbi } from "./abi/PasskeyAccount";
import { PaidAPIAbi } from "./abi/PaidAPI";

export const FACTORY_ADDRESS = import.meta.env.VITE_FACTORY_ADDRESS;
export const PAID_API_ADDRESS = import.meta.env.VITE_PAID_API_ADDRESS;

export { PasskeyAccountFactoryAbi, PasskeyAccountAbi, PaidAPIAbi };
