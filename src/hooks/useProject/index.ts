import { useCallback } from 'react';
import { useWallet } from '@meshsdk/react';

type IUseProject = {
  activity: (forWallet: boolean) => Promise<any>;
  leaderboard: () => Promise<any>;
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
  const { wallet, connected } = useWallet();

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

  const activity = useCallback(
    async (forWallet = false) => {
      const stakeKey = forWallet ? await wallet.getRewardAddresses() : null;
      const requestHeaders: HeadersInit = new Headers();
      requestHeaders.set(
        'jetplane-api-key',
        process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
      );
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_VELOCITY_API}/activity${
          stakeKey ? `/${stakeKey[0]}` : ''
        }`,
        { headers: requestHeaders },
      );
      const data = await res.json();
      return data;
    },
    [connected, wallet],
  );

  return {
    activity,
    leaderboard,
  };
};

useProject.PropTypes = {};

useProject.defaultProps = {};
