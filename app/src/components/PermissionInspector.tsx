'use client';

import { delegationHash, delegationManagerAddress, type Delegation } from '@mandate/shared';
import { motion, useReducedMotion } from 'motion/react';
import { Lock, ScanSearch, ShieldCheck, Unlock } from 'lucide-react';
import { BASESCAN, shortHex } from '../lib/config';
import { decodeVoteCaveats } from '../lib/caveats';
import { cn } from '../lib/cn';
import { formatMessage, getDict, resolveLang } from '../lib/i18n';
import { Panel, PanelHeader } from './ui/Panel';
import { TrackTag } from './ui/Badge';

interface PermissionInspectorProps {
  rootDel: Delegation;
  chainId: number;
}

const listVariants = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const rowVariants = { hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } };

function currentDict() {
  if (typeof document === 'undefined') return getDict('en');
  return getDict(resolveLang(document.documentElement.lang));
}

/**
 * Permission X-Ray — decodes the signed root delegation bytes into the exact
 * ERC-7710 caveats (locked) plus the one free dimension (vote support), so a
 * judge SEES the scope without reading code.
 */
export function PermissionInspector({ rootDel, chainId }: PermissionInspectorProps) {
  const t = currentDict();
  const reduceMotion = useReducedMotion();
  const rows = decodeVoteCaveats(rootDel, chainId);
  const rootHash = delegationHash(rootDel, chainId, delegationManagerAddress(chainId));
  const listMotion = reduceMotion
    ? { initial: false as const }
    : { initial: 'hidden' as const, animate: 'show' as const, variants: listVariants };
  const rowMotion = reduceMotion ? { initial: false as const } : { variants: rowVariants };

  return (
    <Panel pad="lg" className="mb-3.5">
      <PanelHeader
        icon={ScanSearch}
        title={t.permissionInspectorTitle}
        track={<TrackTag tone="brand" icon={ShieldCheck}>ERC-7710 scope</TrackTag>}
      />
      <motion.div className="grid gap-2.5" {...listMotion}>
        {rows.map((row) => (
          <motion.div
            key={`${row.enforcerName}-${row.claim}`}
            {...rowMotion}
            className={cn(
              'flex items-start gap-3 rounded-xl border bg-surface-2/60 px-3.5 py-3',
              row.locked ? 'border-brand/25' : 'border-info/30',
            )}
          >
            <span
              className={cn(
                'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-hairline bg-surface',
                row.locked ? 'text-brand' : 'text-info',
              )}
              aria-label={row.locked ? 'locked' : 'unlocked'}
            >
              {row.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-ink">{row.claim}</span>
                {row.enforcerAddr ? (
                  <a
                    className="font-mono text-xs text-info hover:underline"
                    href={`${BASESCAN}/address/${row.enforcerAddr}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {row.enforcerName} ↗
                  </a>
                ) : (
                  <span className="font-mono text-xs text-info">{row.enforcerName}</span>
                )}
              </div>
              <div className="mt-1 break-all font-mono text-xs text-ink-soft">{row.value}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>
      <div className="mt-4 space-y-1 border-t border-hairline pt-3">
        <div className="font-mono text-[11px] text-ink-mute">
          {formatMessage(t.permissionInspectorProvenance, {
            signature: shortHex(rootDel.signature, 6),
            hash: shortHex(rootHash, 6),
          })}
        </div>
        <div className="text-[11px] text-ink-mute">{t.permissionInspectorPosted}</div>
      </div>
    </Panel>
  );
}
