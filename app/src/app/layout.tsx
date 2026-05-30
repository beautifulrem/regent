import type { Metadata } from 'next';
import { THEME_KEY } from '../lib/theme';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mandate — Revocable AI Governance Delegation',
  description:
    'Grant an AI agent scoped, revocable authority to vote on your behalf — and kill the whole delegation chain on-chain in seconds.',
};

// Runs before first paint so the page never flashes the wrong theme. Mirrors
// resolveTheme() from lib/theme: explicit pref wins, otherwise follow the OS.
const THEME_INIT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script sets data-theme, and browser
    // extensions (Dark Reader, …) inject attributes — both are benign mismatches.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
