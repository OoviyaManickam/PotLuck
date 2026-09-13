/**
 * Contracts module — addresses, chain config, and factory deploy block.
 *
 * FACTORY_DEPLOY_BLOCK: determined from
 * broadcast/Deploy.s.sol/11155111/run-latest.json — the ROSCAFactory CREATE
 * transaction receipt (contractAddress 0xe1da53345211c225a072fcaa3d16d611f39f5e4f)
 * has blockNumber "0xb270f3" = 11694323 (decimal).
 * All receipts in that broadcast share the same blockNumber, so this is exact.
 */

export const SEPOLIA_CHAIN_ID = 11155111;

export const ADDRESSES = {
  mockUsdc: "0x701F864Bbf902C7943E2c40A3D5798F6Bd6028EB" as `0x${string}`,
  factory: "0xe1dA53345211C225A072fCaa3d16D611F39f5e4F" as `0x${string}`,
  registry: "0xC040A3819f6ecd30AD8416D7dA5FB7F41A7A577F" as `0x${string}`,
  noOpGate: "0x62972564798F7DB372d0471c43Fc206F395cf63a" as `0x${string}`,
  noOpNaming: "0xF3CcF1dd9348ebEeDd68f557dc8Fb8090655a02A" as `0x${string}`,
} as const;

/**
 * Block at which ROSCAFactory was deployed on Sepolia.
 * Source: broadcast/Deploy.s.sol/11155111/run-latest.json receipt
 * blockNumber 0xb270f3 (factory CREATE tx hash:
 * 0x7fc06ba4295a54a280bd3a3df4baf422575e51b262490123e9e2cc1021a20b72)
 */
export const FACTORY_DEPLOY_BLOCK = 11694323n;

/**
 * Max block span per eth_getLogs request.
 *
 * Free-tier RPC providers (e.g. Alchemy's free plan on Sepolia) reject any
 * eth_getLogs / getContractEvents call whose [fromBlock, toBlock] range spans
 * more than 10 blocks with JSON-RPC error -32600. A single wide scan from
 * FACTORY_DEPLOY_BLOCK to 'latest' (~thousands of blocks) therefore fails
 * outright, so we must page the range in windows this size or smaller.
 */
export const MAX_LOG_BLOCK_RANGE = 10n;

/** How many chunk requests to run concurrently. Keeps the paged scan quick
 * without tripping per-second rate limits on free tiers. */
const LOG_CHUNK_CONCURRENCY = 8;

/**
 * getContractEvents over an arbitrarily wide block range, paged into windows
 * of MAX_LOG_BLOCK_RANGE so free-tier RPCs accept every request.
 *
 * Drop-in for `client.getContractEvents({ address, abi, eventName, fromBlock,
 * toBlock: 'latest' })`: resolves the current head, splits [fromBlock, head]
 * into fixed windows, fetches them with bounded concurrency, tolerates
 * per-window failures (a failed window contributes no logs rather than
 * rejecting the whole scan), and returns the merged logs in block order.
 *
 * `params` is passed through to each underlying getContractEvents call; any
 * fromBlock/toBlock in it is ignored in favor of the paged window.
 */
export async function getContractEventsChunked(
  client: {
    getBlockNumber: () => Promise<bigint>;
    getContractEvents: (args: any) => Promise<unknown[]>;
  },
  params: Record<string, unknown>,
  fromBlock: bigint,
): Promise<unknown[]> {
  const head = await client.getBlockNumber();
  if (head < fromBlock) return [];

  // Build the list of [start, end] windows (inclusive) up front.
  const windows: Array<[bigint, bigint]> = [];
  for (let start = fromBlock; start <= head; start += MAX_LOG_BLOCK_RANGE) {
    const end = start + MAX_LOG_BLOCK_RANGE - 1n;
    windows.push([start, end > head ? head : end]);
  }

  const merged: unknown[] = [];

  // Process windows in concurrency-limited batches, preserving order.
  for (let i = 0; i < windows.length; i += LOG_CHUNK_CONCURRENCY) {
    const batch = windows.slice(i, i + LOG_CHUNK_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(([start, end]) =>
        client.getContractEvents({ ...params, fromBlock: start, toBlock: end }),
      ),
    );
    for (const result of settled) {
      if (result.status === 'fulfilled') merged.push(...result.value);
    }
  }

  return merged;
}

/**
 * Like getContractEventsChunked, but also reports the head block it scanned to
 * and whether every window succeeded. Callers can persist `scannedTo` as a
 * cursor and pass it (+1) as `fromBlock` next time, so a long history is only
 * paid for once — subsequent scans cover just the handful of new blocks.
 *
 * `complete` is false if any window failed (e.g. a transient 429). When
 * incomplete, callers should NOT advance their persisted cursor past the last
 * fully-scanned point, or they'd permanently miss events in the gap. The
 * simplest safe rule: only advance the cursor when `complete` is true.
 */
export async function getContractEventsChunkedWithCursor(
  client: {
    getBlockNumber: () => Promise<bigint>;
    getContractEvents: (args: any) => Promise<unknown[]>;
  },
  params: Record<string, unknown>,
  fromBlock: bigint,
): Promise<{ logs: unknown[]; scannedTo: bigint; complete: boolean }> {
  const head = await client.getBlockNumber();
  if (head < fromBlock) {
    // Nothing new since last scan — cursor is already current.
    return { logs: [], scannedTo: head < 0n ? fromBlock - 1n : head, complete: true };
  }

  const windows: Array<[bigint, bigint]> = [];
  for (let start = fromBlock; start <= head; start += MAX_LOG_BLOCK_RANGE) {
    const end = start + MAX_LOG_BLOCK_RANGE - 1n;
    windows.push([start, end > head ? head : end]);
  }

  const merged: unknown[] = [];
  let complete = true;

  for (let i = 0; i < windows.length; i += LOG_CHUNK_CONCURRENCY) {
    const batch = windows.slice(i, i + LOG_CHUNK_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(([start, end]) =>
        client.getContractEvents({ ...params, fromBlock: start, toBlock: end }),
      ),
    );
    for (const result of settled) {
      if (result.status === 'fulfilled') merged.push(...result.value);
      else complete = false;
    }
  }

  return { logs: merged, scannedTo: head, complete };
}
