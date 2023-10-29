export { useStakingCampaign, StakingStatusEnum } from './hooks/useStakingCampaign/';
export {
  useCraftingCampaign,
  CraftingStatusEnum,
} from './hooks/useCraftingCampaign';
export {
  useRecyclerCampaign,
  RecyclerStatusEnum,
} from './hooks/useRecyclerCampaign/';
export { useMintCampaign, MintStatusEnum } from './hooks/useMintCampaign/';
export { useProject } from './hooks/useProject/';

export const OFFCHAIN_POLICY_ID = Array(56).fill('0').join('');
