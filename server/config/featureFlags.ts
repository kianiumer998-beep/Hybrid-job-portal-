import { AdminFeatureFlags } from '../../src/types/job';
import { FeatureFlagsRepository, DEFAULT_FEATURE_FLAGS } from '../db/repositories/FeatureFlagsRepository';

export let featureFlags: AdminFeatureFlags = { ...DEFAULT_FEATURE_FLAGS };

export function setFeatureFlags(flags: AdminFeatureFlags): void {
  featureFlags = FeatureFlagsRepository.sanitizeFlags(flags, DEFAULT_FEATURE_FLAGS);
}

export function updateFeatureFlags(updates: Partial<AdminFeatureFlags>): AdminFeatureFlags {
  featureFlags = FeatureFlagsRepository.sanitizeFlags(updates, featureFlags);
  return featureFlags;
}
