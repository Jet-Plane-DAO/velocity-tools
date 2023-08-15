import { useCallback, useState } from 'react';

import { LOVELACE_MULTIPLIER } from '../../helpers/ada';
import PropTypes from 'prop-types';

type IUseStakingCampaign = {
  check: (wallet: any) => void;
  register: (wallet: any) => void;
  claim: (wallet: any) => void;
  campaignConfig: any;
  stakingData: any;
  status: StakingStatusEnum;
};

export enum StakingStatusEnum {
  STAKED = 'STAKED',
  UNSTAKED = 'UNSTAKED',
  INIT = 'INIT',
  CHECKING = 'CHECKING',
  REGISTERING = 'REGISTERING',
  REGISTRATION_PENDING = 'REGISTRATION_PENDING',
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
 * @property {()=>void} register
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

export const useStakingCampaign = (Transaction: any): IUseStakingCampaign => {
  const [stakingData, setStakingData] = useState(null);
  const [status, setStatus] = useState<StakingStatusEnum>(StakingStatusEnum.INIT);
  const [campaignConfig, setConfigData] = useState<any | null>(null);

  const check = useCallback((wallet: any) => {
    if (status === StakingStatusEnum.INIT) {
      setStatus(StakingStatusEnum.CHECKING);
      wallet.getRewardAddresses().then((addresses: any) => {
        const stakeKey = addresses[0];
        const requestHeaders: HeadersInit = new Headers();
        requestHeaders.set(
          'jetplane-api-key',
          process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
        );
        fetch(
          `${process.env.NEXT_PUBLIC_VELOCITY_API}/campaign/${process.env.NEXT_PUBLIC_VELOCITY_STAKING_CAMPAIGN_NAME}/check/${stakeKey}`,
          { headers: requestHeaders },
        ).then(async (res) => {
          if (res.status === 200) {
            const data = await res.json();
            setStakingData(data.status);
            setConfigData(data.config);
            setStatus(StakingStatusEnum.STAKED);
          } else {
            const data = await res.json();
            setConfigData(data.config);
            setStatus(StakingStatusEnum.UNSTAKED);
          }
          return;
        });
      });
    }
  }, []);

  const register = useCallback(
    async (wallet: any) => {
      if (status !== StakingStatusEnum.UNSTAKED) return;
      setStatus(StakingStatusEnum.REGISTERING);

      const tx = new Transaction({ initiator: wallet }).sendLovelace(
        campaignConfig!.walletAddress,
        `${campaignConfig!.registrationFee}`,
      );
      const unsignedTx = await tx.build();
      const signedTx = await wallet.signTx(unsignedTx);
      await wallet.submitTx(signedTx);
      setStatus(StakingStatusEnum.REGISTRATION_PENDING);
      return;
    },
    [status, campaignConfig],
  );

  const claim = useCallback(
    async (wallet: any) => {
      if (status !== StakingStatusEnum.STAKED) return;
      setStatus(StakingStatusEnum.CLAIMING);
      const tx = new Transaction({ initiator: wallet }).sendLovelace(
        campaignConfig.walletAddress,
        `${campaignConfig.claimFee * LOVELACE_MULTIPLIER}`,
      );
      const unsignedTx = await tx.build();
      const signedTx = await wallet.signTx(unsignedTx);
      await wallet.submitTx(signedTx);

      setStatus(StakingStatusEnum.CLAIM_PENDING);
      return;
    },
    [status, campaignConfig],
  );

  return { check, register, claim, campaignConfig, status, stakingData };
};

useStakingCampaign.PropTypes = {
  Transaction: PropTypes.object.isRequired,
};

useStakingCampaign.defaultProps = {};
