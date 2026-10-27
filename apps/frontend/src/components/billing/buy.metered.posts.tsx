'use client';

import { FC, useCallback, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { meteredPacks } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing.razorpay';

// Razorpay Checkout is loaded lazily, only when a pack is actually bought
const loadRazorpayCheckout = () =>
  new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export const useMeteredUsage = () => {
  const fetch = useFetch();
  return useSWR<{
    providers: string[];
    used: number;
    credits: number;
    planLimit: number;
    limit: number | null;
  }>('/posts/metered-usage', async () => {
    return (await fetch('/posts/metered-usage')).json();
  });
};

export const BuyMeteredPosts: FC<{ currency: 'INR' | 'USD' }> = ({
  currency,
}) => {
  const fetch = useFetch();
  const t = useT();
  const toast = useToaster();
  const user = useUser();
  const { razorpayKeyId, isGeneral } = useVariables();
  const { data, mutate } = useMeteredUsage();
  const [loading, setLoading] = useState('');

  const buy = useCallback(
    (pack: string) => async () => {
      setLoading(pack);
      const response = await fetch('/billing/metered/razorpay/order', {
        method: 'POST',
        body: JSON.stringify({ pack, currency }),
      });
      const { orderId, amount, message } = await response
        .json()
        .catch(() => ({}));
      if (!response.ok || !orderId) {
        toast.show(
          message || 'Could not start the purchase, please try again',
          'warning'
        );
        setLoading('');
        return;
      }

      if (!(await loadRazorpayCheckout())) {
        toast.show('Could not load the payment form, please try again', 'warning');
        setLoading('');
        return;
      }

      const checkout = new (window as any).Razorpay({
        key: razorpayKeyId,
        order_id: orderId,
        amount,
        currency,
        name: isGeneral ? 'Postiz' : 'SocioBird',
        description: `${meteredPacks[pack].units} X posts`,
        prefill: { email: user?.email },
        handler: async (payment: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const { success } = await (
            await fetch('/billing/metered/razorpay/verify', {
              method: 'POST',
              body: JSON.stringify(payment),
            })
          ).json();
          if (success) {
            await mutate();
            toast.show(
              t(
                'metered_posts_added',
                'X posts added, they are valid until the end of this month'
              )
            );
          } else {
            toast.show(
              'Payment received but could not confirm automatically, please contact support',
              'warning'
            );
          }
          setLoading('');
        },
        modal: { ondismiss: () => setLoading('') },
      });
      checkout.open();
    },
    [currency, razorpayKeyId]
  );

  // no limit, or a plan without these posts: nothing to buy
  if (!data?.providers?.length || data.limit === null || !data.planLimit) {
    return null;
  }

  const symbol = currency === 'INR' ? '₹' : '$';
  return (
    <div className="flex flex-col gap-[8px]">
      <div className="text-[14px] opacity-80">
        {t('metered_usage_this_month', 'X (Twitter) posts this month:')}{' '}
        {data.used} {t('metered_posts_of', 'of')} {data.limit}
        {data.credits > 0 && ` (${data.credits} ${t('metered_posts_bought', 'bought')})`}
        . {t('metered_posts_expire', 'Bought posts expire at the end of the month.')}
      </div>
      <div className="flex gap-[8px] flex-wrap">
        {Object.entries(meteredPacks).map(([id, pack]) => (
          <Button key={id} loading={loading === id} onClick={buy(id)}>
            {pack.units} {t('metered_posts_label', 'X posts')} {symbol}
            {currency === 'INR' ? pack.inr : pack.usd}
          </Button>
        ))}
      </div>
    </div>
  );
};
