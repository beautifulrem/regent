/**
 * The orchestrator's autonomous loop for one grant: attenuated-redelegate to the analyst,
 * have the analyst decide in the Venice TEE and cast, and drive the run through its states.
 */
import { createPublicClient, createWalletClient, http, type Address, type Hex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { getSmartAccountsEnvironment, Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';
import {
  delegationHash,
  delegationManagerAddress,
  redelegateVote,
  type Delegation,
  type GrantRequest,
  type VeniceConfig,
} from '@mandate/shared';
import { runAnalystVote } from '@mandate/analyst';
import type { RunStore } from './runStore.js';

export interface OrchestratorConfig {
  rpcUrl: string;
  orchestratorPk: Hex;
  analystPk: Hex;
  veniceCfg: VeniceConfig;
}

/** Drive one run end-to-end, recording every transition in the store. Never throws. */
export async function runVote(
  store: RunStore,
  runId: string,
  grant: GrantRequest,
  cfg: OrchestratorConfig,
): Promise<void> {
  try {
    const client = createPublicClient({ chain: baseSepolia, transport: http(cfg.rpcUrl) }) as PublicClient;
    const environment = getSmartAccountsEnvironment(grant.chainId);
    const dm = delegationManagerAddress(grant.chainId);
    const orchEoa = privateKeyToAccount(cfg.orchestratorPk);
    const orchSA = await toMetaMaskSmartAccount({
      client, implementation: Implementation.Hybrid,
      deployParams: [orchEoa.address, [], [], []], deploySalt: '0x', signer: { account: orchEoa },
    });
    const analystEoa = privateKeyToAccount(cfg.analystPk);
    const proposalId = BigInt(grant.proposalId);
    const governor = grant.governor as Address;
    const root = grant.rootDelegation as unknown as Delegation;

    // attenuated redelegation orchestrator → analyst
    const redel = redelegateVote({
      governor, proposalId, delegate: analystEoa.address,
      delegator: orchSA.address, environment, parentDelegation: root,
    });
    const redelSigned = {
      ...redel,
      signature: (await orchSA.signDelegation({ delegation: redel })) as Hex,
    } as Delegation;
    store.patch(runId, { status: 'redelegated', redelegationHash: delegationHash(redelSigned, grant.chainId, dm) });

    // analyst decides in the Venice TEE and casts
    store.patch(runId, { status: 'analyzing' });
    const analystWallet = createWalletClient({ account: analystEoa, chain: baseSepolia, transport: http(cfg.rpcUrl) });
    const result = await runAnalystVote(
      { publicClient: client, analystWallet, analystAccount: analystEoa, delegationManager: dm, veniceCfg: cfg.veniceCfg },
      { chain: [redelSigned, root], governor, proposalId, proposalText: grant.proposalText },
    );
    store.patch(runId, { status: 'decided', venice: result.trace });
    store.patch(runId, { status: 'voted', vote: result.vote });
  } catch (err) {
    store.patch(runId, {
      status: 'failed',
      error: { code: 'INTERNAL', message: err instanceof Error ? err.message : String(err) },
    });
  }
}
