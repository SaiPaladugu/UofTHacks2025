import { Ledger } from './managed/lboard/contract/index.cjs';
import { WitnessContext } from '@midnight-ntwrk/compact-runtime';

export type LocationBoardPrivateState = {
  secretKey: Uint8Array;
};

export const createLocationBoardPrivateState = (secretKey: Uint8Array) => ({
  secretKey,
});

export const witnesses = {
  local_secret_key: ({ privateState }: WitnessContext<Ledger, LocationBoardPrivateState>): [LocationBoardPrivateState, Uint8Array] => [
    privateState,
    new Uint8Array(32),
  ],
};