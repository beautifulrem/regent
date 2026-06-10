/**
 * Record the mainnet-replay verdict audio: a REAL Venice /audio/speech (tts-kokoro) rendering of
 * the recorded TEE verdict, written to app/public/replay/verdict-tts.mp3 so the deployed app and
 * the demo video can play it without an orchestrator. The default text mirrors
 * app/src/lib/mainnet-snapshot.ts (decision + rationale of the recorded Base-mainnet run).
 *
 *   pnpm tts:record                      # speak the recorded mainnet verdict
 *   pnpm tts:record -- --text "..."      # speak custom text
 *   pnpm tts:record -- --out path.mp3    # custom output path
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { synthesizeSpeech } from '../src/venice.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadDotenv({ path: path.join(REPO_ROOT, '.env') });

// Mirrors MAINNET_SNAPSHOT.venice (decision + rationale) — keep in sync when re-recording a run.
const DEFAULT_TEXT =
  'The committee verdict is: For. Fiscal oversight and security accountability drive approval; ' +
  'budget modest, milestone-gated, multisig with clawback ensures low risk.';

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey) throw new Error('VENICE_API_KEY missing in .env');
  const text = argValue('--text') ?? DEFAULT_TEXT;
  const out = argValue('--out') ?? path.join(REPO_ROOT, 'app/public/replay/verdict-tts.mp3');

  console.log(`venice /audio/speech (tts-kokoro) ← "${text.slice(0, 80)}…"`);
  const bytes = await synthesizeSpeech(
    { apiUrl: process.env.VENICE_API_URL || 'https://api.venice.ai/api/v1', apiKey },
    { text },
  );
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(bytes));
  console.log(`✅ wrote ${out} (${(bytes.byteLength / 1024).toFixed(1)} KiB)`);
}

main().catch((e) => {
  console.error('tts-record FAILED:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
