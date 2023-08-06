import { useCallback, useState } from 'react';

import { LOVELACE_MULTIPLIER } from '../../helpers/ada';
import PropTypes from 'prop-types';

type IUseCraftingCampaign = {
  check: (wallet: any) => void;
  craft: (
    wallet: any,
    planId: string,
    input: any[],
    largestFirstMultiAsset: any,
  ) => void;
  claim: (wallet: any, craftId: string) => void;
  quote: (planId: string, inputUnits: string[]) => Promise<any>;
  campaignConfig: any;
  craftingData: any;
  status: CraftingStatusEnum;
};

export enum CraftingStatusEnum {
  INIT = 'INIT',
  CHECKING = 'CHECKING',
  READY = 'READY',
  CRAFTING = 'CRAFTING',
  CRAFTING_PENDING = 'CRAFTING_PENDING',
  CLAIMING = 'CLAIMING',
  CLAIM_PENDING = 'CLAIM_PENDING',
}

/**
 * Classic counter example to help understand the flow of this npm package
 *
 *
 * @return   {Object}
 *           object with config, data and methods
 *
 * @property {number} campaignConfig
 *           The current count state
 *
 * @property {()=>void} claim
 *           the increment function
 *
 * @property {()=>void} craft
 *           the decrement function
 *
 * @property {()=>void} check
 *           the reset function
 *
 * @example
 *   const ExampleComponent = () => {
 *     const { count, increment, reset, decrement } = useCounter();
 *
 *     return (
 *       <>
 *         <button onClick={increment}>Increment counter</button>
 *         <button onClick={reset}>Reset counter</button>
 *         <button onClick={decrement}>Decrement counter</button>
 *         <p>{count}</p>
 *       </>
 *      )
 *    }
 */

export const useCraftingCampaign = (Transaction: any): IUseCraftingCampaign => {
  const [craftingData, setCraftingData] = useState(null);
  const [status, setStatus] = useState<CraftingStatusEnum>(CraftingStatusEnum.INIT);
  const [campaignConfig, setConfigData] = useState<any | null>(null);
  const [quoteData, setQuoteData] = useState<any | null>(null);
  const check = useCallback((wallet: any) => {
    if (status === CraftingStatusEnum.INIT) {
      setStatus(CraftingStatusEnum.CHECKING);
      wallet.getRewardAddresses().then((addresses: any) => {
        const stakeKey = addresses[0];
        const requestHeaders: HeadersInit = new Headers();
        requestHeaders.set(
          'jetplane-api-key',
          process.env.NEXT_PUBLIC_LAUNCH_API_KEY ?? '',
        );
        fetch(
          `${process.env.NEXT_PUBLIC_LAUNCH_API}/campaign/${process.env.NEXT_PUBLIC_LAUNCH_CRAFTING_CAMPAIGN_NAME}/check/${stakeKey}`,
          { headers: requestHeaders },
        ).then(async (res) => {
          if (res.status === 200) {
            const data = await res.json();
            setCraftingData(data.status);
            setConfigData(data.config);
            setStatus(CraftingStatusEnum.READY);
          } else {
            const data = await res.json();
            setConfigData(data.config);
            setStatus(CraftingStatusEnum.READY);
          }
          return;
        });
      });
    }
  }, []);

  const quote = async (planId: string, inputUnits: string[]) => {
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set(
      'jetplane-api-key',
      process.env.NEXT_PUBLIC_LAUNCH_API_KEY ?? '',
    );
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_LAUNCH_API}/campaign/${process.env.NEXT_PUBLIC_LAUNCH_CRAFTING_CAMPAIGN_NAME}/quote`,
      {
        headers: requestHeaders,
        method: 'post',
        body: JSON.stringify({ inputUnits, planId, type: 'craft' }),
      },
    );
    const data = await res.json();
    if (res.status === 422) {
      return { status: 'error', message: data.message };
    }
    if (res.status === 200) {
      setQuoteData(data);
      return { status: 'OK', quote: data };
    }
    return quoteData ? { status: 'OK', quote: quoteData } : null;
  };

  const craft = useCallback(
    async (
      wallet: any,
      planId: string,
      selectedInputs: any[],
      largestFirstMultiAsset: any,
    ) => {
      const plan = campaignConfig!.plans.find((p: any) => p.id === planId);
      if (!plan) throw new Error('Plan not found');

      for (const i of selectedInputs) {
        const input = campaignConfig!.inputs.find(
          (x: any) => x.policyId === i.policyId,
        );
        if (!input) throw new Error('Input not found');
      }

      const quoteData = await quote(
        planId,
        selectedInputs.map((i) => i.unit),
      );
      if (!quoteData?.quote) throw new Error('Quote not found');

      const utxos = await wallet.getUtxos();

      const assetMap = new Map();
      assetMap.set(campaignConfig.tokenAssetName, `${quoteData.quote.price}`);
      const selectedUtxos = largestFirstMultiAsset(assetMap, utxos, true);

      const tx = new Transaction({ initiator: wallet })
        .setTxInputs(selectedUtxos)
        .sendAssets({ address: campaignConfig.walletAddress }, [
          {
            unit: campaignConfig.tokenAssetName,
            quantity: `${quoteData.quote.price}`,
          },
        ])
        .setMetadata(0, 'craft')
        .setMetadata(0, planId);

      let ix = 1;
      selectedInputs.forEach((i) => {
        if (i.unit.length > 64) {
          tx.setMetadata(ix, i.unit.slice(0, 56));
          ix += 1;
          tx.setMetadata(ix, i.unit.slice(56 + 1));
          ix += 1;
        } else {
          tx.setMetadata(ix, i.unit);
          ix += 1;
        }
      });

      const unsignedTx = await tx.build();
      const signedTx = await wallet.signTx(unsignedTx);
      await wallet.submitTx(signedTx);
      return;
    },
    [status, campaignConfig],
  );

  const claim = useCallback(
    async (wallet: any, craftId: string) => {
      if (status !== CraftingStatusEnum.READY) return;
      setStatus(CraftingStatusEnum.CLAIMING);
      const tx = new Transaction({ initiator: wallet }).sendLovelace(
        campaignConfig.walletAddress,
        `${campaignConfig.claimFee * LOVELACE_MULTIPLIER}`,
      );
      const unsignedTx = await tx.build();
      const signedTx = await wallet.signTx(unsignedTx);
      await wallet.submitTx(signedTx);

      setStatus(CraftingStatusEnum.CLAIM_PENDING);
      return craftId;
    },
    [status, campaignConfig],
  );

  return { check, craft, claim, campaignConfig, status, craftingData, quote };
};

useCraftingCampaign.PropTypes = {
  Transaction: PropTypes.object.isRequired,
};

useCraftingCampaign.defaultProps = {};
