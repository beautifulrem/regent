'use client';

import { useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import { tallyFromSeed } from '../../lib/voteboard-view';
import { cn } from '../../lib/cn';
import { NumberTicker } from '../NumberTicker';
import type { MissionVM } from '../MissionControl';
import {
  ACTOR_NODE_TYPE,
  AUTHORITY_EDGE_TYPE,
  SCOPE_TOKEN_NODE_TYPE,
  buildGraph,
  reached,
  type GraphCopy,
} from './graphModel';
import { ActorNode } from './nodes/ActorNode';
import { ScopeTokenNode } from './nodes/ScopeTokenNode';
import { AuthorityEdge } from './edges/AuthorityEdge';

const nodeTypes: NodeTypes = {
  [ACTOR_NODE_TYPE]: ActorNode,
  [SCOPE_TOKEN_NODE_TYPE]: ScopeTokenNode,
};
const edgeTypes: EdgeTypes = {
  [AUTHORITY_EDGE_TYPE]: AuthorityEdge,
};

function GraphCanvas({ vm }: { vm: MissionVM }) {
  const { fitView } = useReactFlow();

  const copy: GraphCopy = useMemo(
    () => ({
      actors: {
        you: { name: vm.t.nodes.you.who, role: vm.t.nodes.you.role },
        orch: { name: vm.t.nodes.orch.who, role: vm.t.nodes.orch.role },
        analyst: { name: vm.t.nodes.analyst.who, role: vm.t.nodes.analyst.role },
        voteBoard: { name: 'VoteBoard', role: vm.lang === 'zh' ? '链上计票' : 'on-chain tally' },
      },
      scopeFull: vm.t.scopeChip,
      scopeAttenuated: vm.t.scopeChipAttenuated,
      thinking: vm.t.thinking,
      tallyLabels: { for: vm.t.tally.for, against: vm.t.tally.against, abstain: vm.t.tally.abstain },
    }),
    [vm.t, vm.lang],
  );

  const graph = useMemo(
    () =>
      buildGraph({
        s: vm.s,
        killed: vm.killed,
        youAddr: vm.youAddr,
        orchAddr: vm.orchAddr,
        analystAddr: vm.analystAddr,
        isConnected: vm.isConnected,
        tally: tallyFromSeed(vm.activeProposal.seed),
        redelegated: reached(vm.s, 'redelegated'),
        venice: vm.venice,
        vote: vm.run?.vote,
        copy,
      }),
    [vm.s, vm.killed, vm.youAddr, vm.orchAddr, vm.analystAddr, vm.isConnected, vm.activeProposal.seed, vm.venice, vm.run?.vote, copy],
  );

  // Keep the chain framed. The graph CANVAS is inset to the clear zone between the HUD rails (see
  // MissionControl), so a small uniform pad is all that's needed; re-fit on resize so the locked
  // viewport always frames the whole chain.
  useEffect(() => {
    const fit = () => fitView({ padding: 0.14, duration: 350, maxZoom: 1.15 });
    const id = setTimeout(fit, 60);
    if (typeof window !== 'undefined') window.addEventListener('resize', fit);
    return () => {
      clearTimeout(id);
      if (typeof window !== 'undefined') window.removeEventListener('resize', fit);
    };
  }, [fitView, graph.nodes.length]);

  return (
    <ReactFlow
      nodes={graph.nodes}
      edges={graph.edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.14, maxZoom: 1.15 }}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      edgesFocusable={false}
      panOnDrag={false}
      panOnScroll={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
      minZoom={0.3}
      maxZoom={1.5}
    >
      <Background variant={BackgroundVariant.Dots} gap={26} size={1} className="opacity-[0.16]" />
    </ReactFlow>
  );
}

/**
 * The immersive centerpiece: the React Flow permission graph filling the whole stage. Pan/zoom are
 * locked — it auto-frames You→Orchestrator→Analyst→VoteBoard. An authority-meter HUD floats over the
 * canvas (DOM overlay, not a graph node); the wrapper shakes on revoke (fireSever is fired by page.tsx).
 */
export function GraphStage({ vm }: { vm: MissionVM }) {
  return (
    <ReactFlowProvider>
      <div className={cn('absolute inset-0', vm.killed && 'graph-node-shake')}>
        <GraphCanvas vm={vm} />
        {vm.run && (
          <div className="pointer-events-none absolute bottom-[118px] left-1/2 z-[2] flex -translate-x-1/2 items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-mute/70">{vm.t.authority}</span>
            <div className="h-1.5 w-40 overflow-hidden rounded-chip bg-surface-2/60">
              <div
                className={cn(
                  'h-full rounded-chip transition-all duration-700 ease-fluid',
                  vm.killed ? 'bg-bad' : 'bg-gradient-to-r from-brand-deep to-brand shadow-[0_0_12px_var(--color-brand)]',
                )}
                style={{ width: `${vm.authorityPct}%` }}
              />
            </div>
            <span className={cn('font-mono text-xs font-bold tabular-nums', vm.killed ? 'text-bad' : 'text-brand')}>
              <NumberTicker value={vm.authorityPct} suffix="%" />
            </span>
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
}
