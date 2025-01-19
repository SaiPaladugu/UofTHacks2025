/**
 * Bulletin board common types and abstractions.
 *
 * @module
 */

import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { Contract, Witnesses, type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
// import type { STATE, LocationBoard, Contract, Witnesses } from '@midnight-ntwrk/bboard-contract-tutorial';

type LocationBoard = {
  latitude: number;
  longitude: number;
  user: string;
  image: string;
}

/**
 * The private states consumed throughout the application.
 *
 * @remarks
 * {@link PrivateStates} can be thought of as a type that describes a schema for all
 * private states for all contracts used in the application. Each key represents
 * the type of private state consumed by a particular type of contract.
 * The key is used by the deployed contract when interacting with a private state provider,
 * and the type (i.e., `typeof PrivateStates[K]`) represents the type of private state
 * expected to be returned.
 *
 * Since there is only one contract type for the bulletin board example, we only define a
 * single key/type in the schema.
 *
 * @public
 */
export type PrivateStates = {
  /**
   * Key used to provide the private state for {@link LocationBoardContract} deployments.
   */
  readonly LocationBoard: LocationBoard;
};

/**
 * Represents a bulletin board contract and its private state.
 *
 * @public
 */
export type LocationBoardContract = Contract<LocationBoard, Witnesses<LocationBoard>>;

/**
 * The keys of the circuits exported from {@link LocationBoardContract}.
 *
 * @public
 */
export type LocationBoardKeys = Exclude<keyof LocationBoardContract['impureCircuits'], number | symbol>;

/**
 * The providers required by {@link LocationBoardContract}.
 *
 * @public
 */
export type LocationBoardProviders = MidnightProviders<LocationBoardKeys, PrivateStates>;

/**
 * A {@link LocationBoardContract} that has been deployed to the network.
 *
 * @public
 */
export type DeployedLocationBoardContract = FoundContract<any, LocationBoardContract>;

/**
 * A type that represents the derived combination of public (or ledger), and private state.
 */
export type LocationBoardDerivedState = {
  readonly state: any;
  readonly instance: bigint;
  readonly message: string | undefined;

  /**
   * A readonly flag that determines if the current message was posted by the current user.
   *
   * @remarks
   * The `poster` property of the public (or ledger) state is the public key of the message poster, while
   * the `secretKey` property of {@link LocationBoard} is the secret key of the current user. If
   * `poster` corresponds to `secretKey`, then `isOwner` is `true`.
   */
  readonly isOwner: boolean;
};
