'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useCallback } from 'react';
import type { Abi } from 'viem';

export type TxStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

interface SendArgs {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: unknown[];
  value?: bigint;
}

interface UseTxReturn {
  send: (args: SendArgs) => void;
  status: TxStatus;
  hash: `0x${string}` | undefined;
  error: Error | null;
  reset: () => void;
}

/** Maps known custom-error names to friendly sentences. */
const REVERT_MESSAGES: Record<string, string> = {
  WrongStatus: 'This action is not allowed in the pool\'s current status.',
  AlreadyJoined: 'You have already joined this pool.',
  BelowMinScore: 'Your trust score is too low to join this pool.',
  HasDefaulted: 'You have a past default and cannot join this pool.',
  ExceedsTier: 'This pool\'s tier exceeds your current member tier.',
  NotAMember: 'You are not a member of this pool.',
  AlreadyPaidThisRound: 'You have already made your payment for this round.',
  WindowClosed: 'The payment window for this round is closed.',
  NotYetTimeToAdvance: 'It is not yet time to advance to the next round.',
  BelowMinMembers: 'Not enough members to start the pool.',
  ExceedsCreatorTier: 'This pool configuration exceeds your creator tier.',
};

export function decodeRevert(error: unknown): string {
  if (!error) return 'An unknown error occurred.';
  const msg = (error as { shortMessage?: string; message?: string }).shortMessage
    ?? (error as { message?: string }).message
    ?? String(error);

  for (const [name, friendly] of Object.entries(REVERT_MESSAGES)) {
    if (msg.includes(name)) return friendly;
  }

  return msg;
}

export function useTx(): UseTxReturn {
  const {
    writeContract,
    data: hash,
    isPending: isWritePending,
    isError: isWriteError,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const send = useCallback(
    (args: SendArgs) => {
      writeContract({
        address: args.address,
        abi: args.abi,
        functionName: args.functionName,
        args: args.args as never,
        value: args.value,
      });
    },
    [writeContract]
  );

  let status: TxStatus = 'idle';
  if (isWritePending) status = 'pending';
  else if (isConfirming) status = 'confirming';
  else if (isSuccess) status = 'success';
  else if (isWriteError || isReceiptError) status = 'error';

  const error = writeError ?? receiptError ?? null;

  return { send, status, hash, error, reset: resetWrite };
}
