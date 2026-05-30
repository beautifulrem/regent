'use client';

import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { injectedWallet, metaMaskWallet } from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { RPC_URL } from './config';

// Injected-only wallet setup (no WalletConnect Cloud projectId needed).
// `multiInjectedProviderDiscovery` (wagmi default) + RainbowKit surface every
// EIP-6963 wallet (MetaMask, Phantom, …) by its rdns, so the connect modal lists
// the real MetaMask explicitly instead of whatever won the legacy window.ethereum
// race — the root cause of the earlier Phantom hijack. The projectId below is a
// placeholder; WalletConnect (QR/mobile) is intentionally not wired for this demo.
const connectors = connectorsForWallets(
  [{ groupName: 'Installed', wallets: [metaMaskWallet, injectedWallet] }],
  { appName: 'Mandate', projectId: 'mandate-injected-demo' },
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [baseSepolia, base],
  transports: {
    [baseSepolia.id]: http(RPC_URL),
    [base.id]: http(),
  },
  multiInjectedProviderDiscovery: true,
  ssr: true,
});
