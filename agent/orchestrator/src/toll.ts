/**
 * The REAL x402 pay-per-query toll, settled on-chain per vote. The analyst's "context feed" (seller)
 * charges 1 mUSDC per query; the USER's smart account (buyer) pays it through ONE cumulative scoped
 * ERC-7710 Erc20TransferAmount delegation the user signed at grant time. The seller redeems that same
 * delegation each vote, so real mUSDC moves from the user to the seller — the ERC20TransferAmount
 * enforcer tracks cumulative spend per delegation hash, up to maxVotes x 1 mUSDC. MVOTE never moves.
 */
import { createWalletClient, erc20Abi, http, type Address, type Hex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { delegationManagerAddress, settlePaymentCalldata, type Delegation, type TollReceipt } from '@mandate/shared';

/** 1 mUSDC per query (6 decimals) — mirrors the app's TOLL_PRICE_ATOMS. */
export const TOLL_ATOMS = 1_000_000n;

export interface TollConfig {
  rpcUrl: string;
  analystPk: Hex;
  /** the mUSDC token the toll is paid in (separate from the MVOTE voting token). */
  paymentToken: Address;
  chainId: number;
}

/**
 * Settle ONE real toll for this query and return the on-chain receipt. The buyer is the USER's smart
 * account (it signed `paymentDel` at grant); the seller is the analyst, which redeems that SAME
 * delegation to pull 1 mUSDC. Cumulative: the enforcer rejects the redeem once the cap is reached.
 */
export async function settleToll(
  client: PublicClient,
  paymentDel: Delegation,
  proposalId: bigint,
  cfg: TollConfig,
): Promise<TollReceipt> {
  const analyst = privateKeyToAccount(cfg.analystPk);
  const dm = delegationManagerAddress(cfg.chainId);

  // the seller redeems the USER-signed cumulative payment delegation, pulling 1 mUSDC from the buyer.
  const sellerWallet = createWalletClient({ account: analyst, chain: baseSepolia, transport: http(cfg.rpcUrl) });
  const txHash = await sellerWallet.sendTransaction({
    to: dm,
    data: settlePaymentCalldata(paymentDel, cfg.paymentToken, analyst.address, TOLL_ATOMS),
  });
  await client.waitForTransactionReceipt({ hash: txHash });

  // the seller's real post-settlement balance is the live, on-chain proof the mUSDC moved.
  const sellerBalance = (await client.readContract({
    address: cfg.paymentToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [analyst.address],
  })) as bigint;

  return {
    txHash,
    asset: cfg.paymentToken,
    buyer: paymentDel.delegator,
    seller: analyst.address,
    amount: TOLL_ATOMS.toString(),
    sellerBalance: sellerBalance.toString(),
    resource: `/context/proposal-${proposalId.toString().slice(-6)}`,
  };
}
