import { BrowserWallet, Transaction } from '@meshsdk/core';

const debug = process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true';

export const logConfig = (config: any) => {
  if (debug) console.log('config', config);
};

export const logTx = (tx: any) => {
  if (!debug) return;
  const getProp = (prop: string): any => {
    return this![prop];
  };
  (tx as any).getProp = getProp;

  console.log('tx props', {
    changeAddress: tx.getProp('_changeAddress'),
    outputs: tx._txOutputs,
    recipients: tx._recipients,
    txWithdrawals: tx._txWithdrawals,
  });
};

export const submitTx = async (tx: Transaction, wallet: BrowserWallet) => {
  if (debug) logTx(tx);
  const unsignedTx = await tx.build();
  if (debug) console.log('unsignedTx', unsignedTx);
  const signedTx = await wallet.signTx(unsignedTx);
  if (debug) console.log('signedTx', signedTx);
  const hash = await wallet.submitTx(signedTx);
  if (debug) console.log('hash', hash);
  return hash;
};

export const setAddressMetadata = (tx: any, ix: number, address: any) => {
  if (address.length > 56) {
    const policyId = address.slice(0, 56);
    tx.setMetadata(ix, policyId);
    if (debug) console.log(`metadata policy [${ix}]`, policyId);
    ix += 1;
    const assetName = address.slice(56);
    tx.setMetadata(ix, assetName);
    if (debug) console.log(`metadata asset name [${ix}]`, assetName);
    ix += 1;
  } else {
    if (debug) console.log('invalid address for metadata [${ix}]', address);
  }
};

// export const sendAssets = async (tx: Transaction, adaAmount: number, nativeTokenAmount: number, assetUnits: string[]) {

// }
