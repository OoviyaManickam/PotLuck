'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useTx, decodeRevert } from '@/hooks/useTx';
import { useToast } from '@/components/TxToast';
import { ADDRESSES } from '@/lib/contracts';
import { mockUsdcAbi } from '@/lib/abis/mockUsdc';
import { poolAbi } from '@/lib/abis/pool';

export type ApproveContributePhase =
  | 'idle'
  | 'approving'
  | 'approved'
  | 'contributing'
  | 'done'
  | 'error';

interface UseApproveAndContributeReturn {
  run: () => void;
  phase: ApproveContributePhase;
  approveHash: `0x${string}` | undefined;
  contributeHash: `0x${string}` | undefined;
  error: Error | null;
  reset: () => void;
}

export function useApproveAndContribute(
  poolAddr: `0x${string}` | undefined,
  contribution: bigint | undefined,
  onSuccess?: () => void,
): UseApproveAndContributeReturn {
  const { address: wallet } = useAccount();
  const { addToast, updateToast } = useToast();

  const approveTx = useTx();
  const contributeTx = useTx();

  const [phase, setPhase] = useState<ApproveContributePhase>('idle');

  // Stable ref for toast IDs so effects don't re-fire on every render
  const approveToastRef = useRef<string>('');
  const contributeToastRef = useRef<string>('');

  // Read current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ADDRESSES.mockUsdc,
    abi: mockUsdcAbi,
    functionName: 'allowance',
    args: wallet && poolAddr ? [wallet, poolAddr] : undefined,
    query: { enabled: !!wallet && !!poolAddr },
  });

  // ── run: entry point ────────────────────────────────────────────────────────

  const run = async () => {
    if (!wallet || !poolAddr || contribution === undefined) return;

    // Re-fetch allowance right before deciding
    const { data: freshAllowance } = await refetchAllowance();
    const currentAllowance: bigint = (freshAllowance as bigint | undefined) ?? 0n;

    if (currentAllowance >= contribution) {
      // Already approved — go straight to contribute
      setPhase('contributing');
      contributeToastRef.current = addToast({
        variant: 'pending',
        message: 'Submitting contribution…',
      });
      contributeTx.reset();
      contributeTx.send({
        address: poolAddr,
        abi: poolAbi,
        functionName: 'contribute',
        args: [],
      });
    } else {
      // Need to approve first
      setPhase('approving');
      approveToastRef.current = addToast({
        variant: 'pending',
        message: 'Approving mUSDC spend…',
      });
      approveTx.reset();
      approveTx.send({
        address: ADDRESSES.mockUsdc,
        abi: mockUsdcAbi,
        functionName: 'approve',
        args: [poolAddr, contribution],
      });
    }
  };

  // ── Approve tx state machine ────────────────────────────────────────────────

  // confirming state: update toast
  useEffect(() => {
    if (phase !== 'approving') return;
    if (approveTx.status === 'confirming' && approveToastRef.current) {
      updateToast(approveToastRef.current, {
        variant: 'confirming',
        message: 'Approve tx submitted — confirming…',
      });
    }
  }, [phase, approveTx.status, updateToast]);

  // success: advance phase to contributing, THEN fire the contribute tx
  useEffect(() => {
    if (phase !== 'approving') return;
    if (approveTx.status !== 'success') return;

    if (approveToastRef.current) {
      updateToast(approveToastRef.current, {
        variant: 'success',
        message: 'Approval confirmed! Submitting contribution…',
        hash: approveTx.hash,
      });
      approveToastRef.current = '';
    }

    setPhase('approved'); // intermediate step so the contribute send fires once
  }, [phase, approveTx.status, approveTx.hash, updateToast]);

  // When phase flips to 'approved', send contribute tx
  useEffect(() => {
    if (phase !== 'approved') return;
    if (!poolAddr) return;

    setPhase('contributing');
    contributeToastRef.current = addToast({
      variant: 'pending',
      message: 'Submitting contribution…',
    });
    contributeTx.reset();
    contributeTx.send({
      address: poolAddr,
      abi: poolAbi,
      functionName: 'contribute',
      args: [],
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]); // intentionally narrow: fire once when phase becomes 'approved'

  // approve error
  useEffect(() => {
    if (phase !== 'approving') return;
    if (approveTx.status !== 'error') return;

    const msg = decodeRevert(approveTx.error);
    if (approveToastRef.current) {
      updateToast(approveToastRef.current, {
        variant: 'error',
        message: `Approval failed: ${msg}`,
      });
      approveToastRef.current = '';
    } else {
      addToast({ variant: 'error', message: `Approval failed: ${msg}` });
    }
    setPhase('error');
  }, [phase, approveTx.status, approveTx.error, updateToast, addToast]);

  // ── Contribute tx state machine ─────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'contributing') return;
    if (contributeTx.status === 'confirming' && contributeToastRef.current) {
      updateToast(contributeToastRef.current, {
        variant: 'confirming',
        message: 'Contribution tx submitted — confirming…',
      });
    }
  }, [phase, contributeTx.status, updateToast]);

  useEffect(() => {
    if (phase !== 'contributing') return;
    if (contributeTx.status !== 'success') return;

    if (contributeToastRef.current) {
      updateToast(contributeToastRef.current, {
        variant: 'success',
        message: 'Contribution confirmed!',
        hash: contributeTx.hash,
      });
      contributeToastRef.current = '';
    }

    setPhase('done');
    onSuccess?.();
  }, [phase, contributeTx.status, contributeTx.hash, updateToast, onSuccess]);

  useEffect(() => {
    if (phase !== 'contributing') return;
    if (contributeTx.status !== 'error') return;

    const msg = decodeRevert(contributeTx.error);
    if (contributeToastRef.current) {
      updateToast(contributeToastRef.current, {
        variant: 'error',
        message: `Contribution failed: ${msg}`,
      });
      contributeToastRef.current = '';
    } else {
      addToast({ variant: 'error', message: `Contribution failed: ${msg}` });
    }
    setPhase('error');
  }, [phase, contributeTx.status, contributeTx.error, updateToast, addToast]);

  // ── reset ───────────────────────────────────────────────────────────────────

  const reset = () => {
    setPhase('idle');
    approveToastRef.current = '';
    contributeToastRef.current = '';
    approveTx.reset();
    contributeTx.reset();
  };

  const error = approveTx.error ?? contributeTx.error;

  return {
    run,
    phase,
    approveHash: approveTx.hash,
    contributeHash: contributeTx.hash,
    error: error ?? null,
    reset,
  };
}
