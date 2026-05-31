'use client';

import { delegationHash, delegationManagerAddress, type Delegation } from '@mandate/shared';
import { motion, useReducedMotion } from 'motion/react';
import { BASESCAN, shortHex } from '../lib/config';
import { decodeVoteCaveats } from '../lib/caveats';
import { formatMessage, getDict, resolveLang } from '../lib/i18n';

interface PermissionInspectorProps {
  rootDel: Delegation;
  chainId: number;
}

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const rowVariants = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0 },
};

function currentDict() {
  if (typeof document === 'undefined') return getDict('en');
  return getDict(resolveLang(document.documentElement.lang));
}

export function PermissionInspector({ rootDel, chainId }: PermissionInspectorProps) {
  const t = currentDict();
  const reduceMotion = useReducedMotion();
  const rows = decodeVoteCaveats(rootDel, chainId);
  const rootHash = delegationHash(rootDel, chainId, delegationManagerAddress(chainId));
  const listMotion = reduceMotion
    ? { initial: false }
    : { initial: 'hidden' as const, animate: 'show' as const, variants: listVariants };
  const rowMotion = reduceMotion ? { initial: false } : { variants: rowVariants };

  return (
    <div className="card permission-inspector">
      <div className="card-title">{t.permissionInspectorTitle}</div>
      <motion.div className="permission-rows mt-md" {...listMotion}>
        {rows.map((row) => (
          <motion.div
            className={`permission-row ${row.locked ? 'locked' : 'unlocked'}`}
            key={`${row.enforcerName}-${row.claim}`}
            {...rowMotion}
          >
            <span className={`lock-glyph ${row.locked ? 'locked' : 'unlocked'}`} aria-label={row.locked ? 'locked' : 'unlocked'}>
              {row.locked ? '🔒' : '🔓'}
            </span>
            <div className="permission-main">
              <div className="row gap-sm">
                <span className="label">{row.claim}</span>
                {row.enforcerAddr ? (
                  <a className="permission-enforcer mono" href={`${BASESCAN}/address/${row.enforcerAddr}`} target="_blank" rel="noreferrer">
                    {row.enforcerName} ↗
                  </a>
                ) : (
                  <span className="permission-enforcer mono">{row.enforcerName}</span>
                )}
              </div>
              <div className="mono permission-value">{row.value}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>
      <div className="permission-footer mt-md">
        <div className="label mono">
          {formatMessage(t.permissionInspectorProvenance, {
            signature: shortHex(rootDel.signature, 6),
            hash: shortHex(rootHash, 6),
          })}
        </div>
        <div className="label">{t.permissionInspectorPosted}</div>
      </div>
    </div>
  );
}
