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
