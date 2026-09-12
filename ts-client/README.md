# ts-client

TypeScript client that drives a full **PotLuck** ROSCA lifecycle against the
live Sepolia stack — it plays the role of the app so the whole mechanic is
proven on-chain before any frontend exists.

`src/flow.ts` walks these sections end to end:

1. **SETUP** — connect the five wallets (creator + 4 members) and the deployed
   contracts.
2. **CREATE POOL** — creator calls `ROSCAFactory.createPool(...)` for an N=4
   pool with a short period/window so the demo settles in one run.
3. **FUND + JOIN** — each member mints mock USDC, `approve()`s the pool, and
   `join()`s. The fourth join locks the pool; the dev-shuffle picks the payout
   order and starts round 1.
4. **ROUNDS** — every round each member `contribute()`s, the script waits out
   the contribution window, then the creator `settleRound()`s and the full pot
   rotates to that round's member. **One member deliberately skips their round-1
   contribution** to show the slash: an N=4 pool's collateral (2× contribution)
   absorbs one miss, so that member is slashed one contribution but **stays
   active** and still wins their own round later.
5. **REPUTATION** — read back `cleanCycles` / `hasDefaulted` per member. The
   member who missed shows `hasDefaulted=true`; everyone else is clean.

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
`MEMBER1_PRIVATE_KEY`..`MEMBER4_PRIVATE_KEY`, and the deployed
`TOKEN_ADDRESS` / `FACTORY_ADDRESS` / `REGISTRY_ADDRESS`. Optionally override
`PERIOD_SECONDS` / `WINDOW_SECONDS` / `CONTRIBUTION`.

## npm registry

This folder carries its own `.npmrc` pointing at the public npm registry, so
installs here never touch the machine's global registry configuration.
