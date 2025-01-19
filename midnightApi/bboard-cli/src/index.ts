/*
 * This file is the main driver for the Midnight location board example.
 * The entry point is the run function, at the end of the file.
 * We expect the startup files (testnet-remote.ts, standalone.ts, etc.) to
 * call run with some specific configuration that sets the network addresses
 * of the servers this file relies on.
 */

import { createInterface, type Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { WebSocket } from 'ws';
import { webcrypto } from 'crypto';
import {
  type LocationBoardProviders,
  type PrivateStates,
  LocationBoardAPI,
  utils,
  type LocationBoardDerivedState,
  type DeployedLocationBoardContract,
} from '@midnight-ntwrk/locationboard-api-tutorial';
import { ledger, type Ledger, STATE } from '@midnight-ntwrk/locationboard-contract-tutorial';
import {
  type BalancedTransaction,
  createBalancedTx,
  type MidnightProvider,
  type UnbalancedTransaction,
  type WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { type Wallet } from '@midnight-ntwrk/wallet-api';
import * as Rx from 'rxjs';
import { type CoinInfo, nativeToken, Transaction, type TransactionId } from '@midnight-ntwrk/ledger';
import { Transaction as ZswapTransaction } from '@midnight-ntwrk/zswap';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { type Resource, WalletBuilder } from '@midnight-ntwrk/wallet';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { type Logger } from 'pino';
import { type Config, StandaloneConfig } from './config.js';
import type { StartedDockerComposeEnvironment, DockerComposeEnvironment } from 'testcontainers';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { getLedgerNetworkId, getZswapNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

// @ts-expect-error: It's needed to make Scala.js and WASM code able to use cryptography
globalThis.crypto = webcrypto;

// @ts-expect-error: It's needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

/* **********************************************************************
 * getLocationBoardLedgerState: a helper that queries the current state of
 * the data on the ledger, for a specific location board contract.
 */

export const getLocationBoardLedgerState = (
  providers: LocationBoardProviders,
  contractAddress: ContractAddress,
): Promise<Ledger | null> =>
  providers.publicDataProvider
    .queryContractState(contractAddress)
    .then((contractState) => (contractState != null ? ledger(contractState.data) : null));

/* **********************************************************************
 * deployOrJoin: returns a contract, by prompting the user about
 * whether to deploy a new one or join an existing one and then
 * calling the appropriate helper.
 */

const DEPLOY_OR_JOIN_QUESTION = `
You can do one of the following:
  1. Deploy a new location board contract
  2. Join an existing location board contract
  3. Exit
Which would you like to do? `;

const deployOrJoin = async (providers: LocationBoardProviders, rli: Interface, logger: Logger): Promise<LocationBoardAPI | null> => {
  let api: LocationBoardAPI | null = null;

  while (true) {
    const choice = await rli.question(DEPLOY_OR_JOIN_QUESTION);
    switch (choice) {
      case '1':
        api = await LocationBoardAPI.deploy(providers, logger);
        logger.info(`Deployed contract at address: ${api.deployedContractAddress}`);
        return api;
      case '2':
        api = await LocationBoardAPI.join(providers, await rli.question('What is the contract address (in hex)? '), logger);
        logger.info(`Joined contract at address: ${api.deployedContractAddress}`);
        return api;
      case '3':
        logger.info('Exiting...');
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

/* **********************************************************************
 * displayLedgerState: shows the values of each of the fields declared
 * by the contract to be in the ledger state of the location board.
 */

const displayLedgerState = async (
  providers: LocationBoardProviders,
  deployedLocationBoardContract: DeployedLocationBoardContract,
  logger: Logger,
): Promise<void> => {
  const contractAddress = deployedLocationBoardContract.deployTxData.public.contractAddress;
  const ledgerState = await getLocationBoardLedgerState(providers, contractAddress);
  if (ledgerState === null) {
    logger.info(`There is no location board contract deployed at ${contractAddress}`);
  } else {
    const boardState = ledgerState.state === STATE.occupied ? 'occupied' : 'vacant';
    const latestMessage = !ledgerState.message.is_some ? 'none' : ledgerState.message.value;
    logger.info(`Current state is: '${boardState}'`);
    logger.info(`Current message is: '${latestMessage}'`);
    logger.info(`Current instance is: ${ledgerState.instance}`);
    logger.info(`Current poster is: '${toHex(ledgerState.poster)}'`);
  }
};

/* **********************************************************************
 * displayPrivateState: shows the hex-formatted value of the secret key.
 */

const displayPrivateState = async (providers: LocationBoardProviders, logger: Logger): Promise<void> => {
  const privateState = await providers.privateStateProvider.get('locationBoardPrivateState');
  if (privateState === null) {
    logger.info(`There is no existing location board private state`);
  } else {
    logger.info(`Current secret key is: ${toHex(privateState.secretKey)}`);
  }
};

/* **********************************************************************
 * displayDerivedState: shows the values of derived state which is made
 * by combining the ledger state with private state.
 */

const displayDerivedState = (ledgerState: LocationBoardDerivedState | undefined, logger: Logger) => {
  if (ledgerState === undefined) {
    logger.info(`No location board state currently available`);
  } else {
    const boardState = ledgerState.state === STATE.occupied ? 'occupied' : 'vacant';
    const latestMessage = ledgerState.state === STATE.occupied ? ledgerState.message : 'none';
    logger.info(`Current state is: '${boardState}'`);
    logger.info(`Current message is: '${latestMessage}'`);
    logger.info(`Current instance is: ${ledgerState.instance}`);
    logger.info(`Current poster is: '${ledgerState.isOwner ? 'you' : 'not you'}'`);
  }
};

/* **********************************************************************
 * mainLoop: the main interactive menu of the location board CLI.
 * Before starting the loop, the user is prompted to deploy a new
 * contract or join an existing one.
 */

const MAIN_LOOP_QUESTION = `
You can do one of the following:
  1. Post a location
  2. Take down your location
  3. Display the current ledger state (known by everyone)
  4. Display the current private state (known only to this DApp instance)
  5. Display the current derived state (known only to this DApp instance)
  6. Exit
Which would you like to do? `;

const mainLoop = async (providers: LocationBoardProviders, rli: Interface, logger: Logger): Promise<void> => {
  const locationBoardApi = await deployOrJoin(providers, rli, logger);
  if (locationBoardApi === null) {
    return;
  }
  let currentState: LocationBoardDerivedState | undefined;
  const stateObserver = {
    next: (state: LocationBoardDerivedState) => (currentState = state),
  };
  const subscription = locationBoardApi.state$.subscribe(stateObserver);
  try {
    while (true) {
      const choice = await rli.question(MAIN_LOOP_QUESTION);
      switch (choice) {
        case '1': {
          const message = await rli.question(`What location do you want to post? `);
          const image = await rli.question(`What is the image string? `);
          const lat = await rli.question(`What is the latitude? `);
          const lng = await rli.question(`What is the longitude? `);
          const user = await rli.question(`What is your username? `);
          await locationBoardApi.post(message, image, lat, lng, user);
          break;
        }
        case '2':
          await locationBoardApi.takeDown();
          break;
        case '3':
          await displayLedgerState(providers, locationBoardApi.deployedContract, logger);
          break;
        case '4':
          await displayPrivateState(providers, logger);
          break;
        case '5':
          displayDerivedState(currentState, logger);
          break;
        case '6':
          logger.info('Exiting...');
          return;
        default:
          logger.error(`Invalid choice: ${choice}`);
      }
    }
  } finally {
    subscription.unsubscribe();
  }
};

/* **********************************************************************
 * createWalletAndMidnightProvider: returns an object that
 * satisfies both the WalletProvider and MidnightProvider
 * interfaces, both implemented in terms of the given wallet.
 */

const createWalletAndMidnightProvider = async (wallet: Wallet): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(wallet.state());
  return {
    coinPublicKey: state.coinPublicKey,
    balanceTx(tx: UnbalancedTransaction, newCoins: CoinInfo[]): Promise<BalancedTransaction> {
      return wallet
        .balanceTransaction(
          ZswapTransaction.deserialize(tx.serialize(getLedgerNetworkId()), getZswapNetworkId()),
          newCoins,
        )
        .then((tx) => wallet.proveTransaction(tx))
        .then((zswapTx) => Transaction.deserialize(zswapTx.serialize(getZswapNetworkId()), getLedgerNetworkId()))
        .then(createBalancedTx);
    },
    submitTx(tx: BalancedTransaction): Promise<TransactionId> {
      return wallet.submitTransaction(tx);
    },
  };
};

/* **********************************************************************
 * waitForFunds: wait for tokens to appear in a wallet.
 */

const waitForFunds = (wallet: Wallet, logger: Logger) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.tap((state) => {
        const scanned = state.syncProgress?.synced ?? 0n;
        const total = state.syncProgress?.total.toString() ?? 'unknown number';
        logger.info(`Wallet processed ${scanned} indices out of ${total}`);
      }),
      Rx.filter((state) => {
        const synced = state.syncProgress?.synced ?? 0n;
        const total = state.syncProgress?.total ?? 1_000n;
        return total - synced < 100n;
      }),
      Rx.map((s) => s.balances[nativeToken()] ?? 0n),
      Rx.filter((balance) => balance > 0n),
    ),
  );

/* **********************************************************************
 * buildWalletAndWaitForFunds: the main function that creates a wallet
 * and waits for tokens to appear in it.
 */

const buildWalletAndWaitForFunds = async (
  { indexer, indexerWS, node, proofServer }: Config,
  logger: Logger,
  seed: string,
): Promise<Wallet & Resource> => {
  const wallet = await WalletBuilder.buildFromSeed(
    indexer,
    indexerWS,
    proofServer,
    node,
    seed,
    getZswapNetworkId(),
    'warn',
  );
  wallet.start();
  const state = await Rx.firstValueFrom(wallet.state());
  logger.info(`Your wallet seed is: ${seed}`);
  logger.info(`Your wallet address is: ${state.address}`);
  let balance = state.balances[nativeToken()];
  if (balance === undefined || balance === 0n) {
    logger.info(`Your wallet balance is: 0`);
    logger.info(`Waiting to receive tokens...`);
    balance = await waitForFunds(wallet, logger);
  }
  logger.info(`Your wallet balance is: ${balance}`);
  return wallet;
};

// Generate a random seed and create the wallet with that.
const buildFreshWallet = async (config: Config, logger: Logger): Promise<Wallet & Resource> =>
  await buildWalletAndWaitForFunds(config, logger, toHex(utils.randomBytes(32)));

// Prompt for a seed and create the wallet with that.
const buildWalletFromSeed = async (config: Config, rli: Interface, logger: Logger): Promise<Wallet & Resource> => {
  const seed = await rli.question('Enter your wallet seed: ');
  return await buildWalletAndWaitForFunds(config, logger, seed);
};

/* ***********************************************************************
 * This seed gives access to tokens minted in the genesis block of a local development node - only
 * used in standalone networks to build a wallet with initial funds.
 */
const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000042';

/* **********************************************************************
 * buildWallet: unless running in a standalone (offline) mode,
 * prompt the user to tell us whether to create a new wallet
 * or recreate one from a prior seed.
 */

const WALLET_LOOP_QUESTION = `
You can do one of the following:
  1. Build a fresh wallet
  2. Build wallet from a seed
  3. Exit
Which would you like to do? `;

const buildWallet = async (config: Config, rli: Interface, logger: Logger): Promise<(Wallet & Resource) | null> => {
  if (config instanceof StandaloneConfig) {
    return await buildWalletAndWaitForFunds(config, logger, GENESIS_MINT_WALLET_SEED);
  }
  while (true) {
    const choice = await rli.question(WALLET_LOOP_QUESTION);
    switch (choice) {
      case '1':
        return await buildFreshWallet(config, logger);
      case '2':
        return await buildWalletFromSeed(config, rli, logger);
      case '3':
        logger.info('Exiting...');
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

const mapContainerPort = (env: StartedDockerComposeEnvironment, url: string, containerName: string) => {
  const mappedUrl = new URL(url);
  const container = env.getContainer(containerName);

  mappedUrl.port = String(container.getFirstMappedPort());

  return mappedUrl.toString().replace(/\/+$/, '');
};

/* **********************************************************************
 * run: the main entry point that starts the whole location board CLI.
 */

export const run = async (config: Config, logger: Logger, dockerEnv?: DockerComposeEnvironment): Promise<void> => {
  const rli = createInterface({ input, output, terminal: true });
  let env;
  if (dockerEnv !== undefined) {
    env = await dockerEnv.up();

    if (config instanceof StandaloneConfig) {
      config.indexer = mapContainerPort(env, config.indexer, 'locationboard-indexer');
      config.indexerWS = mapContainerPort(env, config.indexerWS, 'locationboard-indexer');
      config.node = mapContainerPort(env, config.node, 'locationboard-node');
      config.proofServer = mapContainerPort(env, config.proofServer, 'locationboard-proof-server');
    }
  }
  const wallet = await buildWallet(config, rli, logger);
  try {
    if (wallet !== null) {
      const walletAndMidnightProvider = await createWalletAndMidnightProvider(wallet);
      const providers = {
        privateStateProvider: levelPrivateStateProvider<PrivateStates>({
          privateStateStoreName: config.privateStateStoreName,
        }),
        publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
        zkConfigProvider: new NodeZkConfigProvider<'post' | 'take_down'>(config.zkConfigPath),
        proofProvider: httpClientProofProvider(config.proofServer),
        walletProvider: walletAndMidnightProvider,
        midnightProvider: walletAndMidnightProvider,
      };
      await mainLoop(providers, rli, logger);
    }
  } catch (e) {
    if (e instanceof Error) {
      logger.error(`Found error '${e.message}'`);
      logger.info('Exiting...');
      logger.debug(`${e.stack}`);
    } else {
      throw e;
    }
  } finally {
    try {
      rli.close();
      rli.removeAllListeners();
    } catch (e) {
    } finally {
      try {
        if (wallet !== null) {
          await wallet.close();
        }
      } catch (e) {
      } finally {
        try {
          if (env !== undefined) {
            await env.down();
            logger.info('Goodbye');
            process.exit(0);
          }
        } catch (e) {}
      }
    }
  }
};
