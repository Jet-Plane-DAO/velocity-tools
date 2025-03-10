import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  UTXOStrategyType,
} from '../../helpers/tx';

type IUseSnapshotCampaign = {
  query: (limit: number, page: number, facet1?: string, facet2?: string, filter1?: string, filter2?: string, sortBy?: string, sortOrder?: string) => Promise<any>;
  state: () => Promise<any>;
  item: (itemId: string, limit?: number, page?: number) => Promise<any>;
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

  const query = async (limit: number = 100, page: number = 1, facet1?: string, facet2?: string, filter1?: string, filter2?: string, sortBy?: string, sortOrder?: string) => {
    // setStatus(SnapshotStatusEnum.CHECKING);
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set(
      'jetplane-api-key',
      process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
    );
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_VELOCITY_API}/campaign/${campaignKey || process.env.NEXT_PUBLIC_VELOCITY_SNAPSHOT_CAMPAIGN_NAME
      }/snapshot`,
      { headers: requestHeaders, method: 'post', body: JSON.stringify({ limit, page, facet1, facet2, filter1, filter2, sortBy, sortOrder }) },
    )
    const data = await res.json();
    if (res.status === 422) {
      return { status: 'error', message: data.message };
    }
    if (res.status === 200) {
      setSnapshotData(data);
      return { status: 'OK', quote: data };
    }
    return snapshot ? { status: 'OK', result: snapshot } : null;
  };

  const item = async (itemId: string, limit: number = 100, page: number = 1) => {
    // setStatus(SnapshotStatusEnum.CHECKING);
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set(
      'jetplane-api-key',
      process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
    );
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_VELOCITY_API}/campaign/${campaignKey || process.env.NEXT_PUBLIC_VELOCITY_SNAPSHOT_CAMPAIGN_NAME
      }/snapshot`,
      { headers: requestHeaders, method: 'post', body: JSON.stringify({ limit, page, itemId }) },
    )
    const data = await res.json();
    if (res.status === 422) {
      return { status: 'error', message: data.message };
    }
    if (res.status === 200) {
      setSnapshotData(data);
      return { status: 'OK', quote: data };
    }
    return snapshot ? { status: 'OK', result: snapshot } : null;
  };

  const state = async () => {
    // setStatus(SnapshotStatusEnum.CHECKING);
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set(
      'jetplane-api-key',
      process.env.NEXT_PUBLIC_VELOCITY_API_KEY ?? '',
    );
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_VELOCITY_API}/campaign/${campaignKey || process.env.NEXT_PUBLIC_VELOCITY_SNAPSHOT_CAMPAIGN_NAME
      }/snapshot`,
      { headers: requestHeaders, method: 'post', body: JSON.stringify({ state: true }) },
    )
    const data = await res.json();
    if (res.status === 422) {
      return { status: 'error', message: data.message };
    }
    if (res.status === 200) {
      setSnapshotData(data);
      return { status: 'OK', quote: data };
    }
    return snapshot ? { status: 'OK', result: snapshot } : null;
  };

  return {
    query,
    state,
    item,
    snapshot,
  };
};

useSnapshotCampaign.PropTypes = {
  campaignKey: PropTypes.string,
  strategy: UTXOStrategyType,
};

useSnapshotCampaign.defaultProps = {};
