import { HttpException, Injectable } from '@nestjs/common';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { SubscriptionRepository } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.repository';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { Organization } from '@prisma/client';
import dayjs from 'dayjs';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly _subscriptionRepository: SubscriptionRepository,
    private readonly _integrationService: IntegrationService,
    private readonly _organizationService: OrganizationService
  ) {}

  getSubscriptionByOrganizationId(organizationId: string) {
    return this._subscriptionRepository.getSubscriptionByOrganizationId(
      organizationId
    );
  }

  useCredit<T>(
    organization: Organization,
    type = 'ai_images',
    func: () => Promise<T>
  ): Promise<T> {
    return this._subscriptionRepository.useCredit(organization, type, func);
  }

  getCode(code: string) {
    return this._subscriptionRepository.getCode(code);
  }

  // Customer-keyed flows must never touch a subscription owned by another provider
  private async isManagedBy(customerId: string, provider: string) {
    const current =
      await this._subscriptionRepository.getSubscriptionByCustomerId(
        customerId
      );
    return !current || current.provider === provider;
  }

  async deleteSubscription(customerId: string, provider: string) {
    if (!(await this.isManagedBy(customerId, provider))) {
      return { count: 0 };
    }
    await this.modifySubscription(
      customerId,
      pricing.FREE.channel || 0,
      'FREE'
    );
    return this._subscriptionRepository.deleteSubscriptionByCustomerId(
      customerId,
      provider
    );
  }

  // Store-managed subscriptions (RevenueCat etc.) have no Stripe customer, they are keyed by org
  async deleteSubscriptionByOrgId(organizationId: string, provider: string) {
    const current = await this._subscriptionRepository.getSubscriptionByOrgId(
      organizationId
    );
    if (!current || current.provider !== provider || current.isLifetime) {
      return false;
    }

    await this.modifySubscriptionByOrg(
      organizationId,
      pricing.FREE.channel || 0,
      'FREE'
    );
    return this._subscriptionRepository.deleteSubscriptionByOrgId(
      organizationId,
      provider
    );
  }

  updateCustomerId(organizationId: string, customerId: string) {
    return this._subscriptionRepository.updateCustomerId(
      organizationId,
      customerId
    );
  }

  async checkSubscription(organizationId: string, subscriptionId: string) {
    return await this._subscriptionRepository.checkSubscription(
      organizationId,
      subscriptionId
    );
  }

  async modifySubscriptionByOrg(
    organizationId: string,
    totalChannels: number,
    billing: 'FREE' | 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE'
  ) {
    if (!organizationId) {
      return false;
    }

    const getCurrentSubscription =
      (await this._subscriptionRepository.getSubscriptionByOrgId(
        organizationId
      ))!;

    const from = pricing[getCurrentSubscription?.subscriptionTier || 'FREE'];
    const to = pricing[billing];

    const currentTotalChannels = (
      await this._integrationService.getIntegrationsList(organizationId)
    ).filter((f) => !f.disabled);

    if (currentTotalChannels.length > totalChannels) {
      await this._integrationService.disableIntegrations(
        organizationId,
        currentTotalChannels.length - totalChannels
      );
    }

    if (from.team_members && !to.team_members) {
      await this._organizationService.disableOrEnableNonSuperAdminUsers(
        organizationId,
        true
      );
    }

    if (!from.team_members && to.team_members) {
      await this._organizationService.disableOrEnableNonSuperAdminUsers(
        organizationId,
        false
      );
    }

    if (billing === 'FREE') {
      await this._integrationService.changeActiveCron(organizationId);
    }

    return true;
  }

  async modifySubscription(
    customerId: string,
    totalChannels: number,
    billing: 'FREE' | 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE'
  ) {
    if (!customerId) {
      return false;
    }

    const getOrgByCustomerId =
      await this._subscriptionRepository.getOrganizationByCustomerId(
        customerId
      );

    const getCurrentSubscription =
      (await this._subscriptionRepository.getSubscriptionByCustomerId(
        customerId
      ))!;

    if (
      !getOrgByCustomerId ||
      (getCurrentSubscription && getCurrentSubscription?.isLifetime)
    ) {
      return false;
    }

    const from = pricing[getCurrentSubscription?.subscriptionTier || 'FREE'];
    const to = pricing[billing];

    const currentTotalChannels = (
      await this._integrationService.getIntegrationsList(
        getOrgByCustomerId?.id!
      )
    ).filter((f) => !f.disabled);

    if (currentTotalChannels.length > totalChannels) {
      await this._integrationService.disableIntegrations(
        getOrgByCustomerId?.id!,
        currentTotalChannels.length - totalChannels
      );
    }

    if (from.team_members && !to.team_members) {
      await this._organizationService.disableOrEnableNonSuperAdminUsers(
        getOrgByCustomerId?.id!,
        true
      );
    }

    if (!from.team_members && to.team_members) {
      await this._organizationService.disableOrEnableNonSuperAdminUsers(
        getOrgByCustomerId?.id!,
        false
      );
    }

    if (billing === 'FREE') {
      await this._integrationService.changeActiveCron(getOrgByCustomerId?.id!);
    }

    return true;
  }

  async createOrUpdateSubscription(
    provider: string,
    isTrailing: boolean,
    identifier: string,
    customerId: string,
    totalChannels: number,
    billing: 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE',
    period: 'MONTHLY' | 'YEARLY',
    cancelAt: number | null,
    code?: string,
    org?: string
  ) {
    if (!code) {
      if (!(await this.isManagedBy(customerId, provider))) {
        return {};
      }
      try {
        const load = await this.modifySubscription(
          customerId,
          totalChannels,
          billing
        );
        if (!load) {
          return {};
        }
      } catch (e) {
        return {};
      }
    }
    return this._subscriptionRepository.createOrUpdateSubscription(
      provider,
      isTrailing,
      identifier,
      customerId,
      totalChannels,
      billing,
      period,
      cancelAt,
      code,
      org ? { id: org } : undefined
    );
  }

  async createOrUpdateSubscriptionByOrg(
    isTrailing: boolean,
    organizationId: string,
    provider: string,
    identifier: string,
    totalChannels: number,
    billing: 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE',
    period: 'MONTHLY' | 'YEARLY',
    cancelAt: number | null,
    currency?: 'INR' | 'USD'
  ) {
    const current = await this._subscriptionRepository.getSubscriptionByOrgId(
      organizationId
    );
    if (current && (current.isLifetime || current.provider !== provider)) {
      return {};
    }

    try {
      const load = await this.modifySubscriptionByOrg(
        organizationId,
        totalChannels,
        billing
      );
      if (!load) {
        return {};
      }
    } catch (e) {
      return {};
    }

    return this._subscriptionRepository.createOrUpdateSubscription(
      provider,
      isTrailing,
      identifier,
      '',
      totalChannels,
      billing,
      period,
      cancelAt,
      undefined,
      { id: organizationId },
      currency
    );
  }

  getSubscriptionByIdentifier(identifier: string) {
    return this._subscriptionRepository.getSubscriptionByIdentifier(identifier);
  }

  // One-time lifetime purchase (as opposed to a redeemed promo code, which
  // goes through the generic lifetimeDeal(organizationId, code) contract on
  // PaymentProviderAbstract) - the repository marks a subscription lifetime
  // whenever a truthy "code" is passed, so `identifier` (the order/payment
  // id) doubles as that marker here.
  async lifeTime(
    organizationId: string,
    provider: string,
    identifier: string,
    billing: 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE'
  ) {
    return this._subscriptionRepository.createOrUpdateSubscription(
      provider,
      false,
      identifier,
      '',
      pricing[billing].channel || 0,
      billing,
      'MONTHLY',
      null,
      identifier,
      { id: organizationId }
    );
  }

  async getSubscription(organizationId: string) {
    return this._subscriptionRepository.getSubscription(organizationId);
  }

  async checkCredits(organization: Organization, checkType = 'ai_images') {
    // @ts-ignore
    const type = organization?.subscription?.subscriptionTier || 'FREE';

    if (type === 'FREE') {
      return { credits: 0 };
    }

    // @ts-ignore
    let date = dayjs(organization.subscription.createdAt);
    while (date.isBefore(dayjs())) {
      date = date.add(1, 'month');
    }

    const checkFromMonth = date.subtract(1, 'month');
    const imageGenerationCount =
      checkType === 'ai_images'
        ? pricing[type].image_generation_count
        : pricing[type].generate_videos;

    const totalUse = await this._subscriptionRepository.getCreditsFrom(
      organization.id,
      checkFromMonth,
      checkType
    );

    return {
      credits: imageGenerationCount - totalUse,
    };
  }

  // Subscriptions an admin granted by hand (addSubscription): nothing is billed for them.
  // New ones carry a `manual_` identifier; older ones got a bare 5 character id. Real
  // provider ids (sub_...) never look like either, and lifetime plans are never manual.
  isManualSubscription(subscription: {
    identifier: string | null;
    isLifetime: boolean;
  }) {
    return (
      !subscription.isLifetime &&
      /^(manual_.+|[A-Za-z0-9]{5})$/.test(subscription.identifier || '')
    );
  }

  async addSubscription(
    orgId: string,
    userId: string,
    subscription: string,
    provider: string
  ) {
    const tiers = ['STANDARD', 'TEAM', 'PRO', 'ULTIMATE'] as const;
    const tier = tiers.find((f) => f === subscription);
    if (!tier) {
      throw new HttpException(
        `Unknown subscription tier, use one of ${tiers.join(', ')}`,
        400
      );
    }

    // A paid subscription is owned by its payment provider: replacing it here would
    // orphan the real one (and org.paymentId, which Razorpay uses as the subscription id).
    const current = await this._subscriptionRepository.getSubscriptionByOrgId(
      orgId
    );
    if (current && !this.isManualSubscription(current)) {
      throw new HttpException(
        `This organization has a ${current.provider} subscription (${current.subscriptionTier}), change it there instead of adding a manual one`,
        400
      );
    }

    await this._subscriptionRepository.setCustomerId(orgId, userId);
    const skipped = await this.createOrUpdateSubscription(
      provider,
      false,
      `manual_${makeId(10)}`,
      userId,
      pricing[tier].channel!,
      tier,
      'MONTHLY',
      null,
      undefined,
      orgId
    );

    // createOrUpdateSubscription answers with {} when it declined to change anything
    if (skipped) {
      throw new HttpException(
        'The subscription was not changed, it is managed by another payment provider',
        400
      );
    }
  }

  async removeManualSubscription(orgId: string) {
    const current = await this._subscriptionRepository.getSubscriptionByOrgId(
      orgId
    );
    if (!current) {
      throw new HttpException('This organization has no subscription', 400);
    }

    if (!this.isManualSubscription(current)) {
      throw new HttpException(
        `This subscription is billed through ${current.provider}, cancel it there instead`,
        400
      );
    }

    await this.deleteSubscriptionByOrgId(orgId, current.provider);
    // addSubscription parks a placeholder in org.paymentId; clear it so a later
    // real checkout starts from a clean slate
    await this._subscriptionRepository.setCustomerId(orgId, null);
    return { removed: true, tier: current.subscriptionTier };
  }
}
