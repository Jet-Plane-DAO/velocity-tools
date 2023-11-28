import { Asset, BrowserWallet, Transaction, keepRelevant } from '@meshsdk/core';
import { LOVELACE_MULTIPLIER } from './ada';

const MIN_ADA_TO_RETURN = 3000000;

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
  } catch (error) {}
};

export const sendAssets = async (
  adaAmount: number,
  nativeTokenAmount: number,
  assetUnits: string[],
  tx: Transaction,
  wallet: BrowserWallet,
  campaignConfig: any,
) => {
  const utxos = await wallet.getUtxos();

  const assetMap = new Map();

  if (adaAmount > 0) {
    if (debug)
      console.log(
        '[set lovelace]',
        `${adaAmount * LOVELACE_MULTIPLIER + MIN_ADA_TO_RETURN}`,
      );
    assetMap.set(
      'lovelace',
      `${adaAmount * LOVELACE_MULTIPLIER + MIN_ADA_TO_RETURN}`,
    );
  } else {
    if (debug) console.log('[set lovelace]', `${2 * LOVELACE_MULTIPLIER}`);
    assetMap.set('lovelace', `${2 * LOVELACE_MULTIPLIER}`);
  }

  if (nativeTokenAmount > 0) {
    if (debug) console.log('[set token]', `${nativeTokenAmount}`);
    assetMap.set(campaignConfig.tokenAssetName, `${nativeTokenAmount}`);
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
      ? `${adaAmount * LOVELACE_MULTIPLIER + MIN_ADA_TO_RETURN}`
      : `${MIN_ADA_TO_RETURN}`,
  );

  const inputs = relevant?.length ? relevant : utxos;
  if (debug) console.log(`[set inputs]`, inputs);
  tx.setTxInputs(inputs);

  if (adaAmount > 0) {
    if (debug) console.log(`[send lovelace]`, `${adaAmount * LOVELACE_MULTIPLIER}`);
    tx.sendLovelace(
      { address: campaignConfig.walletAddress },
      `${adaAmount * LOVELACE_MULTIPLIER}`,
    );
  }

  if (nativeTokenAmount > 0 || assetUnits?.length) {
    const assets: Asset[] = assetUnits.map((a: any) => ({ unit: a, quantity: '1' }));

    if (nativeTokenAmount > 0)
      assets.push({
        unit: campaignConfig.tokenAssetName,
        quantity: `${nativeTokenAmount}`,
      });

    console.log(assets);

    if (nativeTokenAmount > 0 && debug) {
      console.log(`[send token]`, `${nativeTokenAmount}`);
    }
    if (assetUnits?.length && debug) {
      if (debug) assetUnits.map((a) => console.log(`[send ${a}]`, `1`));
    }
    if (assets.length)
      tx.sendAssets({ address: campaignConfig.walletAddress }, assets);
  }
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
