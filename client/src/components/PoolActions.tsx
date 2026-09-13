'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useTx, decodeRevert } from '@/hooks/useTx';
import { useApproveAndContribute } from '@/hooks/useApproveAndContribute';
import { useApproveAndJoin } from '@/hooks/useApproveAndJoin';
import { useToast } from '@/components/TxToast';
import { PillButton } from '@/components/PillButton';
import { WindowCountdown } from '@/components/WindowCountdown';
import { SEPOLIA_CHAIN_ID } from '@/lib/contracts';
import { formatUsdc } from '@/lib/format';
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
    collateralReq,
    windowEndsAt,
  } = pool;

  // Ticking clock (1s) so the Settle gate re-enables live the moment the
  // contribution window closes, without a refetch. Only relevant during
  // ROUND_ACTIVE; harmless otherwise.
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (status !== PoolStatus.ROUND_ACTIVE) return;
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [status]);

  // The window is still open (contributions allowed, settle not yet callable)
  // when we're ROUND_ACTIVE and now is at/before windowEndsAt. LOCKED has no
  // window yet, so it's never "window-open" for settle purposes.
  const windowStillOpen =
    status === PoolStatus.ROUND_ACTIVE &&
    windowEndsAt > 0n &&
    nowSec <= Number(windowEndsAt);

  const isMember = mySlotPlusOne > 0n;
  const isCreator = wallet && creator.toLowerCase() === wallet.toLowerCase();

  // ── Join (approve collateral → join) ────────────────────────────────────────
  // Joining posts `collateralReq` mUSDC as collateral, pulled via transferFrom,
  // so the wallet must approve the pool for that amount first. We gate the whole
  // flow behind an explicit collateral-consent modal.
  const { run: runJoin, phase: joinPhase, reset: resetJoin } = useApproveAndJoin(
    poolAddr,
    collateralReq,
    () => {
      refetch();
      setShowJoinConsent(false);
      setJoinConsentChecked(false);
    },
  );
  const [showJoinConsent, setShowJoinConsent] = useState(false);
  const [joinConsentChecked, setJoinConsentChecked] = useState(false);

  const joinInFlight = joinPhase === 'approving' || joinPhase === 'approved' || joinPhase === 'joining';

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
    !joinInFlight;

  const canContribute =
    onSepoliaAndConnected &&
    status === PoolStatus.ROUND_ACTIVE &&
    isMember &&
    !iPaidThisRound &&
    (contributePhase === 'idle' || contributePhase === 'done' || contributePhase === 'error');

  const canSettle =
    onSepoliaAndConnected &&
    (status === PoolStatus.ROUND_ACTIVE || status === PoolStatus.LOCKED) &&
    // The contract reverts settleRound() with NotYetTimeToAdvance until the
    // window closes. Don't let the user click into that revert — only enable
    // once the window has actually elapsed. (LOCKED has no open window.)
    !windowStillOpen &&
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

      {/* Live contribution-window status — tells the user when contributions
          are open and, once it closes, that the round is ready to settle. */}
      <WindowCountdown windowEndsAt={windowEndsAt} status={status} />

      <div className="flex flex-wrap gap-3">
        {/* Join */}
        {status === PoolStatus.OPEN && !isMember && (
          <PillButton
            variant="accent"
            onClick={() => setShowJoinConsent(true)}
            disabled={!canJoin}
          >
            {joinPhase === 'approving'
              ? 'Approving…'
              : joinPhase === 'joining' || joinPhase === 'approved'
                ? 'Joining…'
                : 'Join Pool'}
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
            title={
              windowStillOpen
                ? `Can settle once the contribution window closes (${Math.max(0, Number(windowEndsAt) - nowSec)}s left)`
                : undefined
            }
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

      {/* Collateral consent modal */}
      {showJoinConsent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-consent-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-surface-2 bg-surface p-6 shadow-2xl">
            <h3 id="join-consent-title" className="text-lg font-semibold text-text">
              Join pool — post collateral
            </h3>

            <p className="mt-3 text-sm text-text-muted">
              To join this pool you must post{' '}
              <span className="font-semibold text-text">{formatUsdc(collateralReq)} mUSDC</span>{' '}
              as collateral. This is locked in the pool for the duration of the cycle and
              returned to you when the cycle completes — provided you don&apos;t default on a
              round. If you miss a required contribution, your collateral can be used to make the
              pot whole.
            </p>

            <div className="mt-4 space-y-2 rounded-xl border border-surface-2 bg-surface-2/40 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Collateral (posted now)</span>
                <span className="font-semibold text-text">{formatUsdc(collateralReq)} mUSDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Contribution (each round)</span>
                <span className="font-semibold text-text">{formatUsdc(contribution)} mUSDC</span>
              </div>
            </div>

            <p className="mt-3 text-xs text-text-muted">
              You&apos;ll be asked to approve the collateral spend, then confirm the join —
              two wallet transactions.
            </p>

            <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={joinConsentChecked}
                onChange={(e) => setJoinConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-accent"
              />
              <span>
                I understand that {formatUsdc(collateralReq)} mUSDC will be locked as collateral,
                and I agree to the pool&apos;s terms.
              </span>
            </label>

            <div className="mt-5 flex justify-end gap-3">
              <PillButton
                variant="ghost"
                onClick={() => {
                  if (joinInFlight) return;
                  setShowJoinConsent(false);
                  setJoinConsentChecked(false);
                  resetJoin();
                }}
                disabled={joinInFlight}
              >
                Cancel
              </PillButton>
              <PillButton
                variant="accent"
                onClick={runJoin}
                disabled={!joinConsentChecked || !canJoin}
              >
                {joinPhase === 'approving'
                  ? 'Approving…'
                  : joinPhase === 'joining' || joinPhase === 'approved'
                    ? 'Joining…'
                    : 'Approve & Join'}
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
