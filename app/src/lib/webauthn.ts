import { Registration, Authentication } from "ox/webauthn";
import type { Hex } from "viem";

export interface PasskeyCredential {
  id: string;
  publicKeyX: bigint;
  publicKeyY: bigint;
}

/** WebAuthn.WebAuthnAuth fields, matching contracts/lib/webauthn-sol's struct exactly. */
export interface WebAuthnAuth {
  authenticatorData: Hex;
  clientDataJSON: string;
  challengeIndex: bigint;
  typeIndex: bigint;
  r: bigint;
  s: bigint;
}

export async function createPasskey(accountLabel: string): Promise<PasskeyCredential> {
  const credential = await Registration.create({ name: accountLabel });
  return {
    id: credential.id,
    publicKeyX: BigInt(credential.publicKey.x),
    publicKeyY: BigInt(credential.publicKey.y),
  };
}

/**
 * Prompts the passkey to sign `challenge` (the account's CallHashLib.hashCall
 * output) and returns exactly the fields PasskeyAccount.execute() needs, ABI-
 * encodable directly as the WebAuthn.WebAuthnAuth struct.
 */
export async function signWithPasskey(credentialId: string, challenge: Hex): Promise<WebAuthnAuth> {
  const result = await Authentication.sign({
    credentialId,
    challenge,
    userVerification: "required",
  });

  const { challengeIndex, typeIndex } = result.metadata;
  if (challengeIndex === undefined || typeIndex === undefined) {
    throw new Error("WebAuthn assertion missing challenge/type index in clientDataJSON");
  }

  return {
    authenticatorData: result.metadata.authenticatorData,
    clientDataJSON: result.metadata.clientDataJSON,
    challengeIndex: BigInt(challengeIndex),
    typeIndex: BigInt(typeIndex),
    r: BigInt(result.signature.r),
    s: BigInt(result.signature.s),
  };
}
