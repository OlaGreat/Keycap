<p align="center">
  <img src="docs/keycap-logo.png" alt="Keycap logo" width="120" />
</p>

<h1 align="center">Keycap</h1>

<p align="center"><b>Trust the limits, not the agent.</b><br/>
A passkey-owned smart account on Monad that gives AI agents scoped, revocable keys with on-chain spending limits.</p>

<p align="center">
  <a href="https://keycap-xd7a.vercel.app">Live app (Monad testnet)</a>
</p>

---

## The problem

AI agents can now pay for things: APIs, data, services. But letting an agent spend usually means giving it your private key, or trusting a company to hold your funds. If the agent is hijacked, buggy, or simply wrong, everything in the wallet is exposed.

## What Keycap does

Keycap is a smart account owned by a **passkey** (your device's fingerprint, face, or PIN). There is no seed phrase.

Instead of sharing your key with an agent, you grant it its **own session key** with limits that the smart contract enforces:

| Limit | What it controls |
|---|---|
| Spend cap | How much MON the agent can spend in total |
| Allowlist | Which contracts (services) the agent may pay |
| Expiry | How long the key is valid |

A well-behaved agent stays inside its limits. A compromised one is rejected by the chain. The owner can revoke access at any time, with their passkey.

On top of that:

- **Visible reasoning.** The demo agent uses a language model to decide which services are worth paying for within its budget, then records *why* it paid, on-chain. The app shows these reasons in a live activity feed next to the agent's remaining budget.
- **Plain-English policies.** Type "0.05 MON for 2 hours" and the grant form fills itself in. A local model's reading is cross-checked against a rule-based parser, and nothing is filled in unless both agree. The owner still reviews and approves with their passkey.

## Why Monad

Monad verifies P256 (passkey) signatures natively through a precompile at `0x0100`, for **6,900 gas**. The same check in a regular smart contract costs about 330,000 gas, almost 50 times more. That is what makes a passkey-owned wallet practical for everyday use.

## Architecture

```
  Owner (passkey)                         AI agent (own session key)
        │                                          │
        │ grant / revoke                           │ signed spend
        │ (WebAuthn signature)                     │ (ECDSA signature)
        ▼                                          ▼
 ┌─────────────────────────── PasskeyAccount ───────────────────────────┐
 │  execute(call, authorization)                                        │
 │   ├─ owner path:   WebAuthnOwnerValidator  ──► P256 precompile 0x0100 │
 │   └─ session path: SessionKeyManager checks cap, allowlist, expiry,  │
 │                    revocation, then forwards the call                 │
 └──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                     Allowed service (e.g. PaidAPI)

 Agent ──► ReasoningLog.logReasoning(callHash, reason)   (after each confirmed spend)
```

- **No ERC-4337 dependency.** `execute()` is called directly and authorized entirely by the embedded signature, which keeps every path directly testable. Bundlers exist on Monad; this was a scope choice, not a limitation of the chain.
- **Replay protection.** Every signed call is bound to a nonce, the chain id, and the account address.
- **Owner actions go through the same path.** Granting and revoking are self-calls via `execute()`, so there is a single authorization flow to reason about.
- **Not upgradeable, by design.** Accounts are deployed with CREATE2 by `PasskeyAccountFactory`. A contract change ships as a new factory.

## Repository layout

| Folder | What's inside |
|---|---|
| [`contracts/`](contracts) | Solidity contracts and Foundry tests |
| [`app/`](app) | The web app (Vite, React, TypeScript, viem) |
| [`agent/`](agent) | The demo AI agent (Node.js, TypeScript) |

## Deployed contracts (Monad testnet, chain id 10143)

| Contract | Address |
|---|---|
| PasskeyAccountFactory | [`0x69DC1CBAf22437E93c25ba32b4856873c66Eb113`](https://testnet.monadscan.com/address/0x69DC1CBAf22437E93c25ba32b4856873c66Eb113) |
| WebAuthnOwnerValidator | [`0x046F16EDD1287e9C0a80eb4fF89c00D70ef3eCe6`](https://testnet.monadscan.com/address/0x046F16EDD1287e9C0a80eb4fF89c00D70ef3eCe6) |
| ReasoningLog | [`0xCd575792F4f989D0f2Da8858AeEC77Fd3fEAa039`](https://testnet.monadscan.com/address/0xCd575792F4f989D0f2Da8858AeEC77Fd3fEAa039) |
| Weather API (demo, 0.001 MON/call) | [`0x59EB05FCc530eA808e15D490A6d5d3f7E1B1CBee`](https://testnet.monadscan.com/address/0x59EB05FCc530eA808e15D490A6d5d3f7E1B1CBee) |
| News API (demo, 0.01 MON/call) | [`0xdeF04eb8f76F0D5489747ac0FadDa765A06B33Bc`](https://testnet.monadscan.com/address/0xdeF04eb8f76F0D5489747ac0FadDa765A06B33Bc) |
| Market Data API (demo, 0.03 MON/call) | [`0x1f9eB9FC8857F2D03125f1Dfa186C3Be203048a4`](https://testnet.monadscan.com/address/0x1f9eB9FC8857F2D03125f1Dfa186C3Be203048a4) |

The three demo APIs are instances of a simple `PaidAPI` contract that charges MON per call. A session key's allowlist can point at any contract.

## Try it

### 1. The hosted app

1. Open https://keycap-xd7a.vercel.app.
2. Each browser gets its own **gas relayer** (it only pays gas, it has no authority over your account). It starts at 0 MON. Copy its address from the "Gas relayer" card and send it about 0.5 testnet MON from https://faucet.monad.xyz.
3. Click **Create Passkey Account** and approve the passkey prompt.
4. Send some testnet MON to your new account address, so the agent has something to spend.
5. Grant a session key: paste an agent address, set a spend cap and duration, and pick which services the agent may pay.

Plain-English translation needs a local AI model, so it is hidden on the hosted site. Run the app locally to use it (see below).

### 2. Run the agent

Requirements: Node.js 20+, and either [Ollama](https://ollama.com) (free, local) or an Anthropic API key.

```bash
cd agent
npm install
cp .env.example .env
```

Fill in `.env`:

- `SESSION_KEY_PRIVATE_KEY`: the agent's own key. Generate one with
  `node -e "console.log(require('viem/accounts').generatePrivateKey())"`, grant its address in the app, and send its address a little testnet MON for gas.
- `ACCOUNT_ADDRESS`: your Keycap account address from the app.
- The contract addresses from the table above.

If you use Ollama, pull the model and start it:

```bash
ollama pull qwen2.5:3b
ollama serve
```

Then run the agent:

```bash
npm run start          # reads its budget, decides what to pay for, spends within its limits
npm run start:force    # ignores its own checks and forces a spend, to show the contract rejecting it
```

`start:force` is a demo of on-chain enforcement. Use it after revoking or narrowing a key, and expect a reverted transaction (it still costs gas).

### 3. Run the app locally

```bash
cd app
npm install
cp .env.example .env.local   # fill in the contract addresses from the table above
npm run dev
```

To enable plain-English translation, start Ollama so it accepts requests from the dev server:

```bash
OLLAMA_ORIGINS="http://localhost:5173" ollama serve
```

### 4. Contracts and tests

```bash
cd contracts
git submodule update --init --recursive
forge test
```

All 57 tests pass. They cover passkey signature verification (against real captured WebAuthn assertions), session key limits, replay protection, reentrancy, and the factory.

## Security notes

- Passkey verification uses audited libraries: [daimo-eth/p256-verifier](https://github.com/daimo-eth/p256-verifier) and [base-org/webauthn-sol](https://github.com/base-org/webauthn-sol). Keycap does not implement its own elliptic-curve cryptography.
- The reasoning log is written by the agent. The contract does not force an agent to log, so treat it as an audit trail from well-behaved agents, not a guarantee.

## Limitations and roadmap

This is a testnet prototype and **has not been audited**. Known limitations:

- Spend caps cover native MON only, not ERC-20 tokens. Token-aware limits are the natural next step.
- Allowlisting a contract allows every function on it. Per-function limits are on the roadmap.
- An account is tied to the browser that created it. Signing in with an existing passkey on another device is not built yet.
- Each browser's gas relayer must be funded by hand. A production version would use a paymaster or relayer service.

## Built for

Monad Metropolis hackathon, Trust, Identity & AI Infrastructure track.
