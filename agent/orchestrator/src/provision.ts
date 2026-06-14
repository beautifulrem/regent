/**
 * Provision a judge's MetaMask smart account so it can be voted-as on the VoteBoard.
 *
 * The ERC-7710 redemption executes AS the root delegator's smart account, so that account must be
 * deployed on-chain first. A judge connects an arbitrary wallet; we derive their Hybrid SA from the
 * EOA address ALONE (a keyless signer — deployment never needs their private key) and pay the
 * one-time factory deploy from DEPLOYER_PK. The derived address matches what the app derives in
 * lib/wallet.ts (same deployParams + salt), so the grant the judge signs lands on this exact SA.
 */
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  parseEther,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount, toAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';

export interface ProvisionConfig {
  rpcUrl: string;
  deployerPk: Hex;
  /** the mUSDC token (the x402 budget). The deployer is the MockUSDC owner, so it mints the buyer SA a
   *  budget here — without it a freshly-derived judge SA holds 0 mUSDC, the per-vote toll pull reverts,
   *  and the x402 gate stays "locked" even after a vote lands. */
  paymentToken: Address;
}

export interface ProvisionResult {
  sa: Address;
  deployed: boolean;
  alreadyDeployed: boolean;
  txHash?: Hex;
  /** Top-up transfer so the SA can prefund its own kill-the-chain UserOp (judge wallets arrive empty). */
  fundTx?: Hex;
  funded?: boolean;
  /** mUSDC mint tx, when the buyer SA's x402 budget needed topping up. */
  mUSDCTx?: Hex;
}

/** Float sent to a provisioned SA so it can pay for one recall (disableDelegation) UserOp. */
const SA_TOP_UP = parseEther('0.003');
const MIN_SA_BALANCE = parseEther('0.0015');

/** x402 budget floor / top-up (mUSDC, 6 decimals): keep the buyer SA above ~60 mUSDC, mint 1000 when low. */
const MUSDC_MIN = 60_000_000n;
const MUSDC_TOPUP = 1_000_000_000n;
/** MockUSDC.mint(to, amount) — owner-only; the deployer (DEPLOYER_PK) is the owner. */
const MINT_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export async function provisionSmartAccount(cfg: ProvisionConfig, eoa: Address): Promise<ProvisionResult> {
  const client = createPublicClient({ chain: baseSepolia, transport: http(cfg.rpcUrl) }) as PublicClient;

  // Address-only signer: deployment uses deployParams + salt (CREATE2), never the judge's key.
  const judgeSigner = toAccount({
    address: eoa,
    async signMessage() {
      throw new Error('provision: keyless signer cannot sign');
    },
    async signTransaction() {
      throw new Error('provision: keyless signer cannot sign');
    },
    async signTypedData() {
      throw new Error('provision: keyless signer cannot sign');
    },
  });

  const sa = await toMetaMaskSmartAccount({
    client,
    implementation: Implementation.Hybrid,
    deployParams: [eoa, [], [], []],
    deploySalt: '0x',
    signer: { account: judgeSigner },
  });

  const deployer = privateKeyToAccount(cfg.deployerPk);
  const wallet = createWalletClient({ account: deployer, chain: baseSepolia, transport: http(cfg.rpcUrl) });

  // Deploy on first sight; the factory deploy is paid by the deployer (CREATE2 → deterministic addr).
  const alreadyDeployed = await sa.isDeployed();
  let txHash: Hex | undefined;
  if (!alreadyDeployed) {
    const { factory, factoryData } = await sa.getFactoryArgs();
    txHash = await wallet.sendTransaction({ to: factory as Address, data: factoryData as Hex });
    await client.waitForTransactionReceipt({ hash: txHash });
  }

  // Top up the SA so it can prefund its OWN recall: disableDelegation must be sent by the delegator
  // SA, and a judge's freshly-derived SA holds no ETH — without this the kill-the-chain UserOp fails
  // with "Smart Account does not have sufficient funds". The vote leg is paid by the analyst/redeemer.
  let fundTx: Hex | undefined;
  const balance = await client.getBalance({ address: sa.address });
  if (balance < MIN_SA_BALANCE) {
    fundTx = await wallet.sendTransaction({ to: sa.address, value: SA_TOP_UP });
    await client.waitForTransactionReceipt({ hash: fundTx });
  }

  // Fund the SA's x402 budget in mUSDC so the per-vote toll can actually SETTLE on-chain: the seller
  // pulls mUSDC from this SA via the cumulative ERC-7710 payment delegation. A freshly-derived judge SA
  // holds 0 mUSDC, so without this the toll reverts (the vote still lands, since the analyst pays gas)
  // and the x402 gate stays "locked" even after voting. Non-fatal: an already-funded SA or a non-owner
  // deployer simply skips it; the vote itself never depends on this.
  let mUSDCTx: Hex | undefined;
  try {
    const musdc = (await client.readContract({
      address: cfg.paymentToken,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [sa.address],
    })) as bigint;
    if (musdc < MUSDC_MIN) {
      mUSDCTx = await wallet.writeContract({
        address: cfg.paymentToken,
        abi: MINT_ABI,
        functionName: 'mint',
        args: [sa.address, MUSDC_TOPUP],
      });
      await client.waitForTransactionReceipt({ hash: mUSDCTx });
    }
  } catch (err) {
    console.error('provision: mUSDC budget top-up failed (non-fatal):', err instanceof Error ? err.message : err);
  }

  return { sa: sa.address, deployed: true, alreadyDeployed, txHash, fundTx, funded: !!fundTx, mUSDCTx };
}
