import { hexToStr, strToHex } from 'hexyjs';

export const toOffChainPolicy = (policyId: string) => {
  const policy = `ocp://${policyId}//`;
  const fill = Array((56 - policy.length * 2) / 2)
    .fill('0')
    .join('');
  return strToHex(policy + fill);
};

export const toOffChainUnit = (assetName: string, collectionId: string) => {
  return `${toOffChainPolicy(collectionId)}${toAssetName(assetName)}`;
};

export const isPolicyOffChain = (policyId: string) => {
  console.log('checking ocp', policyId);
  if (!hexToStr(policyId)) return false;
  return hexToStr(policyId).toString().startsWith('ocp://');
};

export const toAssetName = (assetName: string) => {
  return strToHex(assetName);
};
