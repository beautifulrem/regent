'use client';

import '@rainbow-me/rainbowkit/styles.css';

import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from '../lib/wagmi';

// MetaMask-orange accent so RainbowKit's modal matches the app's brand.
const rkTheme = darkTheme({ accentColor: '#f6851b', accentColorForeground: '#1a1207', borderRadius: 'medium', overlayBlur: 'small' });

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme} modalSize="compact" initialChain={baseSepoliaId}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// Base Sepolia chain id — the demo's home network; surface it as the initial chain.
const baseSepoliaId = 84532;
