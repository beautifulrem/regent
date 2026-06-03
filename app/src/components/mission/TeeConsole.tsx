'use client';

import type { RunStatus } from '@mandate/shared';
import { BadgeCheck, FileSignature, Lock, Sparkles } from 'lucide-react';
import { shortHex } from '../../lib/config';
import type { Dict } from '../../lib/i18n';
import { Badge } from '../ui/Badge';
import { MatrixRain } from './MatrixRain';
import { decisionColor, TeeCursor, useTeeStream } from './teeStream';

/**
 * The centerpiece Venice-TEE reasoning console — a sealed-enclave "hacker terminal". It opens with a
 * decrypt/rise reveal + scanline sweep over a confined code-rain, types the reasoning token-by-token,
 * then glitches the verdict in (decision + TEE-attested + signed-by + rationale). Hidden before
 * analysis and after the chain is severed.
 */
export function TeeConsole({
  venice,
  status,
  killed,
  t,
}: {
  venice: RunStatus['venice'];
  status?: string;
  killed: boolean;
  t: Dict;
}) {
  const analyzing = status === 'analyzing';
  const decided = ['decided', 'voting', 'voted'].includes(status ?? '');
  const active = analyzing || decided;
  const full = (venice?.reasoning && venice.reasoning.trim()) || t.teeFallbackReasoning;
  const model = venice?.model ?? 'venice/llama-3.3-70b';
  // Always type token-by-token while active; the verdict crystallizes once the stream completes.
  const { text, typing } = useTeeStream(full, !active || killed ? 'off' : 'type');

  if (!active || killed) return null;
  const showVerdict = decided && !!venice && !typing;
  const tone = decisionColor(venice?.decision);

  return (
    <div className="tee-console relative w-full max-w-[620px] shrink-0 overflow-hidden rounded-[14px] border border-info/25 bg-[#070b14]/85 backdrop-blur">
      <MatrixRain className="tee-rain" />
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

        <div className="px-4 py-3.5">
          <div className="tee-boot mb-2.5 font-mono text-[11px] text-info/75">[venice-tdx] sealed channel established · {model}</div>
          <div className="min-h-[54px] whitespace-pre-wrap break-words font-mono text-[12.5px] leading-[1.65] text-[#8fb6ef]">
            {text}
            {typing && <TeeCursor />}
          </div>

          {showVerdict && venice && (
            <div className="tee-verdict">
              <code className="mt-3 block break-all rounded-md border border-hairline bg-surface-2 px-2.5 py-[7px] font-mono text-[11.5px] text-ink-mute">
                {`{"decision":"${venice.decision}","rationale":"…"}`}
              </code>
              <div className="mt-3 flex flex-wrap items-center gap-2">
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
              {venice.rationale && <div className="mt-2.5 text-[13px] italic text-ink-soft">“{venice.rationale}”</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
