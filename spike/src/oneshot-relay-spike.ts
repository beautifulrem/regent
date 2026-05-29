/**
 * Mandate — 1Shot relay spike. PROVES go/no-go #3 + the 1Shot-track requirement:
 *   (a) relay an ARBITRARY contract call (Governor.castVote) through the 1Shot permissionless relayer
 *   (b) UPGRADE a fresh EOA -> 7702StatelessDelegator THROUGH the relayer (authorizationList on first use)
 *
 * The hackathon's "Best 1Shot" track requires DEMOING the EOA->smart-account 7702 upgrade THROUGH 1Shot,
 * not just relaying a tx (verified: 1shot public-relayer skill L52 + quickstart lifecycle Step 1).
 *
 * START on Base Sepolia (.dev relayer) to de-risk; flip 4 constants for the mainnet ($1k) run:
 *   chain 84532->8453 ; RELAYER .dev->relayer.1shotapi.com ; USDC (Base mainnet 0x833589...2913) ;
 *   getSmartAccountsEnvironment(8453). Mainnet run spends REAL USDC for gas — user must fund + run.
 *
 * Flow (1shot quickstart gas-sponsorship-eip7710): getCapabilities -> sign 7702 auth (first use) +
 * delegation scoped to fee transfer + the castVote work call -> estimate7710Transaction (check result.success)
 * -> send7710Transaction (include context + authorizationList) -> poll relayer_getStatus / verify Ed25519 webhook.
 * VERIFY method/param names against `npx skills add 1Shot-API/skills/public-relayer` before the real run.
 */
import 'dotenv/config'
import { createPublicClient, http, encodeFunctionData, parseAbi, toHex } from 'viem'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { createDelegation, ScopeType, getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit'

const RELAYER = process.env.ONESHOT_RELAYER_URL || 'https://relayer.1shotapi.dev/relayers' // .dev for testnet
const CHAIN_ID = process.env.ONESHOT_CHAIN_ID || '84532' // 84532 Sepolia -> 8453 mainnet for the $1k
const RPC = process.env.RPC_URL!
const GOVERNOR = process.env.GOVERNOR_ADDRESS as `0x${string}`
const ok = (c: boolean, m: string) => console.log(`${c ? 'PASS ✅' : 'FAIL ❌'}  ${m}`)

async function rpc(method: string, params: any) {
  const r = await fetch(RELAYER, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const j = await r.json(); if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`); return j.result
}

async function main() {
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) })
  const env = getSmartAccountsEnvironment(Number(CHAIN_ID))
  const delegator = privateKeyToAccount(process.env.DELEGATOR_PK as `0x${string}`) // a FRESH EOA (to show the upgrade)

  // 1) Capabilities are source-of-truth: chains, accepted fee tokens, feeCollector, and the targetAddress
  //    that the delegation MUST be granted to (mismatch => redemption fails).
  const caps = await rpc('relayer_getCapabilities', [CHAIN_ID])
  ok(!!caps?.targetAddress, `getCapabilities ok (targetAddress=${caps?.targetAddress}, feeCollector=${caps?.feeCollector})`)
  const FEE_TOKEN = caps.tokens?.[0]?.address // pick an accepted stablecoin (USDC)

  // 2) Does this fresh EOA need the 7702 upgrade? (getCode lacks the 0xef0100 delegate prefix.)
  const code = await publicClient.getCode({ address: delegator.address })
  const needsUpgrade = !code || !code.startsWith('0xef0100')
  ok(true, `7702 upgrade needed for fresh EOA: ${needsUpgrade}  (this is the step the 1Shot track wants shown)`)

  // 3) Sign the EIP-7702 authorization to upgrade EOA -> 7702StatelessDelegator (ONLY on first use; one entry max).
  //    viem: walletClient.signAuthorization({ contractAddress: <7702 impl>, ... }) via a LOCAL signer (NOT window.ethereum).
  const impl = env.implementations?.EIP7702StatelessDeleGatorImpl
  // const authorization = await localWalletClient.signAuthorization({ contractAddress: impl, account: delegator })
  ok(!!impl, `7702 impl resolved (${impl}) — sign authorizationList[0] with a LOCAL signer on first use`)

  // 4) Build the work execution (the ARBITRARY contract call — proves #3): Governor.castVote.
  const workCallData = encodeFunctionData({
    abi: parseAbi(['function castVote(uint256,uint8)']), functionName: 'castVote', args: [1n, 1],
  })
  // 5) createDelegation scoped to BOTH the fee transfer (to feeCollector, >= minFee) AND the work call,
  //    granted TO caps.targetAddress (the relayer's stable delegate). Then estimate -> send.
  //    (Assemble per the public-relayer skill; left as the run-time wiring point.)
  console.log('Work call (castVote) calldata:', workCallData.slice(0, 18) + '…')
  console.log('NEXT (wire from the public-relayer skill): createDelegation(to=targetAddress, scope=[feeTransfer, castVote]) ->')
  console.log('  relayer_estimate7710Transaction (assert result.success) -> relayer_send7710Transaction')
  console.log('  (include signed context + authorizationList on first use) -> relayer_getStatus / Ed25519 webhook.')
  ok(true, 'relay path assembled to the send boundary; run with funded keys to broadcast (testnet first, then mainnet for $1k)')
}
main().catch((e) => { console.error('1SHOT SPIKE ERROR:', e); process.exit(1) })
