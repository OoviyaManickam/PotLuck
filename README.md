# 🍲 PotLuck

**On-chain ROSCA (Rotating Savings and Credit Association) — ETHOnline 2026**

A ROSCA is how billions of unbanked people already save: N people each contribute a
fixed amount every period, and each period the whole pot rotates to one member. It works
on trust — and it breaks when someone takes an early payout and disappears. PotLuck puts
the trust on-chain: collateral, verifiable random payout order, automatic slashing, and a
portable reputation that follows a real human, not a wallet.

> Chain: **Ethereum Sepolia** · Contracts: **Foundry** · Client: **TypeScript (ethers)**

---

## Architecture (backend)

Four contracts, one clear job each:

| Contract | Responsibility |
|---|---|
| `ROSCAFactory` | Deploys pools; enforces the 3-member floor and reputation tier caps |
| `ROSCAPool` | One ROSCA cycle: members, collateral, rounds, slashing, VRF payout order, payout |
| `ReputationRegistry` | The only shared state — permanent record keyed by identity: clean cycles + `hasDefaulted` |
| `IIdentityGate` | Abstracts "a real human is present" — `NoOpGate` (dev) or `WorldIDGate` (World ID Selfie Check) |

Identity lives behind an interface so World ID is an **upgrade, not a hard dependency**:
the whole ROSCA machine runs today with `NoOpGate`, and swaps to `WorldIDGate` with one
line at deploy.

### Round lifecycle
```
OPEN ──join() fills last slot──▶ LOCKED ──VRF sets payout order──▶ ROUND_ACTIVE ──┐
                                                                    │  each round:  │
                                                     contribute → slash misses →   │
                                                     pay winner → advance ─────────┘
                                                                    │ last round
                                                                    ▼
                                                                COMPLETE (settle
                                                                collateral, fees,
                                                                reputation)
```

## Layout
```
src/
  interfaces/IIdentityGate.sol
  identity/NoOpGate.sol
  ReputationRegistry.sol
  ROSCAFactory.sol
  ROSCAPool.sol
test/            # Foundry tests
script/          # forge deploy scripts
ts-client/       # TypeScript client that drives the full flow on Sepolia
```
*(A `client/` folder is reserved for the frontend, added later.)*

## Status
🚧 Step 1 — contracts + Sepolia deploy + TS flow test. See `../idea/docs/superpowers/specs/`
for the full technical spec.

## Develop
```bash
forge build
forge test
```

---
Built for ETHOnline 2026. Targets ENS v2, World ID Selfie Check, and Privy bounties.
