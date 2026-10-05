import { useEffect, useState } from "react";
import type { Address } from "viem";
import { createPasskey } from "./lib/webauthn";
import { createAccount, grantSessionKey, getSessionKeyInfo, getBalance, type SessionKeyInfo } from "./lib/account";
import { relayerAddress } from "./lib/relayer";
import { CANDIDATE_TARGETS } from "./lib/contracts";
import { loadWallet, saveWallet, type StoredWallet } from "./lib/storage";
import { translatePolicyIntent } from "./lib/nlPolicy";
import "./App.css";

function formatMon(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(4);
}

export default function App() {
  const [wallet, setWallet] = useState<StoredWallet | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [relayerBalance, setRelayerBalance] = useState<bigint | null>(null);
  const [accountBalance, setAccountBalance] = useState<bigint | null>(null);

  const [sessionKeyAddress, setSessionKeyAddress] = useState("");
  const [spendLimit, setSpendLimit] = useState("0.05");
  const [validHours, setValidHours] = useState("24");
  const [granting, setGranting] = useState(false);
  const [grantedInfo, setGrantedInfo] = useState<SessionKeyInfo | null>(null);

  const [policyDescription, setPolicyDescription] = useState("");
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    setWallet(loadWallet());
  }, []);

  useEffect(() => {
    getBalance(relayerAddress).then(setRelayerBalance).catch(() => {});
  }, []);

  useEffect(() => {
    if (!wallet) return;
    getBalance(wallet.accountAddress).then(setAccountBalance).catch(() => {});
  }, [wallet]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const credential = await createPasskey("Keycap Account");
      const accountAddress = await createAccount(credential.publicKeyX, credential.publicKeyY, 0n);
      const newWallet: StoredWallet = {
        credentialId: credential.id,
        publicKeyX: credential.publicKeyX.toString(),
        publicKeyY: credential.publicKeyY.toString(),
        accountAddress,
      };
      saveWallet(newWallet);
      setWallet(newWallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleTranslate() {
    if (!policyDescription.trim()) return;
    setTranslating(true);
    setError(null);
    try {
      const policy = await translatePolicyIntent(policyDescription);
      setSpendLimit(String(policy.spendCapMon));
      setValidHours(String(policy.validForHours));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTranslating(false);
    }
  }

  async function handleGrant() {
    if (!wallet) return;
    setGranting(true);
    setError(null);
    try {
      const spendLimitWei = BigInt(Math.round(parseFloat(spendLimit) * 1e18));
      const validUntil = BigInt(Math.floor(Date.now() / 1000) + parseFloat(validHours) * 3600);
      await grantSessionKey(
        wallet.accountAddress,
        wallet.credentialId,
        sessionKeyAddress as Address,
        CANDIDATE_TARGETS,
        spendLimitWei,
        validUntil,
      );
      const info = await getSessionKeyInfo(wallet.accountAddress, sessionKeyAddress as Address);
      setGrantedInfo(info);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGranting(false);
    }
  }

  return (
    <main className="page">
      <h1>Keycap</h1>
      <p className="tagline">Passkey-native smart account with on-chain, agent-scoped session keys.</p>

      {error && <div className="error">{error}</div>}

      {!wallet ? (
        <section className="card">
          <h2>1. Create your account</h2>
          <p>No seed phrase — authenticate with your device's passkey (biometric/PIN).</p>
          <button onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "Create Passkey Account"}
          </button>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>Account</h2>
            <p className="mono">{wallet.accountAddress}</p>
            <p>
              Balance: {accountBalance !== null ? `${formatMon(accountBalance)} MON` : "…"}{" "}
              {accountBalance === 0n && (
                <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">
                  fund via faucet
                </a>
              )}
            </p>
          </section>

          <section className="card">
            <h2>2. Grant a session key to an agent</h2>
            <label>
              Describe the policy (optional — fills in the fields below)
              <textarea
                value={policyDescription}
                onChange={(e) => setPolicyDescription(e.target.value)}
                placeholder="e.g. let this agent spend up to 0.05 MON over the next day"
                rows={2}
              />
            </label>
            <button onClick={handleTranslate} disabled={translating || !policyDescription.trim()} type="button">
              {translating ? "Translating…" : "Translate to policy"}
            </button>
            <label>
              Agent address
              <input
                value={sessionKeyAddress}
                onChange={(e) => setSessionKeyAddress(e.target.value)}
                placeholder="0x..."
              />
            </label>
            <label>
              Spend cap (MON)
              <input value={spendLimit} onChange={(e) => setSpendLimit(e.target.value)} />
            </label>
            <label>
              Valid for (hours)
              <input value={validHours} onChange={(e) => setValidHours(e.target.value)} />
            </label>
            <button onClick={handleGrant} disabled={granting || !sessionKeyAddress}>
              {granting ? "Granting…" : "Grant Session Key"}
            </button>

            {grantedInfo && (
              <div className="info">
                <p>Granted. Spend cap: {formatMon(grantedInfo.spendingLimit)} MON, spent so far: {formatMon(grantedInfo.spent)} MON</p>
                <p>Valid until: {new Date(Number(grantedInfo.validUntil) * 1000).toLocaleString()}</p>
              </div>
            )}
          </section>
        </>
      )}

      <section className="card relayer">
        <h3>Gas relayer (not your wallet)</h3>
        <p>
          Broadcasts transactions on your behalf — it never holds authority over your account, only pays gas.
        </p>
        <p className="mono">{relayerAddress}</p>
        <p>
          Balance: {relayerBalance !== null ? `${formatMon(relayerBalance)} MON` : "…"}{" "}
          {relayerBalance === 0n && (
            <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">
              fund via faucet
            </a>
          )}
        </p>
      </section>
    </main>
  );
}
