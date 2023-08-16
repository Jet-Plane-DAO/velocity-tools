import { useAssets } from '@meshsdk/react';
import { useEffect, useState } from 'react';

const boardingPassPolicy =
  'd27ed993038c15706d6d403a65bf377163f30d2b989c075bf901d540';

type IUseCampaignAssets = {
  availableBP: any;
  boardingPasses: any[];
  craftingData: any;
  setCraftingData: any;
};

export const useCampaignAssets = (): IUseCampaignAssets => {
  const [availableBP, setAvailableBP] = useState<any | null>(null);
  const [boardingPasses, setBoardingPasses] = useState<any | null>(null);
  const [craftingData, setCraftingData] = useState<any | null>(null);
  const assets = useAssets();

  useEffect(() => {
    if (craftingData && assets?.length) {
      const locked = craftingData?.locked || [];
      setBoardingPasses(
        assets
          .filter((a) => a.unit.includes(boardingPassPolicy))
          .filter((b) => !locked.map((x: any) => x.unit).includes(b.unit)) || [],
      );
    }
  }, [assets, craftingData]);

  useEffect(() => {
    if (boardingPasses?.length) {
      setAvailableBP(boardingPasses.pop());
    }
  }, [boardingPasses]);

  return {
    availableBP,
    boardingPasses,
    craftingData,
    setCraftingData,
  };
};

useCampaignAssets.PropTypes = {};

useCampaignAssets.defaultProps = {};
