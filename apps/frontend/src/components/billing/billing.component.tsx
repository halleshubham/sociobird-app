'use client';

import { useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { MainBillingComponent } from './main.billing.component';
export const BillingComponent = () => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { isLoading: isLoadingSubscription, data: subscription } = useSWR(
    '/user/subscription',
    load
  );
  if (isLoadingSubscription) {
    return <LoadingComponent />;
  }
  // the free plan is not a paid subscription: show the plans as for no plan
  const current = subscription?.subscription;
  return (
    <MainBillingComponent
      sub={current?.subscriptionTier === 'FREEPLAN' ? undefined : current}
    />
  );
};
