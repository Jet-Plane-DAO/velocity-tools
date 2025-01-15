import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  UTXOStrategyType,
} from '../../helpers/tx';

type IUseSnapshotCampaign = {
  query: (limit: number, page: number, facet1?: string, facet2?: string, facet3?: string, sortBy?: string) => Promise<any>;
  snapshot: any;
};

export enum SnapshotStatusEnum {
  INIT = 'INIT',
  CHECKING = 'CHECKING',
  READY = 'READY',
  RECYCLING = 'RECYCLING',
  RECYCLE_PENDING = 'RECYCLE_PENDING',
}

export const useSnapshotCampaign = (
  campaignKey?: string
): IUseSnapshotCampaign => {
  // const [status, setStatus] = useState<SnapshotStatusEnum>(SnapshotStatusEnum.INIT);
  const [snapshot, setSnapshotData] = useState<any | null>(null);
  // const { wallet, connected } = useWallet();

  const query = async (limit: number = 100, page: number = 1, facet1?: string, facet2?: string, facet3?: string, sortBy?: string) => {
    // setStatus(SnapshotStatusEnum.CHECKING);
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set(
      'jetplane-api-key',
      process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
    );
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_VELOCITY_API}/campaign/${campaignKey || process.env.NEXT_PUBLIC_VELOCITY_SNAPSHOT_CAMPAIGN_NAME
      }/snapshot`,
      { headers: requestHeaders, method: 'post', body: JSON.stringify({ limit, page, facet1, facet2, facet3, sortBy }) },
    )
    const data = await res.json();
    if (res.status === 422) {
      return { status: 'error', message: data.message };
    }
    if (res.status === 200) {
      setSnapshotData(data);
      return { status: 'OK', quote: data };
    }
    return snapshot ? { status: 'OK', quote: snapshot } : null;
  };

  return {
    query,
    snapshot,
  };
};

useSnapshotCampaign.PropTypes = {
  campaignKey: PropTypes.string,
  strategy: UTXOStrategyType,
};

useSnapshotCampaign.defaultProps = {};
