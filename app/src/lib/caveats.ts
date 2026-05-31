import { getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit';
import type { Delegation } from '@mandate/shared';
import { decodeAbiParameters, getAddress, hexToBigInt, sliceHex, type Address, type Hex } from 'viem';

export interface VoteCaveatRow {
  enforcerName: string;
  enforcerAddr: string;
  claim: string;
  value: string;
  locked: boolean;
}

function enforcerNamesByAddress(chainId: number): Map<string, string> {
  const environment = getSmartAccountsEnvironment(chainId);
  return new Map(
    Object.entries(environment.caveatEnforcers).map(([name, addr]) => [
      (addr as string).toLowerCase(),
      name,
    ]),
  );
}

function decodeAllowedCalldata(terms: Hex): { claim: string; value: string } {
  const startIndex = Number(hexToBigInt(sliceHex(terms, 0, 32)));
  const lockedBytes = sliceHex(terms, 32);
  const byteLength = (lockedBytes.length - 2) / 2;
  const [proposalId] = decodeAbiParameters([{ type: 'uint256' }], lockedBytes);
  return {
    claim: `calldata bytes ${startIndex}–${startIndex + byteLength - 1}`,
    value: proposalId.toString(),
  };
}

export function decodeVoteCaveats(del: Delegation, chainId: number): VoteCaveatRow[] {
  const namesByAddress = enforcerNamesByAddress(chainId);
  const rows = del.caveats.map((caveat) => {
    const enforcerName = namesByAddress.get(caveat.enforcer.toLowerCase()) ?? 'UnknownEnforcer';
    const base = {
      enforcerName,
      enforcerAddr: caveat.enforcer,
      locked: true,
    };

    switch (enforcerName) {
      case 'AllowedTargetsEnforcer':
        return {
          ...base,
          claim: 'target',
          value: getAddress(caveat.terms as Address),
        };
      case 'AllowedMethodsEnforcer':
        return {
          ...base,
          claim: 'method selector',
          value: `${caveat.terms} = castVote(uint256,uint8)`,
        };
      case 'ValueLteEnforcer':
        return {
          ...base,
          claim: 'ETH value',
          value: '0 / cannot move funds',
        };
      case 'AllowedCalldataEnforcer':
        return {
          ...base,
          ...decodeAllowedCalldata(caveat.terms),
        };
      default:
        return {
          ...base,
          claim: 'caveat terms',
          value: caveat.terms,
        };
    }
  });

  return [
    ...rows,
    {
      enforcerName: '(unconstrained field)',
      enforcerAddr: '',
      claim: 'support byte',
      value: 'FREE — Venice decides',
      locked: false,
    },
  ];
}
