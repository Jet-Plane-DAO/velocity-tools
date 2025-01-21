import { useCallback, useState } from 'react';
import { Transaction } from '@meshsdk/core';
import { useWallet } from '@meshsdk/react';
import { useCampaignAssets } from '../useCampaignAssets';
import PropTypes from 'prop-types';
import {
  UTXOStrategy,
  UTXOStrategyType,
  logConfig,
  logDebugMessage,
  noAssetsAdaAmount,
  sendAssets,
  setAddressMetadata,
  submitTx,
  validatePlan,
} from '../../helpers/tx';
import { fetchCheck, fetchQuote } from '../../helpers/quote';

type IUseCompileCampaign = {
  check: (includeItems?: boolean) => void;
  compile: (
    planId: string,
    input: any[],
    concurrent?: number,
    tokenSplit?: number,
    overridStrategy?: UTXOStrategy,
  ) => Promise<string>;
  quote: (
    planId: string,
    inputUnits: string[],
    concurrent: number,
    tokenSplit?: number,
  ) => Promise<any>;
  campaignConfig: any;
  craftingData: any;
  availableBP: any;
  status: CompileStatusEnum;
  setUserDefinedInput: (
    inputId: string,
    planId: string,
    content: any,
    file?: File,
  ) => Promise<{ id: string; content: string; createdAt: string }>;
};

export enum CompileStatusEnum {
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
 *           Fetches a quote for a complile transaction, returns the quote data, this includes the quantity, fee, token price and any effective modifiers that are being applied.
 *
 * @property {(planId: string, input: any[], concurrent: number)=>void} compile
 *           Create a craft transaction to begin crafting an item, optionally if the plan has 0 time it will be claimed immediately, the claim fee must be included.
 *
 * @property {(input: any, content: any, file?: File)=>void} setUserDefinedInput
 *           A method to upload an image or text for campaigns with user defined inputs.
 *
 * @example
 *   const ExampleComponent = () => {
 *      const { check, craft, claim, campaignConfig, status, craftingData } = useCraftingCampaign();
 *
 *      useEffect(() => {
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

export const useCompileCampaign = (
  campaignKey?: string,
  tag?: string,
  strategy: UTXOStrategy = UTXOStrategy.ISOLATED,
): IUseCompileCampaign => {
  const { craftingData, setCraftingData, availableBP } = useCampaignAssets();
  const [status, setStatus] = useState<CompileStatusEnum>(CompileStatusEnum.INIT);
  const [campaignConfig, setConfigData] = useState<any | null>(null);
  const { wallet, connected } = useWallet();

  const check = async (includeItems?: boolean) => {
    if (!connected) {
      throw new Error('Wallet not connected');
    }
    if (!wallet) return;
    logDebugMessage(`Checking campaign ${campaignKey}`);
    setStatus(CompileStatusEnum.CHECKING);
    const addresses = await wallet.getRewardAddresses();
    const stakeKey = addresses[0];
    const quote = await fetchCheck(stakeKey, includeItems, campaignKey, tag);
    setCraftingData(quote?.status || { mints: [] });
    setConfigData(quote.config);
    setStatus(CompileStatusEnum.READY);
    return;
  };

  const quote = async (
    planId: string,
    inputUnits: string[],
    concurrent: number = 1,
    tokenSplit: number = 0,
  ) => {
    return await fetchQuote(
      planId,
      inputUnits,
      concurrent,
      'compile',
      availableBP,
      campaignKey,
      tokenSplit,
    );
  };

  const compile = useCallback(
    async (
      planId: string,
      selectedInputs: any[],
      concurrent: number = 1,
      tokenSplit: number = 0,
      overridStrategy?: UTXOStrategy,
    ) => {
      logConfig({
        campaignConfig,
        craftingData,
        availableBP,
        connected,
        status,
      });

      const plan = validatePlan(connected, campaignConfig, planId, selectedInputs);

      if (!plan) {
        throw new Error('Plan not valid');
      }

      const quoteResponse = await quote(
        planId,
        selectedInputs.map((i) => i.unit),
        concurrent,
        tokenSplit,
      );
      if (!quoteResponse?.quote) throw new Error('Quote not found');

      const tx = new Transaction({ initiator: wallet });

      const currency = quoteResponse?.quote?.currency || 'lovelace';

      await sendAssets(
        quoteResponse.quote.time === 0
          ? quoteResponse.quote.fee
          : noAssetsAdaAmount(quoteResponse.quote),
        quoteResponse.quote.price,
        (quoteResponse.quote.assetsToInclude || []).map((x: any) => x.asset),
        tx,
        wallet,
        campaignConfig.walletAddress,
        currency,
        overridStrategy ?? strategy,
      );

      tx.setMetadata(0, {
        t: 'compile',
        p: planId,
        c: concurrent,
        s: `${tokenSplit}`,
      });

      let ix = 1;
      selectedInputs.forEach((i) => {
        ix = setAddressMetadata(tx, ix, i.unit);
      });
      if (availableBP) {
        ix = setAddressMetadata(tx, ix, availableBP.unit);
      }

      const hash = await submitTx(tx, wallet);

      return hash;
    },
    [availableBP, connected, wallet, status, campaignConfig],
  );

  const setUserDefinedInput = async (
    inputId: string,
    planId: string,
    content: any,
    file?: File,
  ) => {
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set(
      'jetplane-api-key',
      process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
    );

    const formData = new FormData();
    formData.append('inputId', inputId);
    formData.append('planId', planId);
    formData.append('content', JSON.stringify(content));
    if (file) formData.append('file', file);

    const result = await fetch(
      `${process.env.NEXT_PUBLIC_VELOCITY_API}/campaign/${
        campaignKey || process.env.NEXT_PUBLIC_VELOCITY_MINTING_CAMPAIGN_NAME
      }/setUserDefinedInput`,
      { headers: requestHeaders, method: 'post', body: formData },
    );

    const data: any = await result.json();
    return data;
  };

  return {
    check,
    compile,
    campaignConfig,
    status,
    craftingData,
    availableBP,
    quote,
    setUserDefinedInput,
  };
};

useCompileCampaign.PropTypes = {
  campaignKey: PropTypes.string,
  tag: PropTypes.string,
  strategy: UTXOStrategyType,
};

useCompileCampaign.defaultProps = {};
