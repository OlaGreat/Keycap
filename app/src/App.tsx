import { useEffect, useState } from "react";
import { isAddress, type Address } from "viem";
import { createPasskey } from "./lib/webauthn";
import { createAccount, grantSessionKey, getSessionKeyInfo, getBalance, type SessionKeyInfo } from "./lib/account";
import { relayerAddress } from "./lib/relayer";
import { CANDIDATE_TARGETS, REASONING_LOG_ADDRESS } from "./lib/contracts";
import { loadWallet, saveWallet, type StoredWallet } from "./lib/storage";
import { translatePolicyIntent } from "./lib/nlPolicy";
import { pollRecentReasoning, type ReasoningEntry } from "./lib/activity";
import "./App.css";

const REASONING_POLL_MS = 5000;

function formatMon(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(4);
}

function FaucetHint({ balance }: { balance: bigint | null }) {
  if (balance !== 0n) return null;
  return (
    <a className="faucet-link" href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">
      fund via faucet →
    </a>
  );
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

  const [reasoningEntries, setReasoningEntries] = useState<ReasoningEntry[]>([]);

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

  // Live activity feed: polls the last ~100 blocks for this session key's
  // on-chain reasoning entries. Works for any address typed into the field,
  // not just one granted in this browser session — it's reading real chain
  // state, not local app state.
  useEffect(() => {
    if (!isAddress(sessionKeyAddress)) {
      setReasoningEntries([]);
      return;
    }
    let cancelled = false;

    async function poll() {
      try {
        const fresh = await pollRecentReasoning(REASONING_LOG_ADDRESS, sessionKeyAddress as Address);
        if (cancelled) return;
        setReasoningEntries((prev) => {
          const byKey = new Map(prev.map((e) => [e.key, e]));
          for (const entry of fresh) byKey.set(entry.key, entry);
          return [...byKey.values()].sort((a, b) => Number(b.blockNumber - a.blockNumber)).slice(0, 20);
        });
      } catch {
        // Transient RPC hiccups are fine to ignore on a poll loop.
      }
    }

    poll();
    const id = setInterval(poll, REASONING_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionKeyAddress]);

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
      <header className="hero">
        <h1>Keycap</h1>
        <p className="tagline">Passkey-native smart account with on-chain, agent-scoped session keys.</p>
      </header>

      {error && (
        <div className="error">
          <strong>Error</strong>
          <span>{error}</span>
        </div>
      )}

      {!wallet ? (
        <section className="card step">
          <div className="step-label">Step 1</div>
          <h2>Create your account</h2>
          <p className="muted">No seed phrase, ever — authenticate with your device's passkey (biometric/PIN).</p>
          <button className="primary" onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "Create Passkey Account"}
          </button>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>Account</h2>
            <p className="mono address">{wallet.accountAddress}</p>
            <div className="stat-row">
              <span className="stat-value">{accountBalance !== null ? `${formatMon(accountBalance)} MON` : "…"}</span>
              <FaucetHint balance={accountBalance} />
            </div>
          </section>

          <section className="card step">
            <div className="step-label">Step 2</div>
            <h2>Grant a session key to an agent</h2>

            <label>
              Describe the policy <span className="optional">(optional — fills in the fields below)</span>
              <textarea
                value={policyDescription}
                onChange={(e) => setPolicyDescription(e.target.value)}
                placeholder="e.g. let this agent spend up to 0.05 MON over the next day"
                rows={2}
              />
            </label>
            <button className="secondary" onClick={handleTranslate} disabled={translating || !policyDescription.trim()} type="button">
              {translating ? "Translating…" : "Translate to policy"}
            </button>

            <div className="field-grid">
              <label>
                Agent address
                <input
                  className="mono"
                  value={sessionKeyAddress}
                  onChange={(e) => setSessionKeyAddress(e.target.value)}
                  placeholder="0x…"
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
            </div>

            <button className="primary" onClick={handleGrant} disabled={granting || !sessionKeyAddress}>
              {granting ? "Granting…" : "Grant Session Key"}
            </button>

            {grantedInfo && (
              <div className="info">
                <p>
                  Granted — spend cap <strong>{formatMon(grantedInfo.spendingLimit)} MON</strong>, spent so far{" "}
                  <strong>{formatMon(grantedInfo.spent)} MON</strong>
                </p>
                <p className="muted">Valid until {new Date(Number(grantedInfo.validUntil) * 1000).toLocaleString()}</p>
              </div>
            )}
          </section>

          {isAddress(sessionKeyAddress) && (
            <section className="card step">
              <div className="step-label">Step 3</div>
              <h2>Agent activity</h2>
              <p className="muted">
                Live on-chain reasoning trail for this agent — every confirmed spend has an inspectable "why" attached to
                it. Polls the last ~100 blocks every few seconds.
              </p>
              {reasoningEntries.length === 0 ? (
                <p className="muted empty-state">No activity yet in the recent window — run the agent to see it here.</p>
              ) : (
                <ul className="activity-feed">
                  {reasoningEntries.map((entry) => (
                    <li key={entry.key} className="activity-entry">
                      <p>{entry.reasoning}</p>
                      <a
                        className="mono tx-link"
                        href={`https://testnet.monadscan.com/tx/${entry.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        block {entry.blockNumber.toString()} · {entry.txHash.slice(0, 10)}…
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <section className="card relayer">
        <h3>Gas relayer (not your wallet)</h3>
        <p className="muted">Broadcasts transactions on your behalf — it never holds authority over your account, only pays gas.</p>
        <p className="mono address">{relayerAddress}</p>
        <div className="stat-row">
          <span className="stat-value">{relayerBalance !== null ? `${formatMon(relayerBalance)} MON` : "…"}</span>
          <FaucetHint balance={relayerBalance} />
        </div>
      </section>
    </main>
  );
}
