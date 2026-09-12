import "dotenv/config";
import { AbiCoder, Contract, JsonRpcProvider, Wallet, keccak256, type Signer } from "ethers";

/**
 * PotLuck end-to-end flow on Sepolia.
 *
 * Walks the full ROSCA lifecycle against the live deployed stack, exercising
 * every core contract function so you can see the whole mechanic work:
 *   SETUP -> FAUCET -> CREATE POOL -> JOIN x3 -> ROUNDS (contribute + settle)
 *   -> REPUTATION.
 *
 * The demo pool is created with a short period/window (set at deploy or via
 * env) so the script can wait out the contribution window and settle each
 * round in one run instead of waiting hours.
 *
 * All wallets are explicit keys in .env and must already hold a little Sepolia
 * ETH for gas. mUSDC comes from the MockUSDC faucet.
 */

const FACTORY_ABI = [
  "function createPool((uint256 contribution,uint8 memberCount,uint32 periodSeconds,uint32 windowSeconds,uint8 minScore,bool acceptDefaulted,bool inviteOnly) cfg, bytes creatorProof) returns (address)",
  "event PoolCreated(address indexed pool, address indexed creator, uint256 poolId, (uint256 contribution,uint8 memberCount,uint32 periodSeconds,uint32 windowSeconds,uint8 minScore,bool acceptDefaulted,bool inviteOnly) config)",
] as const;

const POOL_ABI = [
  "function join(bytes proof)",
  "function contribute()",
  "function settleRound()",
  "function status() view returns (uint8)",
  "function currentRound() view returns (uint8)",
  "function memberCount() view returns (uint8)",
  "function memberCountJoined() view returns (uint256)",
  "function contribution() view returns (uint256)",
  "function collateralReq() view returns (uint256)",
  "function pot() view returns (uint256)",
  "function getPayoutOrder() view returns (uint8[])",
  "function windowEndsAt() view returns (uint256)",
] as const;

const TOKEN_ABI = [
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
] as const;

const REGISTRY_ABI = [
  "function cleanCycles(bytes32 idKey) view returns (uint32)",
  "function hasDefaulted(bytes32 idKey) view returns (bool)",
] as const;

const SEPOLIA_RPC_URL = env("SEPOLIA_RPC_URL");
const CREATOR_PRIVATE_KEY = env("CREATOR_PRIVATE_KEY");
const MEMBER1_PRIVATE_KEY = env("MEMBER1_PRIVATE_KEY");
const MEMBER2_PRIVATE_KEY = env("MEMBER2_PRIVATE_KEY");
const MEMBER3_PRIVATE_KEY = env("MEMBER3_PRIVATE_KEY");
const MEMBER4_PRIVATE_KEY = env("MEMBER4_PRIVATE_KEY");
const TOKEN_ADDRESS = env("TOKEN_ADDRESS");
const FACTORY_ADDRESS = env("FACTORY_ADDRESS");
const REGISTRY_ADDRESS = env("REGISTRY_ADDRESS");

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function section(title: string): void {
  console.log(`\n${"=".repeat(60)}\n  ${title}\n${"=".repeat(60)}`);
}

function fmt(amount: bigint): string {
  return `${(Number(amount) / 1e6).toFixed(2)} mUSDC`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** NoOpGate idKey = keccak256(abi.encode(wallet)) — reputation is keyed to this. */
function idKey(addr: string): string {
  return keccak256(AbiCoder.defaultAbiCoder().encode(["address"], [addr]));
}

/** Mint mUSDC from the open MockUSDC faucet/mint so a member can cover the pool. */
async function fund(token: Contract, signer: Signer, amount: bigint, label: string) {
  const addr = await signer.getAddress();
  const bal = (await token.balanceOf(addr)) as bigint;
  if (bal >= amount) {
    console.log(`  ${label} already holds ${fmt(bal)} — skipping mint.`);
    return;
  }
  const tx = await token.connect(signer).getFunction("mint")(addr, amount - bal);
  await tx.wait();
  console.log(`  ${label} minted up to ${fmt(amount)}.`);
}

async function main() {
  section("SETUP");
  const provider = new JsonRpcProvider(SEPOLIA_RPC_URL);
  const creator = new Wallet(CREATOR_PRIVATE_KEY, provider);
  const members = [
    new Wallet(MEMBER1_PRIVATE_KEY, provider),
    new Wallet(MEMBER2_PRIVATE_KEY, provider),
    new Wallet(MEMBER3_PRIVATE_KEY, provider),
    new Wallet(MEMBER4_PRIVATE_KEY, provider),
  ];
  const N = members.length;

  console.log("Creator:  ", creator.address);
  members.forEach((m, i) => console.log(`Member ${i + 1}: `, m.address));
  console.log("Token:    ", TOKEN_ADDRESS);
  console.log("Factory:  ", FACTORY_ADDRESS);
  console.log("Registry: ", REGISTRY_ADDRESS);

  const token = new Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);
  const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, creator);
  const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);

  const contribution = BigInt(process.env.CONTRIBUTION ?? 10_000_000); // 10 mUSDC
  const period = Number(process.env.PERIOD_SECONDS ?? 180);
  const window = Number(process.env.WINDOW_SECONDS ?? 60);

  section("CREATE POOL");
  const cfg = {
    contribution,
    memberCount: N,
    periodSeconds: period,
    windowSeconds: window,
    minScore: 0,
    acceptDefaulted: true,
    inviteOnly: false,
  };
  let tx = await factory.getFunction("createPool")(cfg, "0x");
  console.log("  createPool tx:", tx.hash);
  const rcpt = await tx.wait();
  const created = rcpt.logs
    .map((l: any) => {
      try {
        return factory.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p: any) => p?.name === "PoolCreated");
  const poolAddr: string = created.args.pool;
  const poolRead = new Contract(poolAddr, POOL_ABI, provider);
  const collateralReq = (await poolRead.collateralReq()) as bigint;
  const pot = (await poolRead.pot()) as bigint;
  console.log(`  Pool: ${poolAddr}`);
  console.log(`  Contribution ${fmt(contribution)}/round, collateral ${fmt(collateralReq)}/member, pot ${fmt(pot)}`);

  section("FUND + JOIN");
  const perMember = collateralReq + contribution * BigInt(N);
  for (let i = 0; i < N; i++) {
    const m = members[i];
    await fund(token, m, perMember, `Member ${i + 1}`);
    let jtx = await (token.connect(m) as Contract).getFunction("approve")(poolAddr, perMember);
    await jtx.wait();
    jtx = await (new Contract(poolAddr, POOL_ABI, m)).getFunction("join")("0x");
    await jtx.wait();
    console.log(`  Member ${i + 1} joined (${await poolRead.memberCountJoined()}/${N}) — ${jtx.hash}`);
  }

  const order = (await poolRead.getPayoutOrder()) as bigint[];
  console.log(`  Pool locked. Payout order (member slots): [${order.join(", ")}], round ${await poolRead.currentRound()}.`);

  // Slash beat: the member scheduled to win the LAST round deliberately skips their
  // round-1 contribution. Collateral (2x contribution at N=4) absorbs one slash, so they
  // stay active and still win their round later — but they're flagged as having defaulted.
  const slackerSlot = Number(order[order.length - 1]);
  const slashRound = 1;
  console.log(
    `  DEMO: Member (slot ${slackerSlot}) ${members[slackerSlot].address} will skip round ${slashRound} to show a slash.`,
  );

  section("ROUNDS");
  for (let round = 1; round <= N; round++) {
    console.log(`\n  --- Round ${round} ---`);
    for (let i = 0; i < N; i++) {
      if (round === slashRound && i === slackerSlot) {
        console.log(`  Member (slot ${i}) SKIPS this round's contribution (demo slash).`);
        continue;
      }
      const ctx = await (new Contract(poolAddr, POOL_ABI, members[i])).getFunction("contribute")();
      await ctx.wait();
    }
    const contributed = round === slashRound ? N - 1 : N;
    console.log(`  ${contributed}/${N} members contributed.`);

    // settleRound reverts with NotYetTimeToAdvance while block.timestamp <= windowEndsAt.
    // Sepolia block timestamps drift from wall-clock, so don't trust Date.now(): poll the
    // chain's own latest-block timestamp and only settle once it has actually passed the window.
    const windowEndsAt = Number(await poolRead.windowEndsAt());
    for (;;) {
      const chainNow = Number((await provider.getBlock("latest"))!.timestamp);
      if (chainNow > windowEndsAt) break;
      const waitS = windowEndsAt - chainNow + 2;
      console.log(`  Window closes at ${windowEndsAt}, chain is at ${chainNow} — waiting ${waitS}s...`);
      await sleep(waitS * 1000);
    }

    const stx = await (new Contract(poolAddr, POOL_ABI, creator)).getFunction("settleRound")();
    await stx.wait();
    const winner = members[Number(order[round - 1])];
    console.log(`  Round ${round} settled — pot paid to Member (slot ${order[round - 1]}) ${winner.address} — ${stx.hash}`);
    if (round === slashRound) {
      console.log(`  Member (slot ${slackerSlot}) was slashed one contribution and flagged as defaulted (still active).`);
    }
  }

  const StatusNames = ["OPEN", "LOCKED", "ROUND_ACTIVE", "COMPLETE", "CANCELLED"];
  console.log(`\n  Pool status: ${StatusNames[Number(await poolRead.status())]}`);

  section("REPUTATION");
  for (let i = 0; i < N; i++) {
    const key = idKey(members[i].address);
    const clean = await registry.cleanCycles(key);
    const defaulted = await registry.hasDefaulted(key);
    console.log(`  Member ${i + 1}: cleanCycles=${clean}, hasDefaulted=${defaulted}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exitCode = 1;
});
