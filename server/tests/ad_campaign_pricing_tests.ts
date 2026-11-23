process.env.IS_TEST = 'true';

import assert from 'node:assert/strict';
import { DEFAULT_AD_PRICING_CONFIG, DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG } from '../../src/types/ad';
import { PricingRepository } from '../db/repositories/PricingRepository';

async function run() {
  const makeCampaignConfig = (updates: Record<string, unknown> = {}) => {
    const config = JSON.parse(JSON.stringify(DEFAULT_CAMPAIGN_CUSTOMIZATION_CONFIG));
    const placement = config.placementOptions.find((item: any) => item.id === 'top-header');
    Object.assign(placement, updates);
    return config;
  };

  const setPricing = (campaignCustomizationConfig: any) => {
    PricingRepository.setMockCollection({
      findOne: async () => ({
        key: 'authoritative_pricing_config',
        settings: {
          adPricingConfig: JSON.parse(JSON.stringify(DEFAULT_AD_PRICING_CONFIG)),
          campaignCustomizationConfig
        }
      })
    });
  };

  try {
    setPricing(makeCampaignConfig({ minDurationHours: 24, percentageUpliftPercent: 25 }));
    const calculated = await PricingRepository.calculateAdPrice({
      placement: 'top-header',
      durationUnit: 'days',
      durationValue: 1,
      targetPages: ['jobs']
    });
    assert.equal(calculated.durationHours, 24, 'one day resolves to 24 hours');
    assert.equal(calculated.finalPrice, 1250, '25% uplift is applied after the 1.25x placement multiplier');

    await assert.rejects(
      () => PricingRepository.calculateAdPrice({
        placement: 'top-header',
        durationUnit: 'hours',
        durationValue: 23,
        targetPages: ['jobs']
      }),
      /minimum campaign duration.*24 hour/,
      'server rejects a campaign shorter than the configured minimum'
    );

    setPricing(makeCampaignConfig({ minDurationHours: 1, percentageUpliftPercent: 25, fixedPriceOverridePkr: 200 }));
    const fixed = await PricingRepository.calculateAdPrice({
      placement: 'top-header',
      durationUnit: 'hours',
      durationValue: 1,
      targetPages: ['jobs']
    });
    assert.equal(fixed.finalPrice, 200, 'fixed PKR rate takes precedence over multiplier and percentage uplift');

    setPricing(makeCampaignConfig({ minDurationHours: 1, isFreeOverride: true, fixedPriceOverridePkr: 200 }));
    const free = await PricingRepository.calculateAdPrice({
      placement: 'top-header',
      durationUnit: 'hours',
      durationValue: 1,
      targetPages: ['jobs']
    });
    assert.equal(free.finalPrice, 0, 'free placement override remains higher priority than fixed pricing');

    setPricing(makeCampaignConfig());
    await assert.rejects(
      () => PricingRepository.update({
        campaignCustomizationConfig: { placementOptions: [{ id: 'top-header', minDurationHours: 0 }] }
      }),
      /minDurationHours must be an integer between 1 and 2160/,
      'invalid minimum duration is rejected before persistence'
    );
    await assert.rejects(
      () => PricingRepository.update({
        campaignCustomizationConfig: { placementOptions: [{ id: 'top-header', percentageUpliftPercent: 1001 }] }
      }),
      /percentageUpliftPercent/,
      'percentage uplift above the supported limit is rejected'
    );

    console.log('Ad campaign pricing tests passed.');
  } finally {
    PricingRepository.setMockCollection(null);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
