import { useCallback, useState } from 'react';
import { Transaction } from '@meshsdk/core';
import { useWallet } from '@meshsdk/react';
import { useCampaignAssets } from '../useCampaignAssets';
import PropTypes from 'prop-types';
import {
  UTXOStrategy,
  UTXOStrategyType,
  sendAssets,
  setAddressMetadata,
  submitTx,
} from '../../helpers/tx';
import { isPolicyOffChain } from '../../helpers/offchain';

type IUseRecyclerCampaign = {
  check: () => void;
  quote: (inputUnits: string[], recyclerUnits: string[]) => Promise<any>;
  recycle: (inputUnits: any[], recycleUnits: string[]) => Promise<any>;
  campaignConfig: any;
  recyclerData: any;
  availableBP: any;
  status: RecyclerStatusEnum;
};

export enum RecyclerStatusEnum {
  INIT = 'INIT',
  CHECKING = 'CHECKING',
  READY = 'READY',
  RECYCLING = 'RECYCLING',
  RECYCLE_PENDING = 'RECYCLE_PENDING',
}

/**
 * Velocity Tools Crafting Campaign Hook
 *
 *
 * @return   {Object}
 *           object with config, data and methods
 *
 * @property {Object} campaignConfig
 *           The configuration and metadata for the campaign
 *
 * @property {Object} craftingData
 *           The current crafting data for selected wallet, inlcuding locked assets, crafts and mints.
 *
 * @property {()=>void} check
 *           Check the status of the campaign and update the crafting data for the currently connected wallet
 *
 * @property {(planId: string, inputUnits: string[], concurrent: number)=>void} quote
 *           Fetches a quote for a craft transaction, returns the quote data, this includes the quantity, fee, token price, time to craft and any effective modifiers that are being applied.
 *
 * @property {(planId: string, input: any[], concurrent: number)=>void} craft
 *           Create a craft transaction to begin crafting an item, optionally if the plan has 0 time it will be claimed immediately, the claim fee must be included.
 *
 * @property {(craftId: string)=>void} claim
 *           Create a claim transaction for an existing craft
 *
 * @example
 *   const ExampleComponent = () => {
       const { check, craft, claim, campaignConfig, status, craftingData } = useCraftingCampaign();
 *
       useEffect(() => {
  *       check();
  *    }, []);
  *
 *     return (
 *       <>
 *
 *         <button onClick={() => craft('plan-1', []}>Craft items</button>
 *         <button onClick={() => quote('plan-1, [])}>Reset counter</button>
 *         <button onClick={decrement}>Decrement counter</button>
 *         <p>{count}</p>
 *       </>
 *      )
 *    }
 */

export const useRecyclerCampaign = (
  strategy: UTXOStrategy = UTXOStrategy.ISOLATED,
  campaignKey?: string
): IUseRecyclerCampaign => {
  const { availableBP } = useCampaignAssets();
  const [recyclerData, setRecyclerData] = useState<any | null>(null);
  const [status, setStatus] = useState<RecyclerStatusEnum>(RecyclerStatusEnum.INIT);
  const [campaignConfig, setConfigData] = useState<any | null>(null);
  const [quoteData, setQuoteData] = useState<any | null>(null);
  const { wallet, connected } = useWallet();

  const check = () => {
    if (!connected) {
      throw new Error('Wallet not connected');
    }
    setStatus(RecyclerStatusEnum.CHECKING);
    wallet.getRewardAddresses().then((addresses: any) => {
      const stakeKey = addresses[0];
      const requestHeaders: HeadersInit = new Headers();
      requestHeaders.set(
        'jetplane-api-key',
        process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
      );
      fetch(
        `${process.env.NEXT_PUBLIC_VELOCITY_API}/campaign/${campaignKey || process.env.NEXT_PUBLIC_VELOCITY_RECYCLER_CAMPAIGN_NAME
        }/check/${stakeKey}`,
        { headers: requestHeaders },
      ).then(async (res) => {
        if (res.status === 200) {
          const data = await res.json();
          setRecyclerData(data?.status || { recycles: [] });
          setConfigData(data.config);
          setStatus(RecyclerStatusEnum.READY);
        } else {
          const data = await res.json();
          setConfigData(data.config);
          setStatus(RecyclerStatusEnum.READY);
        }
        return;
      });
    });
  };

  const quote = async (inputUnits: string[], recycleUnits: string[] = []) => {
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set(
      'jetplane-api-key',
      process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
    );
    if (availableBP) {
      inputUnits.push(availableBP.unit);
    }
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_VELOCITY_API}/campaign/${campaignKey || process.env.NEXT_PUBLIC_VELOCITY_RECYCLER_CAMPAIGN_NAME
      }/quote`,
      {
        headers: requestHeaders,
        method: 'post',
        body: JSON.stringify({
          inputUnits,
          recycleUnits,
          type: 'recycler',
        }),
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

  const recycle = useCallback(
    async (selectedInputs: any[], recycleUnits: string[]) => {
      if (!connected) {
        throw new Error('Wallet not connected');
      }

      for (const i of selectedInputs) {
        if (!i?.policyId?.length || isPolicyOffChain(i.policyId)) continue;
        const input = campaignConfig?.inputs?.find(
          (x: any) => x.policyId === i.policyId,
        );
        if (!input) throw new Error('Input not found');
      }

      const quoteResponse = await quote(
        selectedInputs.map((i) => i.unit),
        recycleUnits,
      );
      if (!quoteResponse?.quote) throw new Error('Quote not found');

      const tx = new Transaction({ initiator: wallet });

      const nativeTokenAsset = campaignConfig.nativeTokenAsset; // getNativeTokenAsset(campaignConfig, craft.plan);

      await sendAssets(
        quoteResponse.quote.fee,
        quoteResponse.quote.price,
        quoteResponse.quote.assetsToInclude,
        tx,
        wallet,
        campaignConfig.walletAddress,
        nativeTokenAsset,
        strategy
      );

      tx.setMetadata(0, { t: 'recycle' });
      let ix = 1;

      selectedInputs.forEach((i) => {
        ix = setAddressMetadata(tx, ix, i.unit);
      });

      recycleUnits
        .filter((x) => isPolicyOffChain(x))
        .forEach((i) => {
          ix = setAddressMetadata(tx, ix, i);
        });

      if (availableBP) {
        ix = setAddressMetadata(tx, ix, availableBP.unit);
      }

      const hash = await submitTx(tx, wallet);
      return hash;
    },
    [availableBP, connected, wallet, status, campaignConfig],
  );

  return {
    check,
    recycle,
    campaignConfig,
    status,
    recyclerData,
    availableBP,
    quote,
  };
};

useRecyclerCampaign.PropTypes = {

  strategy: UTXOStrategyType,
  campaignKey: PropTypes.string,
};

useRecyclerCampaign.defaultProps = {};
