import { useCallback, useState } from 'react';
import { useWallet } from '@meshsdk/react';

type IUseProject = {
  activity: (forWallet: boolean) => Promise<any>;
  leaderboard: () => Promise<any>;
  isFetching: boolean;
};

/**
 * Velocity Tools Project Hook
 *
 *
 * @return   {Object}
 *           object with config, data and methods
 *
 * @property {()=>void} activity
 *           Check the activity for the currently connected wallet or the whole project
 *
 */

export const useProject = (): IUseProject => {
  const { wallet } = useWallet();

  const [isFetching, setIsFetching] = useState(true);

  const leaderboard = useCallback(async () => {
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set(
      'jetplane-api-key',
      process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
    );
    const res = await fetch(`${process.env.NEXT_PUBLIC_VELOCITY_API}/leaderboard`, {
      headers: requestHeaders,
    });
    const data = await res.json();
    return data;
  }, []);

  const activity = async (forWallet = false) => {
    const stakeKey = forWallet ? await wallet.getRewardAddresses() : null;
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set(
      'jetplane-api-key',
      process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
    );
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_VELOCITY_API}/activity${stakeKey ? `/${stakeKey[0]}` : ''
      }`,
      { headers: requestHeaders },
    );
    const data = await res.json();
    setIsFetching(false);
    return data;
  };

  return {
    activity,
    leaderboard,
    isFetching,
  };
};

useProject.PropTypes = {};

useProject.defaultProps = {};
