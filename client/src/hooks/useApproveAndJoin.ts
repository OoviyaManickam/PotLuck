'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useTx, decodeRevert } from '@/hooks/useTx';
import { useToast } from '@/components/TxToast';
import { ADDRESSES } from '@/lib/contracts';
import { mockUsdcAbi } from '@/lib/abis/mockUsdc';
import { poolAbi } from '@/lib/abis/pool';

/**
 * Two-step join: joining a pool requires posting `collateralReq` mUSDC as
 * collateral, which the pool pulls via transferFrom during join(). The caller
 * must therefore have an ERC-20 allowance to the pool >= collateralReq first,
 * or join() reverts with ERC20InsufficientAllowance. This hook mirrors
 * useApproveAndContribute: approve the collateral (if needed), then join.
 */
export type ApproveJoinPhase =
  | 'idle'
  | 'approving'
  | 'approved'
  | 'joining'
  | 'done'
  | 'error';

interface UseApproveAndJoinReturn {
  run: () => void;
  phase: ApproveJoinPhase;
  approveHash: `0x${string}` | undefined;
  joinHash: `0x${string}` | undefined;
  error: Error | null;
  reset: () => void;
}

export function useApproveAndJoin(
  poolAddr: `0x${string}` | undefined,
  collateralReq: bigint | undefined,
  onSuccess?: () => void,
): UseApproveAndJoinReturn {
  const { address: wallet } = useAccount();
  const { addToast, updateToast } = useToast();

  const approveTx = useTx();
  const joinTx = useTx();

  const [phase, setPhase] = useState<ApproveJoinPhase>('idle');

  const approveToastRef = useRef<string>('');
  const joinToastRef = useRef<string>('');

  // Read current allowance to the pool.
  const { refetch: refetchAllowance } = useReadContract({
    address: ADDRESSES.mockUsdc,
    abi: mockUsdcAbi,
    functionName: 'allowance',
    args: wallet && poolAddr ? [wallet, poolAddr] : undefined,
    query: { enabled: !!wallet && !!poolAddr },
  });

  // ── run: entry point ────────────────────────────────────────────────────────

  const run = async () => {
    if (!wallet || !poolAddr || collateralReq === undefined) return;

    // Re-fetch allowance right before deciding.
    const { data: freshAllowance } = await refetchAllowance();
    const currentAllowance: bigint = (freshAllowance as bigint | undefined) ?? 0n;

    if (currentAllowance >= collateralReq) {
      // Already approved enough — go straight to join.
      setPhase('joining');
      joinToastRef.current = addToast({ variant: 'pending', message: 'Joining pool…' });
      joinTx.reset();
      joinTx.send({ address: poolAddr, abi: poolAbi, functionName: 'join', args: ['0x'] });
    } else {
      // Approve the collateral first.
      setPhase('approving');
      approveToastRef.current = addToast({
        variant: 'pending',
        message: 'Approving collateral spend…',
      });
      approveTx.reset();
      approveTx.send({
        address: ADDRESSES.mockUsdc,
        abi: mockUsdcAbi,
        functionName: 'approve',
        args: [poolAddr, collateralReq],
      });
    }
  };

  // ── Approve tx state machine ────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'approving') return;
    if (approveTx.status === 'confirming' && approveToastRef.current) {
      updateToast(approveToastRef.current, {
        variant: 'confirming',
        message: 'Approve tx submitted — confirming…',
      });
    }
  }, [phase, approveTx.status, updateToast]);

  useEffect(() => {
    if (phase !== 'approving') return;
    if (approveTx.status !== 'success') return;

    if (approveToastRef.current) {
      updateToast(approveToastRef.current, {
        variant: 'success',
        message: 'Collateral approved! Joining pool…',
        hash: approveTx.hash,
      });
      approveToastRef.current = '';
    }

    setPhase('approved'); // intermediate step so the join send fires once
  }, [phase, approveTx.status, approveTx.hash, updateToast]);

  // When phase flips to 'approved', send the join tx.
  useEffect(() => {
    if (phase !== 'approved') return;
    if (!poolAddr) return;

    setPhase('joining');
    joinToastRef.current = addToast({ variant: 'pending', message: 'Joining pool…' });
    joinTx.reset();
    joinTx.send({ address: poolAddr, abi: poolAbi, functionName: 'join', args: ['0x'] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]); // intentionally narrow: fire once when phase becomes 'approved'

  useEffect(() => {
    if (phase !== 'approving') return;
    if (approveTx.status !== 'error') return;

    const msg = decodeRevert(approveTx.error);
    if (approveToastRef.current) {
      updateToast(approveToastRef.current, { variant: 'error', message: `Approval failed: ${msg}` });
      approveToastRef.current = '';
    } else {
      addToast({ variant: 'error', message: `Approval failed: ${msg}` });
    }
    setPhase('error');
  }, [phase, approveTx.status, approveTx.error, updateToast, addToast]);

  // ── Join tx state machine ─────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'joining') return;
    if (joinTx.status === 'confirming' && joinToastRef.current) {
      updateToast(joinToastRef.current, {
        variant: 'confirming',
        message: 'Join tx submitted — confirming…',
      });
    }
  }, [phase, joinTx.status, updateToast]);

  useEffect(() => {
    if (phase !== 'joining') return;
    if (joinTx.status !== 'success') return;

    if (joinToastRef.current) {
      updateToast(joinToastRef.current, {
        variant: 'success',
        message: 'Joined pool!',
        hash: joinTx.hash,
      });
      joinToastRef.current = '';
    }

    setPhase('done');
    onSuccess?.();
  }, [phase, joinTx.status, joinTx.hash, updateToast, onSuccess]);

  useEffect(() => {
    if (phase !== 'joining') return;
    if (joinTx.status !== 'error') return;

    const msg = decodeRevert(joinTx.error);
    if (joinToastRef.current) {
      updateToast(joinToastRef.current, { variant: 'error', message: `Join failed: ${msg}` });
      joinToastRef.current = '';
    } else {
      addToast({ variant: 'error', message: `Join failed: ${msg}` });
    }
    setPhase('error');
  }, [phase, joinTx.status, joinTx.error, updateToast, addToast]);

  // ── reset ───────────────────────────────────────────────────────────────────

  const reset = () => {
    setPhase('idle');
    approveToastRef.current = '';
    joinToastRef.current = '';
    approveTx.reset();
    joinTx.reset();
  };

  const error = approveTx.error ?? joinTx.error;

  return {
    run,
    phase,
    approveHash: approveTx.hash,
    joinHash: joinTx.hash,
    error: error ?? null,
    reset,
  };
}
