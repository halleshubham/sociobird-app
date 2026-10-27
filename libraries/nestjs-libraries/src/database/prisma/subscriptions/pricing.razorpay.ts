// India-specific pricing (INR). Feature/channel limits stay driven by the
// shared `pricing` table (pricing.ts) - only the price itself differs here,
// since Razorpay bills in INR and the USD numbers don't translate directly.
export interface RazorpayPricingInner {
  month_price: number;
  year_price: number;
}

// Tiers without a price here (ULTIMATE, the Scale plan) are contact-us only,
// in every currency.
export const pricingINR: Record<
  'STANDARD' | 'TEAM' | 'PRO',
  RazorpayPricingInner
> = {
  STANDARD: { month_price: 399, year_price: 3830 },
  TEAM: { month_price: 899, year_price: 8630 },
  PRO: { month_price: 1799, year_price: 17270 },
};

export type RazorpayCurrency = 'INR' | 'USD';

// International pricing, now that Razorpay is activated for cross-border
// cards/banks.
export const pricingUSD: Record<'STANDARD' | 'TEAM' | 'PRO', RazorpayPricingInner> = {
  STANDARD: { month_price: 5, year_price: 48 },
  TEAM: { month_price: 11, year_price: 106 },
  PRO: { month_price: 21, year_price: 202 },
};

export function hasRazorpayPricing(
  billing: string,
  currency: RazorpayCurrency
): boolean {
  return billing in (currency === 'INR' ? pricingINR : pricingUSD);
}

export function getRazorpayPricing(
  billing: string,
  currency: RazorpayCurrency
): RazorpayPricingInner {
  if (!hasRazorpayPricing(billing, currency)) {
    throw new Error(`${billing} has no self-serve price - contact sales`);
  }
  return currency === 'INR'
    ? pricingINR[billing as keyof typeof pricingINR]
    : pricingUSD[billing as keyof typeof pricingUSD];
}

// One-time purchase, not a subscription plan - grants PRO with isLifetime.
export const LIFETIME_PRO_PRICE_INR = 24999;

// New-user signup offer: knocked off the first billing cycle only, for orgs
// that have never had a subscription (org.allowTrial - same flag that gates
// the free trial, and flips to false for good on first subscription created,
// so this can't be re-triggered by cancelling and resubscribing). Razorpay
// has no per-invoice discount API, so it starts the subscription on a
// separate discounted plan and schedules a change back to the full-price
// plan at cycle end. Not used with Razorpay any more (no new-user discount
// there); the percentage is still shown for Stripe's coupon.
export const NEW_USER_DISCOUNT_PERCENT = 20;
