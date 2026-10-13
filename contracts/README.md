# Keycap contracts

Solidity contracts for Keycap, built and tested with [Foundry](https://book.getfoundry.sh). See the [main README](../README.md) for the overview and deployed addresses.

| Contract | Role |
|---|---|
| `PasskeyAccount` | The smart account. `execute()` accepts an owner passkey signature or a session key signature. |
| `SessionKeyManager` | Session key policy: spend cap, target allowlist, expiry, revocation. |
| `WebAuthnOwnerValidator` | Verifies the owner's passkey (WebAuthn / P256) signature using audited libraries. |
| `PasskeyAccountFactory` | Deploys accounts deterministically with CREATE2. |
| `ReasoningLog` | Lets an agent record on-chain why it made a payment. |
| `mocks/PaidAPI` | Demo service that charges MON per call. |

```bash
git submodule update --init --recursive
forge test
```

Deploy scripts are in `script/`. They read `DEPLOYER_PRIVATE_KEY` from `.env` (see `.env.example`).
