'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useTx, decodeRevert } from '@/hooks/useTx';
import { useToast } from '@/components/TxToast';
import { ADDRESSES, SEPOLIA_CHAIN_ID } from '@/lib/contracts';
import { factoryAbi } from '@/lib/abis/factory';
import { parseUsdc, formatUsdc } from '@/lib/format';
import { PillButton } from '@/components/PillButton';
import { TIER_CAPS, MIN_MEMBERS } from '@/lib/sampleData';

interface CreatePoolFormProps {
  onSuccess?: () => void; // called after successful pool creation so page can refetch
}

export function CreatePoolForm({ onSuccess }: CreatePoolFormProps) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { send, status, hash, error, reset } = useTx();
  const { addToast, updateToast } = useToast();
  const toastIdRef = useRef<string>('');

  // Form state
  const [contribution, setContribution] = useState('10'); // USDC string
  const [memberCount, setMemberCount] = useState(String(MIN_MEMBERS));
  const [periodSeconds, setPeriodSeconds] = useState('300');
  const [windowSeconds, setWindowSeconds] = useState('120');
  const [minScore, setMinScore] = useState('0');
  const [acceptDefaulted, setAcceptDefaulted] = useState(true);
  const [inviteOnly, setInviteOnly] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Guard: must be connected + on Sepolia
  const onSepolia = chainId === SEPOLIA_CHAIN_ID;
  const canSubmit = isConnected && onSepolia && (status === 'idle' || status === 'success' || status === 'error');

  // Toast lifecycle
  useEffect(() => {
    if (status === 'pending') {
      toastIdRef.current = addToast({ variant: 'pending', message: 'Creating pool…' });
    }
  }, [status, addToast]);

  useEffect(() => {
    if (status === 'confirming' && toastIdRef.current) {
      updateToast(toastIdRef.current, { variant: 'confirming', message: 'Transaction submitted — confirming on-chain…' });
    }
  }, [status, updateToast]);

  useEffect(() => {
    if (status === 'success') {
      if (toastIdRef.current) {
        updateToast(toastIdRef.current, { variant: 'success', message: 'Pool created!', hash });
        toastIdRef.current = '';
      } else {
        addToast({ variant: 'success', message: 'Pool created!', hash });
      }
      onSuccess?.(); // trigger page-level refetch
      reset();
    }
  }, [status, hash, onSuccess, updateToast, addToast, reset]);

  useEffect(() => {
    if (status === 'error' && error) {
      const msg = decodeRevert(error);
      if (toastIdRef.current) {
        updateToast(toastIdRef.current, { variant: 'error', message: `Create failed: ${msg}` });
        toastIdRef.current = '';
      } else {
        addToast({ variant: 'error', message: `Create failed: ${msg}` });
      }
      reset();
    }
  }, [status, error, updateToast, addToast, reset]);

  function validate(): string | null {
    const mc = Number(memberCount);
    if (isNaN(mc) || mc < MIN_MEMBERS) return `Minimum ${MIN_MEMBERS} members.`;

    let contribBigint: bigint;
    try {
      contribBigint = parseUsdc(contribution);
    } catch {
      return 'Invalid contribution amount.';
    }
    if (contribBigint <= 0n) return 'Contribution must be positive.';

    // Validate against New-tier caps (conservative default; on-chain enforces real tier)
    const cap = TIER_CAPS.New;
    if (contribBigint > cap.contribution) {
      return `Contribution exceeds New-tier cap (${formatUsdc(cap.contribution)} mUSDC). The pool will be rejected on-chain if your tier is too low.`;
    }
    if (mc > cap.memberCount) {
      return `Member count exceeds New-tier cap (${cap.memberCount}). The pool will be rejected on-chain if your tier is too low.`;
    }

    const ps = Number(periodSeconds);
    const ws = Number(windowSeconds);
    if (isNaN(ps) || ps <= 0) return 'Period must be positive.';
    if (isNaN(ws) || ws <= 0) return 'Window must be positive.';
    if (ws >= ps) return 'Window must be shorter than period.';

    const ms = Number(minScore);
    if (isNaN(ms) || ms < 0 || ms > 255) return 'Min score must be 0–255.';

    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    setValidationError(err);
    if (err) return;

    const cfg = {
      contribution: parseUsdc(contribution),
      memberCount: Number(memberCount),
      periodSeconds: Number(periodSeconds),
      windowSeconds: Number(windowSeconds),
      minScore: Number(minScore),
      acceptDefaulted,
      inviteOnly,
    } as const;

    send({
      address: ADDRESSES.factory,
      abi: factoryAbi,
      functionName: 'createPool',
      args: [cfg, '0x'],
    });
  }

  const isPending = status === 'pending' || status === 'confirming';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Guard banners */}
      {!isConnected && (
        <p className="text-sm text-text-muted rounded-xl border border-surface-2 bg-surface p-3">
          Connect your wallet to create a pool.
        </p>
      )}
      {isConnected && !onSepolia && (
        <p className="text-sm text-red-300 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          Switch to Sepolia to create a pool.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Contribution */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted font-medium">Contribution (mUSDC / round)</span>
          <input
            type="number"
            min="0.000001"
            step="any"
            value={contribution}
            onChange={(e) => setContribution(e.target.value)}
            className="rounded-xl border border-surface-2 bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/60"
            placeholder="10"
          />
        </label>

        {/* Member count */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted font-medium">Members (min {MIN_MEMBERS})</span>
          <input
            type="number"
            min={MIN_MEMBERS}
            max={255}
            step={1}
            value={memberCount}
            onChange={(e) => setMemberCount(e.target.value)}
            className="rounded-xl border border-surface-2 bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/60"
          />
        </label>

        {/* Period seconds */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted font-medium">Period (seconds)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={periodSeconds}
            onChange={(e) => setPeriodSeconds(e.target.value)}
            className="rounded-xl border border-surface-2 bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/60"
          />
        </label>

        {/* Window seconds */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted font-medium">Window (seconds)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={windowSeconds}
            onChange={(e) => setWindowSeconds(e.target.value)}
            className="rounded-xl border border-surface-2 bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/60"
          />
        </label>

        {/* Min score */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted font-medium">Min trust score (0–255)</span>
          <input
            type="number"
            min={0}
            max={255}
            step={1}
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            className="rounded-xl border border-surface-2 bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/60"
          />
        </label>
      </div>

      {/* Checkboxes */}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={acceptDefaulted}
            onChange={(e) => setAcceptDefaulted(e.target.checked)}
            className="accent-accent w-4 h-4 rounded"
          />
          <span className="text-sm text-text-muted">Accept defaulted members</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={inviteOnly}
            onChange={(e) => setInviteOnly(e.target.checked)}
            className="accent-accent w-4 h-4 rounded"
          />
          <span className="text-sm text-text-muted">Invite only</span>
        </label>
      </div>

      {/* Validation error */}
      {validationError && (
        <p className="text-sm text-red-300 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          {validationError}
        </p>
      )}

      <PillButton
        type="submit"
        variant="accent"
        disabled={!canSubmit || isPending}
        withArrow={!isPending}
        className="self-start"
      >
        {isPending ? (status === 'pending' ? 'Waiting for wallet…' : 'Confirming…') : 'Create Pool'}
      </PillButton>
    </form>
  );
}
