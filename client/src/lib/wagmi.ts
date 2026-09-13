import { createConfig } from '@privy-io/wagmi';
import { sepolia } from 'viem/chains';
import { http } from 'viem';

const FALLBACK_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

export const wagmiConfig = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? FALLBACK_RPC),
  },
});
