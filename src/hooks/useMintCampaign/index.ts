import { useCallback, useState } from 'react';
import { Transaction, keepRelevant } from '@meshsdk/core';
import { useWallet } from '@meshsdk/react';
import { LOVELACE_MULTIPLIER } from '../../helpers/ada';
import { useCampaignAssets } from '../useCampaignAssets';
import PropTypes from 'prop-types';

type IUseMintCampaign = {
  check: () => void;
  mint: (planId: string, input: any[], concurrent: number) => void;
  quote: (planId: string, inputUnits: string[], concurrent: number) => Promise<any>;
  campaignConfig: any;
  craftingData: any;
  availableBP: any;
  status: MintStatusEnum;
};

export enum MintStatusEnum {
  INIT = 'INIT',
  CHECKING = 'CHECKING',
  READY = 'READY',
  CRAFTING = 'CRAFTING',
  CRAFTING_PENDING = 'CRAFTING_PENDING',
  CLAIMING = 'CLAIMING',
  CLAIM_PENDING = 'CLAIM_PENDING',
  UPGRADING = 'UPGRADING',
  UPGRADE_PENDING = 'UPGRADE_PENDING',
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

export const useMintCampaign = (campaignKey?: string): IUseMintCampaign => {
  const { craftingData, setCraftingData, availableBP } = useCampaignAssets();
  const [status, setStatus] = useState<MintStatusEnum>(MintStatusEnum.INIT);
  const [campaignConfig, setConfigData] = useState<any | null>(null);
  const [quoteData, setQuoteData] = useState<any | null>(null);
  const { wallet, connected } = useWallet();

  const check = useCallback(() => {
    if (!connected) {
      throw new Error('Wallet not connected');
    }
    if (status === MintStatusEnum.INIT) {
      setStatus(MintStatusEnum.CHECKING);
      wallet.getRewardAddresses().then((addresses: any) => {
        const stakeKey = addresses[0];
        const requestHeaders: HeadersInit = new Headers();
        requestHeaders.set(
          'jetplane-api-key',
          process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
        );
        fetch(
          `${process.env.NEXT_PUBLIC_VELOCITY_API}/campaign/${
            campaignKey || process.env.NEXT_PUBLIC_VELOCITY_CRAFTING_CAMPAIGN_NAME
          }/check/${stakeKey}`,
          { headers: requestHeaders },
        ).then(async (res) => {
          if (res.status === 200) {
            const data = await res.json();
            setCraftingData(data?.status || { crafts: [], mints: [], locked: [] });
            setConfigData(data.config);
            setStatus(MintStatusEnum.READY);
          } else {
            const data = await res.json();
            setConfigData(data.config);
            setStatus(MintStatusEnum.READY);
          }
          return;
        });
      });
    }
  }, [connected, wallet]);

  const quote = async (
    planId: string,
    inputUnits: string[],
    concurrent: number = 1,
  ) => {
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set(
      'jetplane-api-key',
      process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
    );
    if (availableBP) {
      inputUnits.push(availableBP.unit);
    }
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_VELOCITY_API}/campaign/${
        campaignKey || process.env.NEXT_PUBLIC_VELOCITY_CRAFTING_CAMPAIGN_NAME
      }/quote`,
      {
        headers: requestHeaders,
        method: 'post',
        body: JSON.stringify({
          inputUnits,
          planId,
          type: 'craft',
          concurrent,
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

  const mint = useCallback(
    async (planId: string, selectedInputs: any[], concurrent: number = 1) => {
      if (!connected) {
        throw new Error('Wallet not connected');
      }
      const plan = campaignConfig!.plans.find((p: any) => p.id === planId);
      if (!plan) throw new Error('Plan not found');

      for (const i of selectedInputs) {
        const input = campaignConfig!.inputs.find(
          (x: any) => x.policyId === i.policyId,
        );
        if (!input) throw new Error('Input not found');
      }

      const quoteResponse = await quote(
        planId,
        selectedInputs.map((i) => i.unit),
        concurrent,
      );
      if (!quoteResponse?.quote) throw new Error('Quote not found');

      const utxos = await wallet.getUtxos();

      const sendingToken = quoteResponse.quote.price !== 0;
      const sendingAda = quoteResponse.quote.time === 0;

      const assetMap = new Map();
      assetMap.set(
        'lovelace',
        `${quoteResponse.quote.fee * LOVELACE_MULTIPLIER + 2 * LOVELACE_MULTIPLIER}`,
      );

      if (sendingToken) {
        assetMap.set(campaignConfig.tokenAssetName, `${quoteResponse.quote.price}`);
      }

      const relevant = keepRelevant(
        assetMap,
        utxos,
        `${quoteResponse.quote.fee * LOVELACE_MULTIPLIER + 2 * LOVELACE_MULTIPLIER}`,
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

      tx.setMetadata(0, { t: 'mint', p: planId, c: concurrent });
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
    mint,
    campaignConfig,
    status,
    craftingData,
    availableBP,
    quote,
  };
};

useMintCampaign.PropTypes = {
  campaignKey: PropTypes.string,
};

useMintCampaign.defaultProps = {};
