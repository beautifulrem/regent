import { getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit';
import { buildVoteDelegation } from '@mandate/shared';
import { describe, expect, it } from 'vitest';
import { decodeVoteCaveats } from './caveats';

const CHAIN_ID = 84532;
const GOVERNOR = '0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5';
const USER = '0x1111111111111111111111111111111111111111';
const ORCH = '0x2222222222222222222222222222222222222222';
const PROPOSAL_ID = 12345n;

describe('decodeVoteCaveats', () => {
  it('decodes the signed vote scope from the delegation caveats', () => {
    const environment = getSmartAccountsEnvironment(CHAIN_ID);
    const rootDel = buildVoteDelegation({
      governor: GOVERNOR,
      proposalId: PROPOSAL_ID,
      delegate: ORCH,
      delegator: USER,
      environment,
      salt: '0x01',
    });
    const enforcerNames = new Map(
      Object.entries(environment.caveatEnforcers).map(([name, addr]) => [addr.toLowerCase(), name]),
    );

    const rows = decodeVoteCaveats(rootDel, CHAIN_ID);

    expect(rows.length).toBe(5);
    expect(rows.slice(0, 4).every((row) => row.locked)).toBe(true);
    expect(rows.slice(0, 4).map((row) => row.enforcerName)).toEqual(
      rootDel.caveats.map((caveat) => enforcerNames.get(caveat.enforcer.toLowerCase())),
    );
    expect(rows[0].value).toBe(GOVERNOR);
    expect(rows[1].value).toBe('0x56781388 = castVote(uint256,uint8)');
    expect(rows[3].value).toBe(PROPOSAL_ID.toString());
    expect(rows[4].locked).toBe(false);
    expect(rows[4].enforcerName).toBe('(unconstrained field)');
    expect(rows[4].value).toContain('FREE');
  });
});
