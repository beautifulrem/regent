import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

// Web3 type system: Inter (body), Space Grotesk (display/headings), JetBrains Mono
// (addresses, hashes, numbers — tabular figures). Self-hosted via next/font (no CLS,
// no external request). Non-latin (中文) falls back to the system CJK stack per-glyph.
const sans = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-space', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: 'Mandate — Revocable AI Governance Delegation',
  description:
    'Grant an AI agent scoped, revocable authority to vote on your behalf — and kill the whole delegation chain on-chain in seconds.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The redesign is dark-only — lock data-theme=dark. suppressHydrationWarning
    // because browser extensions (Dark Reader, …) inject attributes (benign).
    <html lang="en" data-theme="dark" className={`${sans.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="aurora" aria-hidden="true">
          <span className="aurora-orb" />
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
