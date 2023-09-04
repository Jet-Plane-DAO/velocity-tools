import { useCallback, useState } from 'react';
import { Transaction, keepRelevant } from '@meshsdk/core';
import { useWallet } from '@meshsdk/react';
import { LOVELACE_MULTIPLIER } from '../../helpers/ada';
import { useCampaignAssets } from '../useCampaignAssets';

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

export const useRecyclerCampaign = (): IUseRecyclerCampaign => {
  const { availableBP } = useCampaignAssets();
  const [recyclerData, setRecyclerData] = useState<any | null>(null);
  const [status, setStatus] = useState<RecyclerStatusEnum>(RecyclerStatusEnum.INIT);
  const [campaignConfig, setConfigData] = useState<any | null>(null);
  const [quoteData, setQuoteData] = useState<any | null>(null);
  const { wallet, connected } = useWallet();

  const check = useCallback(() => {
    if (!connected) {
      throw new Error('Wallet not connected');
    }
    if (status === RecyclerStatusEnum.INIT) {
      setStatus(RecyclerStatusEnum.CHECKING);
      wallet.getRewardAddresses().then((addresses: any) => {
        const stakeKey = addresses[0];
        const requestHeaders: HeadersInit = new Headers();
        requestHeaders.set(
          'jetplane-api-key',
          process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
        );
        fetch(
          `${process.env.NEXT_PUBLIC_VELOCITY_API}/campaign/${process.env.NEXT_PUBLIC_VELOCITY_RECYCLER_CAMPAIGN_NAME}/check/${stakeKey}`,
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
    }
  }, [connected, wallet]);

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
      `${process.env.NEXT_PUBLIC_VELOCITY_API}/campaign/${process.env.NEXT_PUBLIC_VELOCITY_RECYCLER_CAMPAIGN_NAME}/quote`,
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
        const input = campaignConfig!.inputs.find(
          (x: any) => x.policyId === i.policyId,
        );
        if (!input) throw new Error('Input not found');
      }

      const quoteResponse = await quote(
        selectedInputs.map((i) => i.unit),
        recycleUnits,
      );
      if (!quoteResponse?.quote) throw new Error('Quote not found');

      const utxos = await wallet.getUtxos();

      const sendingToken = quoteResponse.quote.price !== 0;
      const sendingAda = quoteResponse.quote.time === 0;

      const assetMap = new Map();
      if (sendingAda) {
        assetMap.set('lovelace', `${quoteResponse.quote.fee * LOVELACE_MULTIPLIER}`);
      }
      if (sendingToken) {
        assetMap.set(campaignConfig.tokenAssetName, `${quoteResponse.quote.price}`);
      }
      for (const unit of recycleUnits) {
        assetMap.set(unit, `${1}`);
      }

      const relevant = keepRelevant(
        assetMap,
        utxos,
        sendingAda ? `${quoteResponse.quote.fee * LOVELACE_MULTIPLIER}` : '5000000',
      );

      const tx = new Transaction({ initiator: wallet }).setTxInputs(
        relevant.length ? relevant : utxos,
      );

      if (sendingAda) {
        tx.sendLovelace(
          { address: campaignConfig.walletAddress },
          `${quoteResponse.quote.fee * LOVELACE_MULTIPLIER}`,
        );
      }
      if (sendingToken) {
        tx.sendAssets({ address: campaignConfig.walletAddress }, [
          {
            unit: campaignConfig.tokenAssetName,
            quantity: `${quoteResponse.quote.price}`,
          },
        ]);
      }

      tx.sendAssets(
        { address: campaignConfig.walletAddress },
        recycleUnits.map((unit) => ({ unit, quantity: '1' })),
      );

      tx.setMetadata(0, { t: 'recycle' });
      let ix = 1;
      selectedInputs.forEach((i) => {
        if (i.unit.length > 64) {
          tx.setMetadata(ix, i.unit.slice(0, 56));
          ix += 1;
          tx.setMetadata(ix, i.unit.slice(56));
          ix += 1;
        } else {
          tx.setMetadata(ix, i.unit);
          ix += 1;
        }
      });
      if (availableBP) {
        tx.setMetadata(ix, availableBP.unit.slice(0, 56));
        ix += 1;
        tx.setMetadata(ix, availableBP.unit.slice(56));
        ix += 1;
      }
      const unsignedTx = await tx.build();
      const signedTx = await wallet.signTx(unsignedTx);
      const hash = await wallet.submitTx(signedTx);
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

useRecyclerCampaign.PropTypes = {};

useRecyclerCampaign.defaultProps = {};
