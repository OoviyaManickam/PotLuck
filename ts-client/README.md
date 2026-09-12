# ts-client

TypeScript client that drives a full **PotLuck** ROSCA lifecycle against the
live Sepolia stack — it plays the role of the app so the whole mechanic is
proven on-chain before any frontend exists.

`src/flow.ts` walks these sections end to end:

1. **SETUP** — connect the four wallets (creator + 3 members) and the deployed
   contracts.
2. **CREATE POOL** — creator calls `ROSCAFactory.createPool(...)` with a short
   period/window so the demo settles in one run.
3. **FUND + JOIN** — each member mints mock USDC, `approve()`s the pool, and
   `join()`s. The third join locks the pool; the dev-shuffle picks the payout
   order and starts round 1.
4. **ROUNDS** — every round each member `contribute()`s, the script waits out
   the contribution window, then the creator `settleRound()`s and the full pot
   rotates to that round's member.
5. **REPUTATION** — read back `cleanCycles` / `hasDefaulted` per member.

Every wallet is an explicit named key in `.env` and must **already hold Sepolia
ETH for gas** — the script never sends ETH. mUSDC comes from the MockUSDC
faucet/mint.

## Run

```bash
cd ts-client
cp ../.env.example .env    # fill in the four keys + deployed addresses
npm install
npm run flow
```

The `.env` values you need: `SEPOLIA_RPC_URL`, `CREATOR_PRIVATE_KEY`,
`MEMBER1_PRIVATE_KEY`..`MEMBER3_PRIVATE_KEY`, and the deployed
`TOKEN_ADDRESS` / `FACTORY_ADDRESS` / `REGISTRY_ADDRESS`. Optionally override
`PERIOD_SECONDS` / `WINDOW_SECONDS` / `CONTRIBUTION`.

## npm registry

This folder carries its own `.npmrc` pointing at the public npm registry, so
installs here never touch the machine's global registry configuration.
