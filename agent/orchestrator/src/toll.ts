/**
 * The REAL x402 pay-per-query toll, settled on-chain per vote. The analyst's "context feed" (seller)
 * charges 1 MVOTE per query; the orchestrator SA (buyer) pays it through a SCOPED ERC-7710
 * Erc20TransferAmount delegation that the seller redeems on-chain — so a real MVOTE actually moves,
 * and the seller's balance grows by one toll per vote. The deployer (the VotesToken owner) mints the
 * buyer a small batch when it runs dry, so the rail is self-funding for the demo.
 */
import { randomBytes } from 'node:crypto';
import { createWalletClient, encodeFunctionData, erc20Abi, http, parseAbi, type Address, type Hex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { getSmartAccountsEnvironment, type toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';
import {
  buildPaymentDelegation,
  delegationManagerAddress,
  settlePaymentCalldata,
  type Delegation,
  type TollReceipt,
} from '@mandate/shared';

const MINT_ABI = parseAbi(['function mint(address to, uint256 amount)']);

/** 1 MVOTE per query (18 decimals) — mirrors the app's TOLL_PRICE_ATOMS. */
export const TOLL_ATOMS = 10n ** 18n;
/** When the buyer runs dry, the deployer mints this many queries' worth in one go (avoids minting per vote). */
const TOLL_TOPUP_ATOMS = TOLL_ATOMS * 25n;

type OrchSmartAccount = Awaited<ReturnType<typeof toMetaMaskSmartAccount>>;

export interface TollConfig {
  rpcUrl: string;
  analystPk: Hex;
  deployerPk: Hex;
  token: Address;
  chainId: number;
}

/**
 * Settle ONE real toll for this query and return the on-chain receipt. The buyer is the orchestrator
 * SA (signs the scoped payment delegation), the seller is the analyst (redeems it to pull the toll).
 */
export async function settleToll(
  client: PublicClient,
  orchSA: OrchSmartAccount,
  proposalId: bigint,
  cfg: TollConfig,
): Promise<TollReceipt> {
  const analyst = privateKeyToAccount(cfg.analystPk);
  const dm = delegationManagerAddress(cfg.chainId);
  const environment = getSmartAccountsEnvironment(cfg.chainId);
  const balanceOf = (who: Address) =>
    client.readContract({ address: cfg.token, abi: erc20Abi, functionName: 'balanceOf', args: [who] }) as Promise<bigint>;

  // 1) keep the buyer solvent — the deployer owns VotesToken, so top it up if it can't cover a toll.
  if ((await balanceOf(orchSA.address)) < TOLL_ATOMS) {
    const deployer = createWalletClient({ account: privateKeyToAccount(cfg.deployerPk), chain: baseSepolia, transport: http(cfg.rpcUrl) });
    const mintTx = await deployer.sendTransaction({
      to: cfg.token,
      data: encodeFunctionData({ abi: MINT_ABI, functionName: 'mint', args: [orchSA.address, TOLL_TOPUP_ATOMS] }),
    });
    await client.waitForTransactionReceipt({ hash: mintTx });
  }

  // 2) the buyer signs the SCOPED Erc20TransferAmount delegation (seller may pull at most the toll, of
  //    this token, to itself — and nothing else).
  // a FRESH salt per query makes each toll its OWN 1-MVOTE delegation, so the cumulative
  // Erc20TransferAmount allowance is never exceeded (true pay-per-query — vs one reused hash whose
  // single-toll allowance is spent after the first redeem).
  const paymentDel: Delegation = {
    ...buildPaymentDelegation({ buyer: orchSA.address, seller: analyst.address, asset: cfg.token, amount: TOLL_ATOMS, environment }),
    salt: `0x${randomBytes(32).toString('hex')}` as Hex,
  };
  const signed = { ...paymentDel, signature: (await orchSA.signDelegation({ delegation: paymentDel })) as Hex } as Delegation;

  // 3) the seller redeems it on-chain — the DelegationManager enforces the caveat and pulls the toll.
  const sellerWallet = createWalletClient({ account: analyst, chain: baseSepolia, transport: http(cfg.rpcUrl) });
  const txHash = await sellerWallet.sendTransaction({ to: dm, data: settlePaymentCalldata(signed, cfg.token, analyst.address, TOLL_ATOMS) });
  await client.waitForTransactionReceipt({ hash: txHash });

  // 4) the seller's real post-settlement balance is the live, on-chain proof the MVOTE moved.
  const sellerBalance = await balanceOf(analyst.address);
  return {
    txHash,
    asset: cfg.token,
    buyer: orchSA.address,
    seller: analyst.address,
    amount: TOLL_ATOMS.toString(),
    sellerBalance: sellerBalance.toString(),
    resource: `/context/proposal-${proposalId.toString().slice(-6)}`,
  };
}
