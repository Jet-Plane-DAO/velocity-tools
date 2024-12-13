import { hexToStr, strToHex } from 'hexyjs';

export const toOffChainPolicy = (policyId: string) => {
  const policy = `ocp://${policyId}//`;
  const fill = Array((56 - policy?.length * 2) / 2)
    .fill('0')
    .join('');
  return strToHex(policy + fill);
};

export const toOffChainUnit = (assetName: string, collectionId: string) => {
  return `${toOffChainPolicy(collectionId)}${toAssetName(assetName)}`;
};

export const isPolicyOffChain = (policyId: string) => {
  try {
    if (!hexToStr(policyId)) return false;
    return hexToStr(policyId).toString().startsWith('ocp://');
  } catch (error: any) {
    console.error('isPolicyOffChain error', error.message);
    return false;
  }
};

export const toPreDefinedPolicy = (inputId: string) => {
  const policy = `pd://${inputId}//`;
  const fill = Array((56 - policy?.length * 2) / 2)
    .fill('0')
    .join('');
  return strToHex(policy + fill);
};

export const toPreDefinedUnit = (optionId: string, inputId: string) => {
  return `${toPreDefinedPolicy(inputId)}${toAssetName(optionId)}`;
};

export const isPolicyPreDefined = (policyId: string) => {
  try {
    if (!hexToStr(policyId)) return false;
    return hexToStr(policyId).toString().startsWith('pd://');
  } catch (error: any) {
    console.error('isPolicyPreDefined error', error.message);
    return false;
  }
};

export const toUserDefinedPolicy = (inputId: string) => {
  const policy = `ud://${inputId}//`;
  const fill = Array((56 - policy?.length * 2) / 2)
    .fill('0')
    .join('');
  return strToHex(policy + fill);
};

export const toUserDefinedUnit = (optionId: string, inputId: string) => {
  return `${toUserDefinedPolicy(inputId)}${toAssetName(optionId)}`;
};

export const isPolicyUserDefined = (policyId: string) => {
  try {
    if (!hexToStr(policyId)) return false;
    return hexToStr(policyId).toString().startsWith('ud://');
  } catch (error: any) {
    console.error('isPolicyUserDefined error', error.message);
    return false;
  }
};

export const toPrecompileInputPolicy = (inputId: string) => {
  const policy = `pc://${inputId}//`;
  const fill = Array((56 - policy?.length * 2) / 2)
    .fill('0')
    .join('');
  return strToHex(policy + fill);
};

export const toPrecompileInputUnit = (campaignId: string, imageId: string) => {
  return `${toPrecompileInputPolicy(campaignId)}${toAssetName(imageId)}`;
};

export const isPolicyPreCompiled = (policyId: string) => {
  try {
    if (!hexToStr(policyId)) return false;
    return hexToStr(policyId).toString().startsWith('pc://');
  } catch (error: any) {
    console.error('isPolicyPreCompiled error', error.message);
    return false;
  }
};

export const toAssetName = (assetName: string) => {
  return strToHex(assetName);
};
