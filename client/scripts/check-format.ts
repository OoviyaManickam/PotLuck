#!/usr/bin/env tsx
/**
 * Sanity check for format.ts — run with: npx tsx scripts/check-format.ts
 */
import { formatUsdc, parseUsdc, tierName, statusName } from "../src/lib/format";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL: ${msg}`);
    failed++;
  }
}

console.log("Running format sanity checks...\n");

assert(parseUsdc("100") === 100_000_000n, "parseUsdc('100') === 100000000n");
assert(formatUsdc(100_000_000n) === "100", "formatUsdc(100000000n) === '100'");
assert(tierName(2) === "Silver", "tierName(2) === 'Silver'");
assert(statusName(2) === "ROUND_ACTIVE", "statusName(2) === 'ROUND_ACTIVE'");

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
