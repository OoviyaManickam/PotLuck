# 🍲 PotLuck

**A credit score for the unbanked, built on savings behavior instead of debt history — as an on-chain ROSCA.**

_ETHOnline 2026 · Ethereum Sepolia · Foundry contracts + Next.js client_

---

## The problem

A **ROSCA** (Rotating Savings and Credit Association) is the oldest savings
product in the world and how **billions of unbanked people already save today** —
*chit funds* in India, *tandas* in Mexico, *susus* in West Africa, *hui* in China.

The mechanic is simple: **N people each contribute a fixed amount every period,
and each period the whole pot rotates to one member.** After N periods everyone
has paid in N times and received the pot once. No bank, no interest, no credit
check. It is a savings circle and an interest-free loan at the same time.

It runs entirely on **trust** — and that is exactly where it breaks:

- Someone wins the pot in an early round and **disappears** before paying the rest.
- The **organizer runs off** with the collected funds.
- There is **no legal recourse**, no enforcement, and no record — so a person who
  faithfully completed ten circles has **nothing to show for it** when they move
  towns or want into a bigger group.

> **The core insight:** trust and accountability *are* the entire problem — and a
> smart contract is exactly the thing that can hold them. PotLuck keeps the social
> product people already understand and replaces the fragile "trust" layer with
> **collateral, automatic slashing, and a portable reputation that follows a real
> person, not a throwaway wallet.**

---

## What PotLuck does

PotLuck runs the full ROSCA lifecycle on-chain and, crucially, **turns good
behavior into a portable, verifiable credit history**:

1. **Collateral, not faith.** To join a pool you lock **50% of the total pot**
   up front. If you miss a payment, the contract slashes your collateral to cover
   it — the round still completes and honest members are never short-changed.
2. **A fair, unriggable payout order.** The order in which members receive the pot
   is drawn randomly when the pool fills — nobody can lobby or pay for the coveted
   early slots.
3. **Reputation as a credit ladder.** Complete a cycle cleanly → your on-chain
   score goes up (New → Bronze → Silver → Gold). Higher tiers unlock larger pools.
   Default once → a **permanent flag** on your record. This is a credit score
   built from *savings behavior* rather than debt.
4. **That reputation is readable by any app that speaks ENS** — because a member's
   standing is served as a **live ENS text record**, resolved on-chain at read
   time (see [ENS integration](#ens-integration-the-headline)).

The demo is a **real minimum-size pool** — 3 members, a small USDC contribution,
3 rounds, short windows — so the entire lifecycle (fill → randomized payout order →
on-time round → a slash/default round → payouts → cycle complete + reputation
update) runs live end-to-end. The demo *is* the product; there is no fake mode.

---

## Architecture

### Contracts (`src/`, Solidity + Foundry)

| Contract | Responsibility |
|---|---|
| `ROSCAFactory` | Deploys pools; enforces the **3-member floor** and per-tier caps at creation; wires each pool to the shared registry, identity gate, and naming adapter |
| `ROSCAPool` | One ROSCA cycle: join-with-collateral, randomized payout order, per-round `contribute → slash-on-miss → pay-winner → advance`, and final settlement (fees + reputation write) |
| `ROSCAPoolVRF` | A drop-in `ROSCAPool` subclass that sources the payout-order seed from **real Chainlink VRF v2.5** instead of the on-chain shuffle (see [Chainlink](#chainlink)) |
| `ReputationRegistry` | The one piece of shared, cross-pool state: a permanent record per identity — `cleanCycles` and a permanent `hasDefaulted` flag |
| `Tiers` (library) | The tier ladder: clean-cycle count → tier → max contribution / max members |
| `IIdentityGate` + `NoOpGate` | Identity abstraction — "a participant is present." Ships with a no-op gate; World ID is a swap-in behind the interface (see [World ID](#world-id)) |
| `IPoolNaming` + `PotluckENS` + `PotluckSubRegistry` + `ReputationResolver` | The ENS v2 layer — auto-mints pool/member subnames and serves live reputation via a wildcard resolver |

Everything the shared registry, identity, and naming touch sits **behind an
interface**, so each partner integration is an *upgrade, not a hard dependency*.
The ROSCA machine runs fully with the no-op identity gate and the no-op naming
adapter; swapping in the live implementations is a single owner setter call
(`setIdentityGate` / `setNaming`) — no redeploy of the pool logic.

### Round lifecycle

```
OPEN ──Nth join() fills last slot──▶ LOCKED ──randomness sets payout order──▶ ROUND_ACTIVE ──┐
                                                                              │   each round:  │
                                                          contribute() → slash misses →        │
                                                          pay winner → advance ────────────────┘
                                                                              │ after round N
                                                                              ▼
                                                                          COMPLETE
                                                                (refund collateral − fees,
                                                                 write reputation for
                                                                 clean finishers)
```

**Concrete mechanics, as implemented:**

- **Join:** `pot = contribution × memberCount`; **`collateralReq = pot / 2`**. Join
  is gated on the caller's tier — a pool larger than your tier allows, or below the
  pool's `minScore`, or (unless the pool opted in) a defaulter, all revert.
- **Slashing:** at `settleRound()`, every active member who didn't `contribute()` in
  the window is slashed by `min(contribution, collateral)`; their first miss in a
  cycle sets `defaultedThisCycle` and calls `recordDefault`. Run your collateral
  below one contribution and you're **ejected** (slot goes dead).
- **Payout:** winner for round *r* is `payoutOrder[r-1]`; they receive
  `min(pot, balance)` (capped at the contract's balance so a shorted cycle can never
  revert). An ejected winner's payout is skipped.
- **Settlement:** protocol fee **2%** of one pot (always) + creator bonus **5%**
  (invite-only pools, full completion only); remaining collateral is refunded minus
  each member's fee share; clean finishers get `recordCleanCycle` (+1 tier progress).

### Reputation & tiers (`Tiers.sol`)

| Tier | Clean cycles | Max contribution / round | Max members |
|---|---|---|---|
| New | 0 | 25 USDC | 6 |
| Bronze | 1–2 | 100 USDC | 10 |
| Silver | 3–5 | 500 USDC | 12 |
| Gold | 6+ | uncapped | uncapped |

The caps are the **anti-sybil ceiling**: a zero-reputation attacker can at most be
in a small pool having locked collateral against it, so vanishing after an early
payout nets little while permanently burning their reputation. Caps loosen only as
proven clean behavior accumulates. `recordDefault` sets the permanent flag but
**never erases the clean-cycle count** — history stays honest.

### Client (`client/`, Next.js)

A Next.js 16 / React 19 app: **wagmi 3 + viem 2** for chain reads/writes,
**Privy** for wallet onboarding, **TanStack Query** for pool state, Tailwind 4 for
the UI. It renders the pool lifecycle, mints test USDC, drives join/contribute, and
shows each member's reputation **resolved live through ENS** — never a value
fabricated in the frontend.

---

## Partner integrations

We went deep on the integrations that were genuinely reachable on the ENSv2 /
Sepolia beta stack in the time we had, and we're precise below about what is **live**
versus **coded but not the deployed path** versus **blocked**. No overclaiming.

### ENS integration (the headline)

**This is the deepest, and it is genuinely live on Sepolia.** PotLuck uses ENS v2
the way the bounty asks — as **central infrastructure**, not a cosmetic label — and
it does so with the pattern the ENS team recommended this hackathon: a **wildcard
resolver (ENSIP-10) that computes every answer at read time from on-chain state, with
no CCIP-Read and no off-chain gateway.**

- **`potluck.eth` is registered on Sepolia**, and our `ReputationResolver` is
  attached at that node. Because resolution is by wildcard, **every descendant name
  inherits the resolver** — no per-name resolver setup.
- **Pools get names automatically.** When the factory creates pool *N*, our
  `PotluckENS` adapter (wired in as the factory's naming adapter) deploys a
  `PotluckSubRegistry` for the pool and attaches it, giving it the name
  **`poolN.potluck.eth`**. This runs inside a `try/catch` in the factory so naming
  can never block pool creation.
- **Members get subnames automatically.** On join, the pool best-effort calls
  `registerMember`, which records `idKeyOf[namehash] = idKey` for the member's name
  **`0x<address-hex>.poolN.potluck.eth`** *before* any external call, so resolution
  works even if the mint step is a no-op on the beta. (The `0x`-prefixed lowercase
  hex label is the exact convention the frontend must reproduce to resolve a member —
  a mismatch silently breaks resolution, which is documented in `client/src/lib/ens.ts`.)
- **Reputation is a live text record.** `ReputationResolver.resolve` answers the
  text key **`potluck.reputation`** by looking up the name's `idKey` and reading
  `cleanCycles` + `hasDefaulted` **from `ReputationRegistry` at query time**, returning
  a string like `cleanCycles=3;defaulted=false;tier=Silver`. Nothing is cached; the
  answer is always the current on-chain truth. Resolve `0x<addr>.poolN.potluck.eth`
  through the UniversalResolver and you get that member's real, current reputation.
- **Honest by construction in the UI.** The client resolves this text record through
  `UniversalResolverV2` and **only displays a name or reputation when it genuinely
  resolves live** — a string the frontend constructs is never presented as fact, and
  there is no registry-derived fallback dressed up as ENS data. If it didn't resolve
  on-chain, the UI shows nothing.

Minimal ENSv2 interfaces (`IRegistry`, `IExtendedResolver`) are hand-declared in
`src/interfaces/IENSv2.sol` to match the Sepolia beta without pulling the full tree.

### Privy

**Integrated.** The client uses `@privy-io/react-auth` + `@privy-io/wagmi` for
wallet onboarding, so a user signs in and gets a wallet that then drives the actual
financial flow (deposit collateral → contribute each round → receive payout) — the
ROSCA mechanic *is* the Privy financial flow.

### World ID

**Attempted, blocked.** The design targets World ID **Selfie Check** as a
continuity / abuse-prevention signal — a hard live-human gate at join. We built the
seam for it: the contracts talk to identity only through **`IIdentityGate`**
(`verifyJoin` returns an `idKey`, must revert on a bad proof), and both the factory
and the pool call it. We could **not** get the Selfie Check integration working
end-to-end in time, so the deployed gate is **`NoOpGate`** (`isLiveGate() == false`):
it returns a per-wallet key and checks nothing. A real `WorldIDGate` drops in behind
the same interface via `factory.setIdentityGate(...)` with no change to pool logic —
the door is built, we just couldn't walk through it this round.

### Chainlink

- **VRF — coded as a real drop-in, not the deployed path.** `ROSCAPoolVRF.sol`
  extends `ROSCAPool` and Chainlink's official `VRFConsumerBaseV2Plus`, requesting a
  random word via `VRFV2PlusClient` and fulfilling it in `fulfillRandomWords`. It is
  real VRF v2.5. **But the factory deploys the plain `ROSCAPool`**, which seeds the
  Fisher–Yates payout shuffle from `keccak256(prevrandao, timestamp, address)` and
  fulfills synchronously — so the end-to-end demo runs without a funded VRF
  subscription. `_requestRandomness()` is the `virtual` seam; swapping to VRF means
  deploying the subclass with a funded subscription that lists the pool as a consumer.
- **Automation — not implemented.** Round advancement is a **permissionless
  `settleRound()` poke**: anyone (a keeper, a script, or Chainlink Automation) may
  call it once a round's window closes, and it does the slash/pay/advance atomically.
  We did not wire `checkUpkeep`/`performUpkeep`; the permissionless poke covers the
  same need for the demo.

We are **not** claiming a Chainlink bounty — VRF is present as a swap-in and
Automation is intentionally a manual poke.

---

## Live deployment (Sepolia)

See `deployments/sepolia.md` for the full record. Core stack:

| Contract | Address |
|---|---|
| MockUSDC | `0x701F864Bbf902C7943E2c40A3D5798F6Bd6028EB` |
| ROSCAFactory | `0xe1dA53345211C225A072fCaa3d16D611F39f5e4F` |
| ReputationRegistry | `0xC040A3819f6ecd30AD8416D7dA5FB7F41A7A577F` |
| PotluckENS (live naming adapter) | `0xED949A144afF19e66b6b48FBaE2940c473b1B905` |
| ReputationResolver | `0x65570cF7a7050a121F3b9a055c626e991e9198B5` |
| NoOpGate (identity) | `0x62972564798F7DB372d0471c43Fc206F395cf63a` |

`potluck.eth` is registered on Sepolia with `ReputationResolver` attached; the
factory's `naming()` points at `PotluckENS`, so every new pool auto-mints
`poolN.potluck.eth`. A one-tx rollback to the non-minting `NoOpNaming` adapter is
kept for safety if the ENSv2 beta hiccups mid-demo.

---

## Layout

```
src/
  ROSCAFactory.sol            # pool deployer + tier/floor enforcement + wiring
  ROSCAPool.sol              # one cycle: join, shuffle, rounds, slashing, settle
  ROSCAPoolVRF.sol           # VRF v2.5 drop-in variant (swap-in, not factory default)
  ReputationRegistry.sol     # cross-pool credit history (cleanCycles + hasDefaulted)
  Tiers.sol                  # tier ladder + caps
  interfaces/                # IIdentityGate, IPoolNaming, IENSv2
  identity/NoOpGate.sol      # no-op identity gate (World ID seam)
  naming/                    # PotluckENS, PotluckSubRegistry, ReputationResolver, NoOpNaming
test/                        # Foundry tests
script/                      # forge deploy scripts
deployments/sepolia.md       # live addresses
client/                      # Next.js frontend (wagmi + viem + Privy)
```

## Develop

Contracts:
```bash
forge build
forge test
```

Client:
```bash
cd client
npm install
npm run dev        # http://localhost:3000
```

---

_Built for ETHOnline 2026. Deep, live ENS v2 integration; Privy-powered financial
flow; World ID and Chainlink VRF built as swap-in seams behind interfaces._
