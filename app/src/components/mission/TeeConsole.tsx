'use client';

import { LENSES, type RunStatus } from '@mandate/shared';
import { BadgeCheck, FileSignature, Lock, Sparkles } from 'lucide-react';
import { shortHex } from '../../lib/config';
import { ORDER } from '../../lib/runState';
import type { Dict } from '../../lib/i18n';
import { Badge } from '../ui/Badge';
import { decisionColor, TeeCursor, useTeeStream } from './teeStream';

/**
 * The centerpiece Venice-TEE console — a sealed-enclave "hacker terminal". Four governance lenses
 * report their verdicts into a committee grid, then the coordinator's synthesis pass types its
 * reasoning token-by-token and glitches the final verdict in (decision + TEE-attested + signed-by +
 * rationale). Hidden before analysis and after the chain is severed.
 */
export function TeeConsole({
  venice,
  status,
  stageIdx,
  lenses,
  killed,
  t,
}: {
  venice: RunStatus['venice'];
  status?: string;
  stageIdx?: number; // when set (center console), gate on the chain's staged reveal, not raw status
  lenses?: RunStatus['lenses'];
  killed: boolean;
  t: Dict;
}) {
  // Center console (stageIdx set) follows the chain's staged reveal, so it appears + crystallizes the
  // verdict on the chain's beat; the run-popover console (no stageIdx) tracks the real run status.
  const aIdx = ORDER.indexOf('analyzing');
  const dIdx = ORDER.indexOf('decided');
  const decided = stageIdx !== undefined ? stageIdx >= dIdx : ['decided', 'voting', 'voted'].includes(status ?? '');
  const active = stageIdx !== undefined ? stageIdx >= aIdx : decided || status === 'analyzing';
  const full = (venice?.reasoning && venice.reasoning.trim()) || t.teeFallbackReasoning;
  const model = venice?.model ?? 'venice/llama-3.3-70b';
  // The committee cards fill in first (during analyzing); the synthesis reasoning types once the
  // coordinator has decided.
  const { text, typing } = useTeeStream(full, decided && !killed ? 'type' : 'off');
  const ratPlay = !decided || killed || !venice || typing ? 'off' : 'type';
  const { text: ratText, typing: ratTyping } = useTeeStream(venice?.rationale ?? '', ratPlay);

  if (!active || killed) return null;
  const showVerdict = decided && !!venice && !typing;
  const tone = decisionColor(venice?.decision);

  return (
    <div
      className={`tee-console relative w-full max-w-[580px] shrink-0 overflow-hidden rounded-[14px] border border-info/25 bg-[#070b14]/85 backdrop-blur${showVerdict ? ' tee-flash' : ''}`}
      style={{ boxShadow: '0 0 0 1px rgba(110,168,254,0.18), 0 20px 50px -28px rgba(0,0,0,0.8)' }}
    >
      <span className="tee-sweep" aria-hidden />
      <span className="tee-crt" aria-hidden />

      <div className="relative z-[2]">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-info/15 bg-info/[0.06] px-3.5 py-2.5">
          <Lock className="size-3.5 text-info" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-info">{t.teeConsoleTitle}</span>
          <span className="inline-flex items-center gap-1.5 rounded-chip border border-info/35 bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">
            <Sparkles className="size-3" /> Venice AI · TEE
          </span>
          <span className="ml-auto font-mono text-[11px] text-ink-mute">{model}</span>
        </div>

        <div className="px-3.5 py-2.5">
          {/* committee — the four governance lenses report their verdicts */}
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-info/70">
            <Sparkles className="size-3" /> {t.teeCommittee}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {LENSES.map((lens) => {
              const v = lenses?.find((l) => l.lens === lens.key);
              const vt = v ? decisionColor(v.decision) : undefined;
              return (
                <div key={lens.key} className="tee-lens rounded-md border border-info/15 bg-info/[0.04] px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-semibold text-[#a9c6f5]">{t.presets[lens.key]}</span>
                    {v ? (
                      <span
                        className="shrink-0 rounded-chip px-1.5 py-0.5 text-[9.5px] font-bold"
                        style={{ border: `1px solid ${vt}66`, background: `${vt}1f`, color: vt }}
                      >
                        {v.decision}
                      </span>
                    ) : (
                      <span className="shrink-0 font-mono text-[11px] text-info/50">···</span>
                    )}
                  </div>
                  {v?.rationale && <div className="mt-1 truncate text-[10.5px] leading-snug text-ink-mute">{v.rationale}</div>}
                </div>
              );
            })}
          </div>

          {/* synthesis — the coordinator weighs the four and decides */}
          <div className="tee-boot mb-1.5 mt-2.5 font-mono text-[11px] text-info/75">
            [venice-tdx] {decided ? `synthesis · ${model}` : t.teeSynthesizing}
          </div>
          <div className="tee-synth hud-scroll min-h-[34px] max-h-[92px] overflow-y-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.5] text-[#8fb6ef]">
            {decided ? (
              <>
                {text}
                {typing && <TeeCursor />}
              </>
            ) : (
              <span className="text-info/40">…</span>
            )}
          </div>

          {showVerdict && venice && (
            <div className="tee-verdict">
              <code className="tee-v-json mt-3 block break-all rounded-md border border-hairline bg-surface-2 px-2.5 py-[7px] font-mono text-[11.5px] text-ink-mute">
                {`{"decision":"${venice.decision}","rationale":"…"}`}
              </code>
              <div className="tee-v-row mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">{t.aiDecided}</span>
                <span
                  className="tee-verdict-badge inline-flex items-center rounded-chip px-3 py-1 text-[13px] font-bold"
                  style={{ border: `1px solid ${tone}66`, background: `${tone}1f`, color: tone }}
                >
                  {venice.decision}
                </span>
                {venice.attestation?.verified && (
                  <Badge tone="ok">
                    <BadgeCheck className="size-3" /> {t.teeAttested}
                  </Badge>
                )}
                {venice.signature?.recovered && venice.signature.signingAddress && (
                  <Badge tone="info">
                    <FileSignature className="size-3" /> {shortHex(venice.signature.signingAddress, 4)}
                  </Badge>
                )}
              </div>
              {venice.rationale && (
                <div className="tee-v-rat mt-2.5 text-[13px] italic text-ink-soft">
                  “{ratText}
                  {ratTyping && <TeeCursor />}”
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
