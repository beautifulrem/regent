import { createBundlerClient } from 'viem/account-abstraction';
import { createPublicClient, http, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { delegationManagerAddress, revokeRootCalldata, type Delegation } from '@mandate/shared';
import { CHAIN_ID, RPC_URL } from './config';
import type { SmartAccount } from './wallet';

const BUNDLER = process.env.NEXT_PUBLIC_BUNDLER_URL ?? 'https://public.pimlico.io/v2/84532/rpc';

/**
 * Kill the chain: the user smart account disables the ROOT delegation via a UserOp (relayed by a
 * keyless public bundler). After this, every redemption of the chain reverts.
 */
export async function recall(userSA: SmartAccount, rootSigned: Delegation): Promise<{ txHash: Hex }> {
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
  const bundler = createBundlerClient({ client: publicClient, transport: http(BUNDLER) });
  const userOpHash = await bundler.sendUserOperation({
    account: userSA as Parameters<typeof bundler.sendUserOperation>[0]['account'],
    calls: [{ to: delegationManagerAddress(CHAIN_ID), data: revokeRootCalldata(rootSigned) }],
  });
  const receipt = await bundler.waitForUserOperationReceipt({ hash: userOpHash });
  return { txHash: receipt.receipt.transactionHash };
}
