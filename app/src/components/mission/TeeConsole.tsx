'use client';

import { useState } from 'react';
import { LENSES, type LensKey, type RunStatus } from '@mandate/shared';
import { BadgeCheck, Lock, Receipt, Sparkles, X } from 'lucide-react';
import { BASESCAN, shortHex } from '../../lib/config';
import { ORDER } from '../../lib/runState';
import type { Dict } from '../../lib/i18n';
import { Badge } from '../ui/Badge';
import { decisionColor, TeeCursor, useTeeStream } from './teeStream';

/**
 * The centerpiece Venice-TEE console — a sealed-enclave "hacker terminal". Four governance lenses
 * (clickable cards) report verdicts; click reveals full per-lens detail (model + reasoning + teeVerified + rationale)
 * in a sealed sub-frame. The final arbiter (终裁) synthesizes, types reasoning, then shows TEE-attested badge
 * (click for Intel TDX / nonce bubble) + clickable signing-address to explorer. Hidden before analysis / after kill.
 */
export function TeeConsole({
  venice,
  status,
  stageIdx,
  lenses,
  txHash,
  killed,
  t,
}: {
  venice: RunStatus['venice'];
  status?: string;
  stageIdx?: number; // when set (center console), gate on the chain's staged reveal, not raw status
  lenses?: RunStatus['lenses'];
  /** the castVote tx hash (present once 'voted') — the real on-chain artifact the verdict row links to. */
  txHash?: string;
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

  // Local selection for per-lens full detail (click a committee card) + attestation explain bubble
  const [selectedLens, setSelectedLens] = useState<LensKey | null>(null);
  const [attestOpen, setAttestOpen] = useState(false);

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
          {/* committee — the four governance lenses report their verdicts. Click a card to reveal full model+reasoning+TEE-verified in sealed frame below. */}
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-info/70">
            <Sparkles className="size-3" /> {t.teeCommittee}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {LENSES.map((lens) => {
              const v = lenses?.find((l) => l.lens === lens.key);
              const vt = v ? decisionColor(v.decision) : undefined;
              const isSel = selectedLens === lens.key;
              const clickable = !!v; // only a lens that has reported its verdict has detail to open
              const toggle = () => setSelectedLens(isSel ? null : lens.key);
              return (
                <div
                  key={lens.key}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? toggle : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggle();
                          }
                        }
                      : undefined
                  }
                  className={`tee-lens rounded-md border border-info/15 bg-info/[0.04] px-2.5 py-1.5 transition-all ${clickable ? 'cursor-pointer' : ''} ${isSel ? 'ring-1 ring-info/60 ring-offset-1 ring-offset-[#070b14]' : clickable ? 'hover:border-info/30' : ''}`}
                  aria-pressed={clickable ? isSel : undefined}
                  aria-label={clickable ? `${t.presets[lens.key]} — ${t.teeLensMore}` : undefined}
                >
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

          {/* selected lens full detail — styled as sealed-enclave sub-frame (model + full reasoning + teeVerified + rationale) */}
          {selectedLens && (() => {
            const v = lenses?.find((l) => l.lens === selectedLens);
            if (!v) return null;
            const vt = decisionColor(v.decision);
            return (
              <div className="mt-2 rounded-md border border-info/20 bg-info/[0.025] p-2.5 text-[11px]">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-mono text-info/80">
                    <Lock size={11} /> {t.presets[selectedLens]} · {v.model} · TEE:{v.teeVerified ? '✓' : '—'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLens(null)}
                    className="bg-none p-0 font-normal text-ink-mute shadow-none hover:text-ink"
                    aria-label="Close lens detail"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-ink-mute">decision:</span>
                  <span className="rounded-chip px-1.5 py-px text-[10px] font-bold" style={{ border: `1px solid ${vt}66`, background: `${vt}1f`, color: vt }}>{v.decision}</span>
                </div>
                {v.reasoning && (
                  <div className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap break-words font-mono text-[#8fb6ef] hud-scroll">{v.reasoning}</div>
                )}
                {v.rationale && (
                  <div className="mt-1.5 text-[12px] italic text-ink-soft">“{v.rationale}”</div>
                )}
              </div>
            );
          })()}

          {/* final arbiter / 终裁 — the coordinator weighs the four lenses and decides (this decision is cast on-chain) */}
          <div className="tee-boot mb-1.5 mt-2.5 font-mono text-[11px] text-info/75">
            [venice-tdx] {decided ? `arbiter · ${model}` : t.teeSynthesizing}
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
                  <button
                    type="button"
                    onClick={() => setAttestOpen((s) => !s)}
                    className="cursor-pointer rounded-chip bg-none p-0 font-normal shadow-none"
                    aria-expanded={attestOpen}
                    aria-controls="tee-attest-bubble"
                    title={t.teeAttestExplain}
                  >
                    <Badge tone="ok">
                      <BadgeCheck className="size-3" /> {t.teeAttested}
                    </Badge>
                  </button>
                )}
                {txHash && (
                  <a
                    href={`${BASESCAN}/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`${t.castVoteTx} ${txHash}`}
                    className="no-underline hover:opacity-80"
                  >
                    <Badge tone="info">
                      <Receipt className="size-3" /> {t.castVoteTx} {shortHex(txHash, 4)} ↗
                    </Badge>
                  </a>
                )}
              </div>

              {/* Attestation "bubble" (stacked compact card for dense cockpit; explains TDX + verified + nonce) */}
              {attestOpen && venice?.attestation && (
                <div
                  id="tee-attest-bubble"
                  className="mt-2 rounded border border-info/30 bg-[rgba(16,22,32,0.65)] p-2 text-[10px] leading-snug text-info/90"
                >
                  <div className="flex justify-between gap-2">
                    <div>{t.teeAttestExplain}</div>
                    <button type="button" onClick={() => setAttestOpen(false)} className="shrink-0 bg-none p-0 font-normal text-ink-mute shadow-none hover:text-ink">
                      <X size={12} />
                    </button>
                  </div>
                  {venice.attestation.nonce && (
                    <div className="mt-1 font-mono text-ink-mute">nonce: {venice.attestation.nonce}</div>
                  )}
                  {venice.signature?.signingAddress && (
                    <div className="mt-1 break-all font-mono text-ink-mute">signer: {venice.signature.signingAddress}</div>
                  )}
                </div>
              )}
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
