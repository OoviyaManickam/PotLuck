# PotLuck — Sepolia Deployment (ENS-integrated stack)

Deployed: 2026-09-13 · commit `17635e1` (main, post-ENS merge PR #1)
Deployer / treasury: `0xe3DF38699E410C0FD0D95b7A03960FE57d7F95c6`
Chain: Sepolia (11155111)

## Live addresses

| Contract | Address |
|---|---|
| MockUSDC | `0x701F864Bbf902C7943E2c40A3D5798F6Bd6028EB` |
| NoOpGate (identity) | `0x62972564798F7DB372d0471c43Fc206F395cf63a` |
| NoOpNaming | `0xF3CcF1dd9348ebEeDd68f557dc8Fb8090655a02A` |
| ROSCAFactory | `0xe1dA53345211C225A072fCaa3d16D611F39f5e4F` |
| ReputationRegistry | `0xC040A3819f6ecd30AD8416D7dA5FB7F41A7A577F` |

Verified on-chain: `factory.naming()`, `factory.registry()`, `factory.identityGate()` all point at the addresses above.

## Notes / next steps

- Identity gate is **NoOpGate** (`isLiveGate() == false`) — full ROSCA flow works with no identity check. World ID is an optional later swap via `factory.setIdentityGate(worldIdGate)` (deploy one gate contract + one setter call, no full redeploy).
- Naming is **NoOpNaming** by default. Live ENS (`potluck.eth`) wiring is a separate manual step (spec §7): deploy PotluckENS + ReputationResolver, register `potluck.eth` (~8 Circle USDC), set resolver, then `factory.setNaming(potluckENS)`. Deferred until frontend / near demo.
- This supersedes the earlier Sep-12 deploy (pre-ENS, 3-arg factory) at `ROSCAFactory 0xbc39e3f9ec515677d37e711519d98efa1198be46` — **do not use those addresses.**
