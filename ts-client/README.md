# ts-client

TypeScript client that drives a full **PotLuck** ROSCA lifecycle against a
deployed stack — it plays the role of the app so the whole mechanic is proven
on-chain before any frontend exists.

`src/flow.ts` does, end to end:

1. create a pool via `ROSCAFactory`
2. mint mock USDC to three members, each `join()`s (the third join locks the
   pool; the dev-shuffle picks a random payout order and starts round 1)
3. run every round — each member `contribute()`s, the window closes, anyone
   `settleRound()`s and the full pot rotates to that round's member
4. read back on-chain reputation (`cleanCycles`, `hasDefaulted`) per member

On a local `anvil` node (chainId 31337) it fast-forwards time so the whole
cycle runs in seconds. On a live network it waits out the real window, so
deploy the demo pool with short `period`/`window` values.

## Run against anvil

```bash
# 1. start a node
anvil

# 2. deploy the stack (from repo root) and note the printed addresses
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast

# 3. run the flow
cd ts-client
npm install
RPC_URL=http://127.0.0.1:8545 \
FUNDER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
USDC_ADDRESS=... FACTORY_ADDRESS=... REGISTRY_ADDRESS=... \
  npm run flow
```

## Run against Sepolia

Deploy with short window/period (so the demo doesn't wait 12h), fund the
`FUNDER_KEY` account with Sepolia ETH, then set the same env vars plus
`PERIOD_SECONDS` / `WINDOW_SECONDS`. See `.env.example` in the repo root.

## npm registry

This folder carries its own `.npmrc` pointing at the public npm registry, so
installs here never touch the machine's global registry configuration.
