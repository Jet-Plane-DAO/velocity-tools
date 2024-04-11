import { Asset, BrowserWallet, Transaction, keepRelevant } from '@meshsdk/core';
import { LOVELACE_MULTIPLIER } from './ada';
import { isPolicyOffChain } from './offchain';
import PropTypes from 'prop-types'


export enum UTXOStrategy {
  ISOLATED = 'ISOLATED',
  KITCHEN_SINK = 'KITCHEN_SINK',
  DEFAULT = 'DEFAULT',
}


export const UTXOStrategyType = PropTypes.oneOf(
  Object.values(UTXOStrategy) as UTXOStrategy[]
);

const MIN_ADA_TO_RETURN = 1500000;

const debug = process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true';

export const logConfig = (config: any) => {
  if (debug) console.log('config', config);
};

export const logTx = (tx: any) => {
  if (!debug) return;
  try {
    console.log('[tx props]', {
      changeAddress: tx._changeAddress,
      outputs: tx._txOutputs,
      recipients: tx._recipients,
      txWithdrawals: tx._txWithdrawals,
    });
  } catch (error) { }
};

export const logDebugMessage = (message: string) => {
  if (debug) console.log(`[message]: ${message}`);
}

export const noAssetsAdaAmount = (q: any) =>
  (q.assetsToInclude || []).length === 0 && q.price === 0 ? 1 : 0;

export const validatePlan = (
  connected: boolean,
  campaignConfig: any,
  planId: string,
  selectedInputs: any[],
) => {
  if (!connected) {
    throw new Error('Wallet not connected');
  }
  const plan = campaignConfig!.plans.find((p: any) => p.id === planId);
  if (!plan) throw new Error('Plan not found');

  for (const i of selectedInputs) {
    if (!i?.policyId?.length || isPolicyOffChain(i.policyId)) continue;
    const input = campaignConfig?.inputs?.find(
      (x: any) => x.policyId === i.policyId,
    );
    if (!input) throw new Error('Input not found');
  }
  return plan;
};

const setIsolatedInputs = async (wallet: BrowserWallet, assetUnits: string[], nativeToken: { amount: number, asset: string }, adaAmount: number) => {
  const utxos = await wallet.getUtxos();

  const assetMap = new Map();

  if (nativeToken.amount > 0 || assetUnits?.length) {
    if (adaAmount > 0) {
      if (debug)
        console.log(
          '[set lovelace]',
          `${Math.round(adaAmount * LOVELACE_MULTIPLIER + MIN_ADA_TO_RETURN)}`,
        );
      assetMap.set(
        'lovelace',
        `${Math.round(adaAmount * LOVELACE_MULTIPLIER + MIN_ADA_TO_RETURN)}`,
      );
    } else {
      if (debug)
        console.log('[set lovelace]', `${Math.round(2 * LOVELACE_MULTIPLIER)}`);
      assetMap.set('lovelace', `${Math.round(2 * LOVELACE_MULTIPLIER)}`);
    }

    if (nativeToken.amount > 0) {
      if (debug)
        console.log('[set token]', `${nativeToken.amount} ${nativeToken.asset}`);
      assetMap.set(nativeToken.asset, `${nativeToken.amount}`);
    }

    if (assetUnits?.length) {
      assetUnits.map((a: any) => {
        if (debug) console.log(`[set ${a}]`, `1`);
        return assetMap.set(a, `1`);
      });
    }

    const relevant = keepRelevant(
      assetMap,
      utxos,
      adaAmount > 0
        ? `${Math.round(adaAmount * LOVELACE_MULTIPLIER + MIN_ADA_TO_RETURN)}`
        : `${MIN_ADA_TO_RETURN}`,
    );

    const inputs = relevant?.length ? relevant : utxos;
    if (debug) console.log(`[set inputs]`, inputs);
    return inputs;
  }
  return [];
}


export const sendAssets = async (
  adaAmount: number,
  nativeTokenAmount: number,
  assetUnits: string[],
  tx: Transaction,
  wallet: BrowserWallet,
  walletAddress: string,
  nativeTokenAsset: string,
  strategy: UTXOStrategy,
) => {
  if (strategy === UTXOStrategy.ISOLATED) {
    const inputs = await setIsolatedInputs(wallet, assetUnits, { amount: nativeTokenAmount, asset: nativeTokenAsset }, adaAmount);
    if (debug) console.log(`[isolated inputs]`, inputs);
    tx.setTxInputs(inputs);
  }

  if (strategy === UTXOStrategy.KITCHEN_SINK) {
    const utxos = await wallet.getUtxos();
    if (debug) console.log(`[kitchen sink inputs]`, utxos);
    tx.setTxInputs(utxos);
  }


  if (adaAmount > 0) {
    const adaQuantity = `${Math.round(adaAmount * LOVELACE_MULTIPLIER)}`
    if (debug)
      console.log(`[send lovelace]`, adaQuantity);
    tx.sendLovelace(
      { address: walletAddress },
      adaQuantity
    );
  }

  if (nativeTokenAmount > 0 || assetUnits?.length) {
    const assets: Asset[] = assetUnits.map((a: any) => ({ unit: a, quantity: '1' }));

    if (nativeTokenAmount > 0)
      assets.push({
        unit: nativeTokenAsset,
        quantity: `${nativeTokenAmount}`,
      });

    if (nativeTokenAmount > 0 && debug) {
      console.log(`[send token]`, `${nativeTokenAmount} ${nativeTokenAsset}`);
    }
    if (assetUnits?.length && debug) {
      if (debug) assetUnits.map((a) => console.log(`[send ${a}]`, `1`));
    }
    if (assets.length) tx.sendAssets({ address: walletAddress }, assets);
  }
  return;
};

export const submitTx = async (tx: Transaction, wallet: BrowserWallet) => {
  if (debug) logTx(tx);
  const unsignedTx = await tx.build();
  if (debug) console.log('[unsignedTx]', unsignedTx);
  const signedTx = await wallet.signTx(unsignedTx);
  if (debug) console.log('[signedTx]', signedTx);
  const hash = await wallet.submitTx(signedTx);
  if (debug) console.log('[hash]', hash);
  return hash;
};

export const setAddressMetadata = (tx: any, ix: number, address: any) => {
  if (address.length > 56) {
    const policyId = address.slice(0, 56);
    tx.setMetadata(ix, policyId);
    if (debug) console.log(`[metadata policy [${ix}]]`, policyId);
    ix += 1;
    const assetName = address.slice(56);
    tx.setMetadata(ix, assetName);
    if (debug) console.log(`[metadata asset name [${ix}]]`, assetName);
    ix += 1;
  } else {
    if (debug) console.log('invalid address for metadata [${ix}]', address);
  }
  return ix;
};
