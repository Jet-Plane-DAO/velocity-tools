import { strToHex } from 'hexyjs';

export const OFFCHAIN_POLICY_ID = Array(56).fill('0').join('');

export const toAssetName = (assetName: string) => {
  return strToHex(assetName);
};
