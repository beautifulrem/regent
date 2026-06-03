import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import localFont from 'next/font/local';
import { Providers } from './providers';
import './globals.css';

// Web3 type system: Inter (body), Space Grotesk (display/headings), JetBrains Mono
// (addresses, hashes, numbers — tabular figures). Self-hosted via next/font (no CLS,
// no external request). Non-latin (中文) falls back to the system CJK stack per-glyph.
const sans = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-space', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-jetbrains', display: 'swap' });

// Brand display + mono faces (Mission-Control "techy" character): F1.8 drives headings, KPIs and
// node names; LG1052 sets every address / hash / number; LG1056 is a heavy display-accent alt.
// Self-hosted .otf — only a Regular master exists, so 400–700 maps to it (bold is synthesized).
// Space Grotesk / JetBrains Mono stay wired in @theme as the fallback, and CJK falls back per-glyph.
const brandDisplay = localFont({ src: './fonts/F1.8.otf', variable: '--font-f18', weight: '400 700', display: 'swap' });
const brandMono = localFont({ src: './fonts/lg1052.otf', variable: '--font-lg1052', weight: '400 700', display: 'swap' });
const brandDisplayAlt = localFont({ src: './fonts/lg1056.otf', variable: '--font-lg1056', weight: '400 700', display: 'swap' });

export const metadata: Metadata = {
  title: 'Mandate — Revocable AI Governance Delegation',
  description:
    'Grant an AI agent scoped, revocable authority to vote on your behalf — and kill the whole delegation chain on-chain in seconds.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The redesign is dark-only — lock data-theme=dark. suppressHydrationWarning
    // because browser extensions (Dark Reader, …) inject attributes (benign).
    <html
      lang="en"
      data-theme="dark"
      className={`${sans.variable} ${display.variable} ${mono.variable} ${brandDisplay.variable} ${brandMono.variable} ${brandDisplayAlt.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <div className="aurora" aria-hidden="true">
          <span className="aurora-orb" />
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
