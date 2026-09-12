/**
 * PotLuck end-to-end lifecycle driver.
 *
 * Acts as "the client": creates a pool via the factory, has three members join
 * (the third join locks the pool, the dev-shuffle picks a payout order and starts
 * round 1), then runs every round — each member contributes, the window closes,
 * anyone settles — and finally reads back on-chain reputation.
 *
 * Works against any deployed PotLuck stack. On a local anvil node (chainId 31337)
 * it fast-forwards time with evm_increaseTime so the whole cycle runs in seconds.
 * On a live network it waits out the real window, so deploy the demo pool with
 * short period/window values.
 *
 * Required env (see .env.example):
 *   RPC_URL            JSON-RPC endpoint (default http://127.0.0.1:8545)
 *   FUNDER_KEY         key that owns ETH + can mint MockUSDC (anvil acct #0 default)
 *   FACTORY_ADDRESS    ROSCAFactory
 *   REGISTRY_ADDRESS   ReputationRegistry
 *   USDC_ADDRESS       MockUSDC
 * Optional:
 *   MEMBER1_KEY..MEMBER3_KEY  member keys; generated + gas-funded if unset
 *   CONTRIBUTION       per-round amount in 6-dec base units (default 10_000_000 = 10 mUSDC)
 *   PERIOD_SECONDS     round length (default 120 on anvil, else must be set)
 *   WINDOW_SECONDS     contribution window (default 60 on anvil, else must be set)
 */
import "dotenv/config";
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  parseUnits,
  formatUnits,
  keccak256,
  AbiCoder,
  getAddress,
  NonceManager,
  type HDNodeWallet,
} from "ethers";

// ---- minimal ABIs (only what the flow touches) ---------------------------
const FACTORY_ABI = [
  "function createPool((uint256 contribution,uint8 memberCount,uint32 periodSeconds,uint32 windowSeconds,uint8 minScore,bool acceptDefaulted,bool inviteOnly) cfg, bytes creatorProof) returns (address)",
  "function poolCount() view returns (uint256)",
  "function allPools(uint256) view returns (address)",
  "event PoolCreated(address indexed pool, address indexed creator, uint256 poolId, (uint256 contribution,uint8 memberCount,uint32 periodSeconds,uint32 windowSeconds,uint8 minScore,bool acceptDefaulted,bool inviteOnly) config)",
];

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
];

const USDC_ABI = [
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const REGISTRY_ABI = [
  "function cleanCycles(bytes32 idKey) view returns (uint32)",
  "function hasDefaulted(bytes32 idKey) view returns (bool)",
];

// ---- helpers --------------------------------------------------------------
const coder = AbiCoder.defaultAbiCoder();
const Status = ["OPEN", "LOCKED", "ROUND_ACTIVE", "COMPLETE", "CANCELLED"];

/** NoOpGate idKey = keccak256(abi.encode(wallet)). */
function idKeyOf(addr: string): string {
  return keccak256(coder.encode(["address"], [getAddress(addr)]));
}

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

function log(step: string, msg: string) {
  console.log(`\x1b[36m[${step}]\x1b[0m ${msg}`);
}

async function main() {
  const rpc = process.env.RPC_URL ?? "http://127.0.0.1:8545";
  const provider = new JsonRpcProvider(rpc);
  const net = await provider.getNetwork();
  const chainId = Number(net.chainId);
  const isAnvil = chainId === 31337;
  log("init", `RPC ${rpc} — chainId ${chainId}${isAnvil ? " (anvil, will time-travel)" : ""}`);

  // anvil default account #0. Wrap in a NonceManager so the many funder txs
  // (gas top-ups, mints, settlements) never collide on nonces.
  const funderKey =
    process.env.FUNDER_KEY ??
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const funderWallet = new Wallet(funderKey, provider);
  const funder = new NonceManager(funderWallet);
  const funderAddr = funderWallet.address;

  const factory = new Contract(need("FACTORY_ADDRESS"), FACTORY_ABI, funder);
  const usdc = new Contract(need("USDC_ADDRESS"), USDC_ABI, funder);
  const registry = new Contract(need("REGISTRY_ADDRESS"), REGISTRY_ABI, provider);

  const contribution = BigInt(process.env.CONTRIBUTION ?? parseUnits("10", 6).toString());
  const period = Number(process.env.PERIOD_SECONDS ?? (isAnvil ? 120 : 0));
  const window = Number(process.env.WINDOW_SECONDS ?? (isAnvil ? 60 : 0));
  if (!period || !window) throw new Error("set PERIOD_SECONDS and WINDOW_SECONDS on live networks");

  // --- members ------------------------------------------------------------
  const memberKeys = [
    process.env.MEMBER1_KEY,
    process.env.MEMBER2_KEY,
    process.env.MEMBER3_KEY,
  ];
  const members: (Wallet | HDNodeWallet)[] = memberKeys.map((k) =>
    k ? new Wallet(k, provider) : Wallet.createRandom().connect(provider),
  );
  const N = members.length;
  log("members", members.map((m) => m.address).join(", "));

  // fund each member with a little gas ETH if they have none.
  for (const m of members) {
    const bal = await provider.getBalance(m.address);
    if (bal === 0n) {
      const gasTop = isAnvil ? parseUnits("10", 18) : parseUnits("0.01", 18);
      await (await funder.sendTransaction({ to: m.address, value: gasTop })).wait();
      log("fund", `sent gas ETH to ${m.address}`);
    }
  }

  // --- create pool (creator = funder) ------------------------------------
  const cfg = {
    contribution,
    memberCount: N,
    periodSeconds: period,
    windowSeconds: window,
    minScore: 0,
    acceptDefaulted: true,
    inviteOnly: false,
  };
  const createTx = await factory.createPool(cfg, "0x");
  const rcpt = await createTx.wait();
  const created = rcpt!.logs
    .map((l: any) => {
      try {
        return factory.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p: any) => p?.name === "PoolCreated");
  const poolAddr: string = created!.args.pool;
  log("create", `pool ${poolAddr} (contribution ${formatUnits(contribution, 6)} mUSDC, ${N} members)`);

  const poolRead = new Contract(poolAddr, POOL_ABI, provider);
  const collateralReq: bigint = await poolRead.collateralReq();
  const pot: bigint = await poolRead.pot();
  log("create", `collateral ${formatUnits(collateralReq, 6)} / member, pot ${formatUnits(pot, 6)} mUSDC`);

  // --- fund + join --------------------------------------------------------
  const perMember = collateralReq + contribution * BigInt(N);
  for (const m of members) {
    await (await usdc.mint(m.address, perMember)).wait();
    const mUsdc = usdc.connect(m) as Contract;
    await (await mUsdc.approve(poolAddr, perMember)).wait();
  }
  log("fund", `minted + approved ${formatUnits(perMember, 6)} mUSDC each`);

  for (let i = 0; i < N; i++) {
    const pool = new Contract(poolAddr, POOL_ABI, members[i]);
    await (await pool.join("0x")).wait();
    const joined = await poolRead.memberCountJoined();
    log("join", `member ${i + 1} joined (${joined}/${N})`);
  }

  const statusAfterJoin = Number(await poolRead.status());
  const order: bigint[] = await poolRead.getPayoutOrder();
  log("lock", `status=${Status[statusAfterJoin]} payoutOrder=[${order.join(",")}] round=${await poolRead.currentRound()}`);

  // --- rounds -------------------------------------------------------------
  for (let round = 1; round <= N; round++) {
    for (let i = 0; i < N; i++) {
      const pool = new Contract(poolAddr, POOL_ABI, members[i]);
      await (await pool.contribute()).wait();
    }
    log("round", `round ${round}: all ${N} members contributed`);

    await advanceWindow(provider, isAnvil, window);

    const settler = new Contract(poolAddr, POOL_ABI, funder);
    await (await settler.settleRound()).wait();
    const winnerSlot = order[round - 1];
    log("round", `round ${round} settled — pot paid to slot ${winnerSlot} (member ${members[Number(winnerSlot)].address})`);
  }

  const finalStatus = Number(await poolRead.status());
  log("done", `pool status=${Status[finalStatus]}`);

  // --- reputation ---------------------------------------------------------
  for (let i = 0; i < N; i++) {
    const key = idKeyOf(members[i].address);
    const clean = await registry.cleanCycles(key);
    const defaulted = await registry.hasDefaulted(key);
    log("reputation", `member ${i + 1}: cleanCycles=${clean} hasDefaulted=${defaulted}`);
  }
}

/** Push past the contribution window so settleRound() can run. */
async function advanceWindow(provider: JsonRpcProvider, isAnvil: boolean, window: number) {
  if (isAnvil) {
    await provider.send("evm_increaseTime", [window + 1]);
    await provider.send("evm_mine", []);
  } else {
    const wait = (window + 5) * 1000;
    log("wait", `sleeping ${wait / 1000}s for the window to close...`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
