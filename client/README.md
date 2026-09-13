# PotLuck Frontend

**PotLuck** is an on-chain rotating savings and credit association (ROSCA) dapp built on Ethereum Sepolia. Pool members contribute USDC to cycles, earn on-chain reputation, and claim ENS names that resolve to their reputation data. This is the Next.js frontend for discovering, creating, and managing pools, tracking your reputation, and viewing your ENS profile.

## Prerequisites

- **Node.js** 18+ (check with `node --version`)
- **A wallet** with Sepolia ETH (for gas). Mint free Sepolia ETH from [the PoW faucet](https://sepolia-faucet.pk910.de/) or [Alchemy](https://www.alchemy.com/faucets/ethereum-sepolia).
- **Privy** account (free; see **Setup** below)
- **Sepolia RPC** endpoint (Alchemy free tier works; see **Setup** below)

## Setup

1. **Clone and enter the client directory:**
   ```bash
   cd client
   ```

2. **Copy the example environment file:**
   ```bash
   cp .env.local.example .env.local
   ```

3. **Fill in the two environment variables in `.env.local`:**
   - `NEXT_PUBLIC_PRIVY_APP_ID`: Create a free app at [dashboard.privy.io](https://dashboard.privy.io/), copy the App ID, and paste it here.
   - `NEXT_PUBLIC_SEPOLIA_RPC_URL`: Use a free Sepolia RPC URL from [Alchemy](https://www.alchemy.com/) (get free API key and form the URL as `https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY`) or any public Sepolia RPC.

4. **Install dependencies:**
   ```bash
   npm install
   ```
   (If you see peer dependency warnings, you can try `npm install --legacy-peer-deps`.)

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployed Contracts (Sepolia)

| Contract | Address |
| --- | --- |
| MockUSDC (faucet) | `0x701F864Bbf902C7943E2c40A3D5798F6Bd6028EB` |
| ROSCAFactory | `0xe1dA53345211C225A072fCaa3d16D611F39f5e4F` |
| ReputationRegistry | `0xC040A3819f6ecd30AD8416D7dA5FB7F41A7A577F` |
| NoOpGate | `0x62972564798F7DB372d0471c43Fc206F395cf63a` |
| NoOpNaming | `0xF3CcF1dd9348ebEeDd68f557dc8Fb8090655a02A` |
| UniversalResolverV2 (ENS) | `0x4A1817d13E9cF196f471725176355C1234b63C70` |

## Demo Walkthrough

Follow these steps to see the full PotLuck workflow:

1. **Connect your wallet** — Click "Connect" on the landing page (`/`) and sign in via Privy. (You can use email or a wallet.)
2. **Mint MockUSDC** — Navigate to `/pools`, find the "Mint" button, and mint some test USDC to your account.
3. **Create a pool** — Still on `/pools`, click "Create Pool". Set a pool name, contribution amount, and number of members. Submit the transaction.
4. **Join a pool** — Find your newly created pool in the browse list and click "Join".
5. **Approve and contribute** — Open your pool detail page (`/pools/<pool-address>`). Click "Approve" to grant the pool access to your USDC, then "Contribute" to deposit funds for the first round.
6. **Settle a round** — After contributions close (pool logic), you can settle the round to allocate funds. Click "Settle Round".
7. **View reputation and ENS** — Navigate to `/profile` to see your on-chain reputation score and the ENS panel. Once the `potluck.eth` name is registered on mainnet, your reputation data will resolve via that name; until then, you see a registry-derived view with a note that it will resolve via ENS once registered.

## Deferred Prerequisites

- **Live `potluck.eth` ENS name**: The app is wired to resolve reputation via the canonical ENS name `potluck.eth`, but the name is not yet registered on mainnet. In the interim, the `/profile` page displays reputation directly from the registry with a note: *"Once potluck.eth is registered, reputation will resolve via ENS."*
- **Demo pool seeding** (optional): For a richer demo, the Solidity side can pre-seed the registry and factory with real pools. This is not required to run the frontend.

## Tech Stack

- **Next.js 15** (App Router) with TypeScript
- **wagmi** & **viem** for contract interaction
- **Privy** for wallet connection and user sessions
- **Tailwind CSS** for styling
- **ethers.js** for utilities (complementary to wagmi)

## Building for Production

```bash
npm run build
```

This generates an optimized production build in `.next/`. Verify there are no build errors before deploying.

## Environment Variables Reference

Create `.env.local` with these values (use placeholder format from `.env.local.example`; never commit real credentials):

```bash
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-api-key
```

See **.env.local.example** for the template.
