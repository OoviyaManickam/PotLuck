'use client';

import { useEffect, useRef } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useTx, decodeRevert } from '@/hooks/useTx';
import { useApproveAndContribute } from '@/hooks/useApproveAndContribute';
import { useToast } from '@/components/TxToast';
import { PillButton } from '@/components/PillButton';
import { SEPOLIA_CHAIN_ID } from '@/lib/contracts';
import { poolAbi } from '@/lib/abis/pool';
import { PoolDetail, PoolStatus } from '@/lib/types';

interface Props {
  pool: PoolDetail;
  poolAddr: `0x${string}`;
  refetch: () => void;
}

export function PoolActions({ pool, poolAddr, refetch }: Props) {
  const { address: wallet, isConnected } = useAccount();
  const chainId = useChainId();
  const { addToast, updateToast } = useToast();

  const onSepoliaAndConnected = isConnected && chainId === SEPOLIA_CHAIN_ID;

  const {
    status,
    mySlotPlusOne,
    iPaidThisRound,
    creator,
    contribution,
  } = pool;

  const isMember = mySlotPlusOne > 0n;
  const isCreator = wallet && creator.toLowerCase() === wallet.toLowerCase();

  // ── Join ──────────────────────────────────────────────────────────────────
  const joinTx = useTx();
  const joinToastRef = useRef('');

  useEffect(() => {
    if (joinTx.status === 'pending') {
      joinToastRef.current = addToast({ variant: 'pending', message: 'Joining pool…' });
    }
  }, [joinTx.status, addToast]);

  useEffect(() => {
    if (joinTx.status === 'confirming' && joinToastRef.current) {
      updateToast(joinToastRef.current, { variant: 'confirming', message: 'Join tx submitted — confirming…' });
    }
  }, [joinTx.status, updateToast]);

  useEffect(() => {
    if (joinTx.status === 'success') {
      if (joinToastRef.current) {
        updateToast(joinToastRef.current, { variant: 'success', message: 'Joined pool!', hash: joinTx.hash });
        joinToastRef.current = '';
      }
      refetch();
      joinTx.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinTx.status, joinTx.hash]);

  useEffect(() => {
    if (joinTx.status === 'error' && joinTx.error) {
      const msg = decodeRevert(joinTx.error);
      if (joinToastRef.current) {
        updateToast(joinToastRef.current, { variant: 'error', message: `Join failed: ${msg}` });
        joinToastRef.current = '';
      } else {
        addToast({ variant: 'error', message: `Join failed: ${msg}` });
      }
      joinTx.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinTx.status, joinTx.error]);

  const handleJoin = () => {
    joinTx.send({ address: poolAddr, abi: poolAbi, functionName: 'join', args: ['0x'] });
  };

  // ── Settle Round ──────────────────────────────────────────────────────────
  const settleTx = useTx();
  const settleToastRef = useRef('');

  useEffect(() => {
    if (settleTx.status === 'pending') {
      settleToastRef.current = addToast({ variant: 'pending', message: 'Settling round…' });
    }
  }, [settleTx.status, addToast]);

  useEffect(() => {
    if (settleTx.status === 'confirming' && settleToastRef.current) {
      updateToast(settleToastRef.current, { variant: 'confirming', message: 'Settle tx submitted — confirming…' });
    }
  }, [settleTx.status, updateToast]);

  useEffect(() => {
    if (settleTx.status === 'success') {
      if (settleToastRef.current) {
        updateToast(settleToastRef.current, { variant: 'success', message: 'Round settled!', hash: settleTx.hash });
        settleToastRef.current = '';
      }
      refetch();
      settleTx.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleTx.status, settleTx.hash]);

  useEffect(() => {
    if (settleTx.status === 'error' && settleTx.error) {
      const msg = decodeRevert(settleTx.error);
      if (settleToastRef.current) {
        updateToast(settleToastRef.current, { variant: 'error', message: `Settle failed: ${msg}` });
        settleToastRef.current = '';
      } else {
        addToast({ variant: 'error', message: `Settle failed: ${msg}` });
      }
      settleTx.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleTx.status, settleTx.error]);

  const handleSettle = () => {
    settleTx.send({ address: poolAddr, abi: poolAbi, functionName: 'settleRound', args: [] });
  };

  // ── Cancel ────────────────────────────────────────────────────────────────
  const cancelTx = useTx();
  const cancelToastRef = useRef('');

  useEffect(() => {
    if (cancelTx.status === 'pending') {
      cancelToastRef.current = addToast({ variant: 'pending', message: 'Cancelling pool…' });
    }
  }, [cancelTx.status, addToast]);

  useEffect(() => {
    if (cancelTx.status === 'confirming' && cancelToastRef.current) {
      updateToast(cancelToastRef.current, { variant: 'confirming', message: 'Cancel tx submitted — confirming…' });
    }
  }, [cancelTx.status, updateToast]);

  useEffect(() => {
    if (cancelTx.status === 'success') {
      if (cancelToastRef.current) {
        updateToast(cancelToastRef.current, { variant: 'success', message: 'Pool cancelled.', hash: cancelTx.hash });
        cancelToastRef.current = '';
      }
      refetch();
      cancelTx.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelTx.status, cancelTx.hash]);

  useEffect(() => {
    if (cancelTx.status === 'error' && cancelTx.error) {
      const msg = decodeRevert(cancelTx.error);
      if (cancelToastRef.current) {
        updateToast(cancelToastRef.current, { variant: 'error', message: `Cancel failed: ${msg}` });
        cancelToastRef.current = '';
      } else {
        addToast({ variant: 'error', message: `Cancel failed: ${msg}` });
      }
      cancelTx.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelTx.status, cancelTx.error]);

  const handleCancel = () => {
    cancelTx.send({ address: poolAddr, abi: poolAbi, functionName: 'cancel', args: [] });
  };

  // ── Approve + Contribute ──────────────────────────────────────────────────
  const { run: runContribute, phase: contributePhase } = useApproveAndContribute(
    poolAddr,
    contribution,
    refetch,
  );

  // ── Gating ────────────────────────────────────────────────────────────────
  const canJoin =
    onSepoliaAndConnected &&
    status === PoolStatus.OPEN &&
    !isMember &&
    joinTx.status === 'idle';

  const canContribute =
    onSepoliaAndConnected &&
    status === PoolStatus.ROUND_ACTIVE &&
    isMember &&
    !iPaidThisRound &&
    (contributePhase === 'idle' || contributePhase === 'done' || contributePhase === 'error');

  const canSettle =
    onSepoliaAndConnected &&
    (status === PoolStatus.ROUND_ACTIVE || status === PoolStatus.LOCKED) &&
    settleTx.status === 'idle';

  const canCancel =
    onSepoliaAndConnected &&
    isCreator &&
    status === PoolStatus.OPEN &&
    cancelTx.status === 'idle';

  const showSettle = status === PoolStatus.ROUND_ACTIVE || status === PoolStatus.LOCKED;
  const showCancel = Boolean(isCreator) && status === PoolStatus.OPEN;

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-surface-2 bg-surface p-6 text-center text-sm text-text-muted">
        Connect your wallet to interact with this pool.
      </div>
    );
  }

  if (chainId !== SEPOLIA_CHAIN_ID) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-surface p-6 text-center text-sm text-red-400">
        Switch to Sepolia to interact with this pool.
      </div>
    );
  }

  const contributeLabel =
    contributePhase === 'approving'
      ? 'Approving…'
      : contributePhase === 'contributing'
        ? 'Contributing…'
        : 'Approve + Contribute';

  return (
    <section className="rounded-2xl border border-surface-2 bg-surface p-6 flex flex-col gap-3">
      <h2 className="text-base font-semibold text-text">Actions</h2>
      <div className="flex flex-wrap gap-3">
        {/* Join */}
        {status === PoolStatus.OPEN && !isMember && (
          <PillButton
            variant="accent"
            onClick={handleJoin}
            disabled={!canJoin || joinTx.status === 'pending' || joinTx.status === 'confirming'}
          >
            {joinTx.status === 'pending' || joinTx.status === 'confirming' ? 'Joining…' : 'Join Pool'}
          </PillButton>
        )}

        {/* Approve + Contribute */}
        {status === PoolStatus.ROUND_ACTIVE && isMember && !iPaidThisRound && (
          <PillButton
            variant="accent"
            onClick={runContribute}
            disabled={!canContribute}
          >
            {contributeLabel}
          </PillButton>
        )}

        {/* Already paid this round */}
        {status === PoolStatus.ROUND_ACTIVE && isMember && iPaidThisRound && (
          <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-semibold text-accent">
            Paid this round
          </span>
        )}

        {/* Settle Round */}
        {showSettle && (
          <PillButton
            variant="dark"
            onClick={handleSettle}
            disabled={!canSettle}
          >
            {settleTx.status === 'pending' || settleTx.status === 'confirming' ? 'Settling…' : 'Settle Round'}
          </PillButton>
        )}

        {/* Cancel */}
        {showCancel && (
          <PillButton
            variant="ghost"
            onClick={handleCancel}
            disabled={!canCancel}
            className="border-red-500/40 text-red-400 hover:bg-red-500/10"
          >
            {cancelTx.status === 'pending' || cancelTx.status === 'confirming' ? 'Cancelling…' : 'Cancel Pool'}
          </PillButton>
        )}
      </div>
    </section>
  );
}
