import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";

export interface Call {
  target: Address;
  value: bigint;
  data: Hex;
}

/**
 * Mirrors contracts/src/libraries/CallHashLib.sol::hashCall exactly. Verified
 * byte-for-byte against `cast abi-encode | cast keccak` — see the frontend's
 * app/src/lib/callHash.ts (same encoding, same verification) and its commit
 * history for the cross-check.
 */
export function hashCall(call: Call, nonce: bigint, chainId: bigint, account: Address): Hex {
  const encoded = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }, { type: "bytes32" }, { type: "uint256" }, { type: "uint256" }, { type: "address" }],
    [call.target, call.value, keccak256(call.data), nonce, chainId, account],
  );
  return keccak256(encoded);
}
