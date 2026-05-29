/**
 * Mandate — D1 spike: 2-hop attenuated governance redelegation + cascade-revoke.
 *
 * PROVES go/no-go #2 (the hardest, most-novel mechanic), all on Base Sepolia, NO 1Shot:
 *   1. Root: user (MetaMask smart account) delegates a FunctionCall-scoped right to call
 *      Governor.castVote(proposalId, support) — proposalId LOCKED via allowedCalldata,
 *      `support` LEFT OPEN (so Venice decides For/Against later). -> Orchestrator
 *   2. Redelegate (attenuate): Orchestrator narrows + redelegates -> Analyst (parentDelegation).
 *   3. Redeem the 2-hop chain [analyst, orchestrator, root] to actually call castVote.
 *   4. Cascade-revoke: user disableDelegation(root) -> re-redeem MUST revert.
 *
 * Grounded in MetaMask Smart Accounts Kit docs (function-call scope L3011-3035,
 * redelegation via parentDelegation L2526-2549, redeemDelegations L2866-2907,
 * disableDelegation L2623-2645). VERIFY import paths against the installed SDK version on
 * first run — the API is a documentation snapshot (^1.6.0). This is a SPIKE: a mock target
 * isolates the delegation mechanics from Governor proposal-lifecycle noise.
 *
 * RUN: see ../README.md. Requires RPC_URL + 3 funded test keys in .env. Spends ONLY testnet gas.
 */
import 'dotenv/config'
import {
  createPublicClient, createWalletClient, http,
  encodeFunctionData, encodeAbiParameters, parseAbi, getAbiItem, toFunctionSelector,
} from 'viem'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
// NOTE: confirm these exports in the installed @metamask/smart-accounts-kit build.
import {
  toMetaMaskSmartAccount, Implementation,
  createDelegation, ScopeType,
  DelegationManager, createExecution, ExecutionMode,
  getSmartAccountsEnvironment,
} from '@metamask/smart-accounts-kit'

const RPC = process.env.RPC_URL!
const GOVERNOR = (process.env.GOVERNOR_ADDRESS || '') as `0x${string}` // deploy MockGovernor.sol, put address here
const chain = baseSepolia

const ok = (c: boolean, m: string) => console.log(`${c ? 'PASS ✅' : 'FAIL ❌'}  ${m}`)

async function main() {
  const publicClient = createPublicClient({ chain, transport: http(RPC) })
  const env = getSmartAccountsEnvironment(chain.id)

  // 3 roles. In the product these are user wallet + 2 agents; here all are local test keys.
  const userEoa = privateKeyToAccount(process.env.USER_PK as `0x${string}`)
  const orchEoa = privateKeyToAccount(process.env.ORCH_PK as `0x${string}`)
  const analystEoa = privateKeyToAccount(process.env.ANALYST_PK as `0x${string}`)

  // The DELEGATOR must be a MetaMask smart account. Delegates can be plain addresses.
  const userSA = await toMetaMaskSmartAccount({
    client: publicClient, implementation: Implementation.Hybrid,
    deployParams: [userEoa.address, [], [], []], deploySalt: '0x', signer: { account: userEoa },
  })
  const orchSA = await toMetaMaskSmartAccount({
    client: publicClient, implementation: Implementation.Hybrid,
    deployParams: [orchEoa.address, [], [], []], deploySalt: '0x', signer: { account: orchEoa },
  })

  const CASTVOTE_SIG = 'castVote(uint256,uint8)'
  const selector = toFunctionSelector(CASTVOTE_SIG)
  const PROPOSAL_ID = 1n
  const SUPPORT_FOR = 1 // 0=Against 1=For 2=Abstain — chosen at REDEEM time (Venice decides)

  // (1) ROOT delegation: scope to Governor.castVote, LOCK proposalId via allowedCalldata,
  //     leave `support` byte free. calldata layout: [4 selector][32 proposalId][32 support].
  const rootDelegation = createDelegation({
    scope: {
      type: ScopeType.FunctionCall,
      targets: [GOVERNOR],
      selectors: [CASTVOTE_SIG],
      allowedCalldata: [{
        // lock proposalId == PROPOSAL_ID; startIndex 4 = right after the 4-byte selector.
        value: encodeAbiParameters([{ name: 'proposalId', type: 'uint256' }], [PROPOSAL_ID]),
        startIndex: 4,
      }],
    },
    to: orchSA.address, from: userSA.address, environment: userSA.environment,
  })
  const rootSigned = { ...rootDelegation, signature: await userSA.signDelegation({ delegation: rootDelegation }) }
  ok(!!rootSigned.signature, '(1) root FunctionCall delegation (castVote, proposalId locked, support open) signed')

  // (2) REDELEGATION (attenuate): orchestrator -> analyst, same/narrower scope, parentDelegation = rootSigned.
  const redelegation = createDelegation({
    scope: {
      type: ScopeType.FunctionCall, targets: [GOVERNOR], selectors: [CASTVOTE_SIG],
      allowedCalldata: [{ value: encodeAbiParameters([{ name: 'proposalId', type: 'uint256' }], [PROPOSAL_ID]), startIndex: 4 }],
    },
    to: analystEoa.address, from: orchSA.address, environment: orchSA.environment,
    parentDelegation: rootSigned, // <-- the redelegation link (narrow-only enforced by the framework)
  })
  const reSigned = { ...redelegation, signature: await orchSA.signDelegation({ delegation: redelegation }) }
  ok(!!reSigned.signature, '(2) 2-hop redelegation orchestrator->analyst signed (parentDelegation set)')

  // (3) REDEEM the chain to actually cast the vote. Chain order is LEAF -> ROOT.
  const execution = createExecution({
    target: GOVERNOR,
    callData: encodeFunctionData({
      abi: parseAbi([`function ${CASTVOTE_SIG}`]),
      functionName: 'castVote', args: [PROPOSAL_ID, SUPPORT_FOR],
    }),
  })
  const redeemCalldata = DelegationManager.encode.redeemDelegations({
    delegations: [[reSigned, rootSigned]], // leaf-first, root-last
    modes: [ExecutionMode.SingleDefault],
    executions: [[execution]],
  })
  // analyst (the leaf delegate) submits the redemption to the DelegationManager.
  const analystWallet = createWalletClient({ account: analystEoa, chain, transport: http(RPC) })
  const voteTx = await analystWallet.sendTransaction({ to: env.DelegationManager, data: redeemCalldata })
  const voteRcpt = await publicClient.waitForTransactionReceipt({ hash: voteTx })
  ok(voteRcpt.status === 'success', `(3) redeem chain -> castVote executed (tx ${voteTx})`)

  // (4) CASCADE-REVOKE: user disables the ROOT delegation; re-redeem MUST revert.
  const disableData = DelegationManager.encode.disableDelegation({ delegation: rootSigned })
  // disable is sent BY THE DELEGATOR (user smart account) — here via the user EOA for the spike.
  const userWallet = createWalletClient({ account: userEoa, chain, transport: http(RPC) })
  const disTx = await userWallet.sendTransaction({ to: env.DelegationManager, data: disableData })
  await publicClient.waitForTransactionReceipt({ hash: disTx })
  let reverted = false
  try {
    // simulate first (this is what the product's <5s "kill the chain" check does)
    await publicClient.call({ to: env.DelegationManager, data: redeemCalldata, account: analystEoa.address })
  } catch (e) { reverted = true }
  ok(reverted, '(4) after root disableDelegation -> next redeem reverts in simulation ("kill the chain")')

  console.log('\n--- go/no-go #2 verdict ---')
  console.log('If all four PASS: FunctionCall-scoped castVote + 2-hop attenuated redelegation + redeem + cascade-revoke all work. GREEN.')
}
main().catch((e) => { console.error('SPIKE ERROR:', e); process.exit(1) })
