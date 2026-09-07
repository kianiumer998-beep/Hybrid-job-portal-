import { AdminFeatureFlags } from '../../src/types/job';

export let featureFlags: AdminFeatureFlags = {
  enableWebScraper: true,
  enableUniversalKeywordlessScraper: true,
  enableNewspaperClippings: true,
  enableScraperAutoApprove: false,
  enableGovtJobsPortal: true,
  enablePostingFeePaywall: true,
  enableCvBuilderPaywall: true,
  enableLiveSupportChat: true,
  deduplicationEnabled: true,
};

export function updateFeatureFlags(updates: Partial<AdminFeatureFlags>): AdminFeatureFlags {
  featureFlags = {
    ...featureFlags,
    ...updates
  };
  return featureFlags;
}
