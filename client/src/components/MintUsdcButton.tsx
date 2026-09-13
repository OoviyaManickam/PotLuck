'use client';

import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useTx, decodeRevert } from '@/hooks/useTx';
import { useUsdcBalance } from '@/hooks/useUsdcBalance';
import { useToast } from '@/components/TxToast';
import { ADDRESSES } from '@/lib/contracts';
import { mockUsdcAbi } from '@/lib/abis/mockUsdc';
import { parseUsdc } from '@/lib/format';
import { PillButton } from './PillButton';

export function MintUsdcButton() {
  const { address, isConnected } = useAccount();
  const { send, status, hash, error, reset } = useTx();
  const { refetch } = useUsdcBalance(address);
  const { addToast, updateToast } = useToast();

  // Stable ref so effects can share the current toast id
  const toastIdRef = useRef<string>('');

  useEffect(() => {
    if (status === 'pending') {
      toastIdRef.current = addToast({ variant: 'pending', message: 'Minting 100 mUSDC…' });
    }
  }, [status, addToast]);

  useEffect(() => {
    if (status === 'confirming' && toastIdRef.current) {
      updateToast(toastIdRef.current, {
        variant: 'confirming',
        message: 'Transaction submitted — confirming on-chain…',
      });
    }
  }, [status, updateToast]);

  useEffect(() => {
    if (status === 'success') {
      refetch();
      if (toastIdRef.current) {
        updateToast(toastIdRef.current, {
          variant: 'success',
          message: '100 mUSDC minted!',
          hash,
        });
        toastIdRef.current = '';
      } else {
        addToast({ variant: 'success', message: '100 mUSDC minted!', hash });
      }
      reset();
    }
  }, [status, hash, refetch, updateToast, addToast, reset]);

  useEffect(() => {
    if (status === 'error' && error) {
      const msg = decodeRevert(error);
      if (toastIdRef.current) {
        updateToast(toastIdRef.current, { variant: 'error', message: `Mint failed: ${msg}` });
        toastIdRef.current = '';
      } else {
        addToast({ variant: 'error', message: `Mint failed: ${msg}` });
      }
      reset();
    }
  }, [status, error, updateToast, addToast, reset]);

  const handleMint = () => {
    if (!address) return;
    send({
      address: ADDRESSES.mockUsdc,
      abi: mockUsdcAbi,
      functionName: 'mint',
      args: [address, parseUsdc('100')],
    });
  };

  const isLoading = status === 'pending' || status === 'confirming';

  return (
    <PillButton
      variant="dark"
      onClick={handleMint}
      disabled={!isConnected || isLoading}
      className="border border-surface-2"
    >
      {isLoading ? 'Minting…' : 'Mint 100 mUSDC'}
    </PillButton>
  );
}
