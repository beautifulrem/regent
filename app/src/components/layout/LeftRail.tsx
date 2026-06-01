'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { VOTE_BOARD_ADDRESS } from '@mandate/shared';
import { CHAIN_ID } from '../../lib/config';
import { PermissionInspector } from '../PermissionInspector';
import { TamperProbe } from '../TamperProbe';
import { SmartAccountCard } from '../panels/SmartAccountCard';
import type { MissionVM } from '../MissionControl';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * The grant-side HUD column (frameless), floating over the left margin of the living graph.
 * Reveals contextually: the Smart-Account identity the moment a wallet connects, then the
 * Permission X-Ray + Tamper Probe once a standing grant exists — both retire on revoke (the
 * grant-scoped proofs no longer apply once the chain is dead).
 */
export function LeftRail({ vm }: { vm: MissionVM }) {
  const showIdentity = vm.isConnected && !!vm.userSA;
  const showScope = !!vm.rootDel && !!vm.cfg && !!vm.userSA && !vm.killed && vm.grantedProposalId != null;

  return (
    <div className="hud-scroll flex h-full flex-col gap-6 overflow-y-auto overflow-x-hidden p-4 pt-14">
      {!showIdentity && !showScope ? (
        <div className="flex flex-col gap-3">
          <p className="font-display text-[15px] font-semibold leading-snug text-ink/90">
            {vm.t.heroLine1} {vm.t.heroLine2}
          </p>
          <p className="text-[12px] leading-relaxed text-ink-soft/85">{vm.t.heroSub}</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-mute/60">{vm.t.connect}</p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {showIdentity && (
            <Reveal key="sa">
              <SmartAccountCard userSA={vm.userSA!} eoaAddress={vm.address} t={vm.t} />
            </Reveal>
          )}
          {showScope && (
            <Reveal key="xray">
              <PermissionInspector rootDel={vm.rootDel!} chainId={CHAIN_ID} bare />
            </Reveal>
          )}
          {showScope && (
            <Reveal key="tamper">
              <TamperProbe
                rootDel={vm.rootDel!}
                governor={VOTE_BOARD_ADDRESS}
                proposalId={vm.grantedProposalId!}
                chainId={CHAIN_ID}
                bare
              />
            </Reveal>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function Reveal({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      layout
      initial={reduce ? false : { opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -18 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
