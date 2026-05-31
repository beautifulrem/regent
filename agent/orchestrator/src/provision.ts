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
}

export interface ProvisionResult {
  sa: Address;
  deployed: boolean;
  alreadyDeployed: boolean;
  txHash?: Hex;
  /** Top-up transfer so the SA can prefund its own kill-the-chain UserOp (judge wallets arrive empty). */
  fundTx?: Hex;
  funded?: boolean;
}

/** Float sent to a provisioned SA so it can pay for one recall (disableDelegation) UserOp. */
const SA_TOP_UP = parseEther('0.003');
const MIN_SA_BALANCE = parseEther('0.0015');

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

  return { sa: sa.address, deployed: true, alreadyDeployed, txHash, fundTx, funded: !!fundTx };
}
