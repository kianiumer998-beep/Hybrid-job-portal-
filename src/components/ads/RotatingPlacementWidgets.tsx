import React, { useState, useEffect, useMemo } from 'react';
import {
  Advertisement,
  AdTargetPage,
  PlacementRotationConfig,
  PromoDiscountBanner,
  DEFAULT_PLACEMENT_ROTATION_CONFIG,
  isAdCurrentlyRunning,
  AdOpportunityDisplayConfig
} from '../../types/ad';
import { CustomLandingCard } from '../../types/landing';
import { getRotatedItems, getVisibleWindow, getNextStepSize } from '../../utils/adRotation';
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Sparkles } from 'lucide-react';

interface RotatingPaidPromoAdsProps {
  adOpportunityDisplay?: AdOpportunityDisplayConfig;
  ads: Advertisement[];
  activeBanners: PromoDiscountBanner[];
  rotationSettings?: PlacementRotationConfig;
  maxConcurrentSlots?: number;
  showAdOpportunity?: boolean;
  onPaidAdCta: (ad: Advertisement) => void;
  onPromoBannerCta: (banner: PromoDiscountBanner) => void;
}

export const RotatingPromoBannersSection: React.FC<RotatingPaidPromoAdsProps> = ({
  ads,
  activeBanners,
  rotationSettings = DEFAULT_PLACEMENT_ROTATION_CONFIG,
  maxConcurrentSlots = 1,
  showAdOpportunity = true,
  adOpportunityDisplay,
  onPaidAdCta,
  onPromoBannerCta
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const orderedPaidAds = useMemo(() => {
    const enabled = rotationSettings?.enabled !== false;
    const mode = enabled ? (rotationSettings?.sequenceMode || 'sequential_per_visit') : 'fixed';
    return getRotatedItems(ads, 'ad_promo-discount-banner', mode);
  }, [ads, rotationSettings?.enabled, rotationSettings?.sequenceMode]);

  const promoRule = adOpportunityDisplay?.adPlacements?.['promo-discount-banner'];
  const showPromoCategoryCta = promoRule?.enabled !== false && (promoRule?.displayMode === 'whole_category' || promoRule?.displayMode === 'placement_level' || (promoRule?.displayMode === 'manual' && (promoRule.showOnCategory || promoRule.showOnPlacement)));
  const showPromoEachCardCta = promoRule?.enabled !== false && (promoRule?.displayMode === 'each_card' || (promoRule?.displayMode === 'manual' && promoRule.showOnEachCard));
  const totalPaid = orderedPaidAds.length;
  const visibleCount = totalPaid > 0 ? Math.min(totalPaid, Math.max(1, Math.min(10, Number(maxConcurrentSlots) || 1))) : 0;
  const stepSize = getNextStepSize(totalPaid, visibleCount);
  const isAutoRotate = rotationSettings?.enabled !== false && rotationSettings?.autoRotateTimed !== false;
  const intervalMs = Math.max(2, Math.min(120, Number(rotationSettings?.intervalSeconds) || 6)) * 1000;

  useEffect(() => {
    if (totalPaid <= visibleCount || !isAutoRotate || isPaused) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + stepSize) % totalPaid);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [totalPaid, visibleCount, stepSize, isAutoRotate, isPaused, intervalMs]);

  const visiblePaidAds = useMemo(
    () => getVisibleWindow(orderedPaidAds, currentIndex, visibleCount),
    [orderedPaidAds, currentIndex, visibleCount]
  );

  const promoSlotLimit = Math.max(1, Math.min(10, Number(maxConcurrentSlots) || 1));
  const hasAvailablePromoAdSlot = visiblePaidAds.length < promoSlotLimit;

  if (activeBanners.length === 0 && visiblePaidAds.length === 0) {
    if (!showAdOpportunity || (!showPromoCategoryCta && !showPromoEachCardCta)) return null;
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-end">
        <button type="button" onClick={() => onPromoBannerCta({
          id: 'promo-ad-opportunity', title: 'Your Ad Here — Promotional Banner',
          description: 'Promote your campaign in the promotional banner placement.',
          discountPercent: 0, ctaText: 'Choose Ad Package'
        } as PromoDiscountBanner)}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black tracking-wide text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.12)] transition-all hover:border-amber-300 hover:bg-amber-400/20 hover:shadow-[0_0_18px_rgba(251,191,36,0.22)]">
          <Sparkles className="h-3 w-3" /> Your Ad Here <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {showAdOpportunity && showPromoCategoryCta && hasAvailablePromoAdSlot && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onPromoBannerCta({
              id: 'promo-ad-opportunity',
              title: 'Your Ad Here — Promotional Banner',
              description: 'Promote your campaign in the promotional banner placement.',
              discountPercent: 0,
              ctaText: 'Choose Ad Package'
            } as PromoDiscountBanner)}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black tracking-wide text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.12)] transition-all hover:border-amber-300 hover:bg-amber-400/20"
          >
            <Sparkles className="h-3 w-3" /> Your Ad Here <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}
      {activeBanners.map((banner) => (
        <div
          key={banner.id}
          className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-r ${banner.bgGradient || 'from-amber-600 via-rose-600 to-indigo-700'} text-white shadow-xl shadow-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-white/20`}
        >
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm border border-white/30 text-white">
                {banner.badgeText || '🔥 SPECIAL OFFER'}
              </span>
              <span className="text-xs font-black font-mono bg-white/20 px-2 py-0.5 rounded text-white">
                {banner.discountPercent}% OFF
              </span>
              {banner.promoCode && (
                <span className="text-xs font-mono font-bold bg-black/40 px-2 py-0.5 rounded border border-white/20">
                  Use Code: {banner.promoCode}
                </span>
              )}
            </div>
            <h4 className="text-sm sm:text-base font-black tracking-tight">{banner.title}</h4>
            <p className="text-xs text-white/90 max-w-2xl">{banner.description}</p>
          </div>
          {showPromoEachCardCta && <button type="button" onClick={() => onPromoBannerCta({ id: 'promo-ad-opportunity', title: 'Your Ad Here — Promotional Banner', description: 'Promote your campaign in the promotional banner placement.', discountPercent: 0, ctaText: 'Choose Ad Package' } as PromoDiscountBanner)} className="self-start rounded-full border border-amber-300/60 bg-slate-950/90 px-2.5 py-1 text-[10px] font-black text-amber-200">Your Ad Here →</button>}
          <button
            onClick={() => onPromoBannerCta(banner)}
            className="px-5 py-2.5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer shrink-0"
          >
            {banner.ctaText || 'Book Discount Ad'} →
          </button>
        </div>
      ))}

      {visiblePaidAds.length > 0 && (
        <div className="space-y-2.5">
          {visiblePaidAds.map((ad) => (
            <div
              key={ad.id}
              className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-rose-700 via-amber-600 to-indigo-700 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-white/20 transition-all"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-black/30 border border-white/30">
                    {ad.badgeText || 'SPECIAL OFFER'}
                  </span>
                  {Number(ad.discountPercent || 0) > 0 && (
                    <span className="text-xs font-black font-mono bg-white/20 px-2 py-0.5 rounded">
                      {ad.discountPercent}% OFF
                    </span>
                  )}
                  {ad.promoCode && (
                    <span className="text-xs font-mono font-bold bg-black/40 px-2 py-0.5 rounded">
                      Use Code: {ad.promoCode}
                    </span>
                  )}
                </div>
                {ad.imageUrl && (
                  <img
                    src={ad.imageUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="max-h-24 max-w-full rounded-lg object-contain"
                  />
                )}
                <h4 className="text-sm sm:text-base font-black tracking-tight">{ad.headline}</h4>
                <p className="text-xs text-white/90 max-w-2xl">{ad.bodyText}</p>
              </div>
              {showPromoEachCardCta && <button type="button" onClick={() => onPromoBannerCta({ id: 'promo-ad-opportunity', title: 'Your Ad Here — Promotional Banner', description: 'Promote your campaign in the promotional banner placement.', discountPercent: 0, ctaText: 'Choose Ad Package' } as PromoDiscountBanner)} className="self-start rounded-full border border-amber-300/60 bg-slate-950/90 px-2.5 py-1 text-[10px] font-black text-amber-200">Your Ad Here →</button>}
            <button
                onClick={() => onPaidAdCta(ad)}
                className="px-5 py-2.5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer shrink-0"
              >
                {ad.ctaText || 'Claim Offer'} →
              </button>
            </div>
          ))}

          {totalPaid > visibleCount && (
            <div className="flex items-center justify-end gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev - stepSize + totalPaid) % totalPaid)}
                className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                title="Previous promotional banner"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-slate-400 font-mono">
                {(currentIndex % totalPaid) + 1} / {totalPaid}
              </span>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev + stepSize) % totalPaid)}
                className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                title="Next promotional banner"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface RotatingAnnouncementCardsSectionProps {
  adOpportunityDisplay?: AdOpportunityDisplayConfig;
  activeCards: CustomLandingCard[];
  paidAnnouncementAds: Advertisement[];
  activePromo?: PromoDiscountBanner;
  showPromoDesktop: boolean;
  showPromoMobile: boolean;
  rotationSettings?: PlacementRotationConfig;
  maxConcurrentSlots?: number;
  showAdOpportunity?: boolean;
  onPaidAdCta: (ad: Advertisement) => void;
  onAdDestination: (url: string) => void;
}

export const RotatingAnnouncementCardsSection: React.FC<RotatingAnnouncementCardsSectionProps> = ({
  activeCards,
  paidAnnouncementAds,
  activePromo,
  showPromoDesktop,
  showPromoMobile,
  rotationSettings = DEFAULT_PLACEMENT_ROTATION_CONFIG,
  maxConcurrentSlots = 2,
  showAdOpportunity = true,
  adOpportunityDisplay,
  onPaidAdCta,
  onAdDestination
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const orderedPaidAds = useMemo(() => {
    const enabled = rotationSettings?.enabled !== false;
    const mode = enabled ? (rotationSettings?.sequenceMode || 'sequential_per_visit') : 'fixed';
    return getRotatedItems(paidAnnouncementAds, 'ad_dynamic-announcement-card', mode);
  }, [paidAnnouncementAds, rotationSettings?.enabled, rotationSettings?.sequenceMode]);

  const announcementRule = adOpportunityDisplay?.adPlacements?.['dynamic-announcement-card'];
  const showAnnouncementCategoryCta = announcementRule?.enabled !== false && (announcementRule?.displayMode === 'whole_category' || announcementRule?.displayMode === 'placement_level' || (announcementRule?.displayMode === 'manual' && (announcementRule.showOnCategory || announcementRule.showOnPlacement)));
  const showAnnouncementEachCardCta = announcementRule?.enabled !== false && (announcementRule?.displayMode === 'each_card' || (announcementRule?.displayMode === 'manual' && announcementRule.showOnEachCard));
  const totalPaid = orderedPaidAds.length;
  const visibleCount = totalPaid > 0 ? Math.min(totalPaid, Math.max(1, Math.min(10, Number(maxConcurrentSlots) || 1))) : 0;
  const stepSize = getNextStepSize(totalPaid, visibleCount);
  const isAutoRotate = rotationSettings?.enabled !== false && rotationSettings?.autoRotateTimed !== false;
  const intervalMs = Math.max(2, Math.min(120, Number(rotationSettings?.intervalSeconds) || 6)) * 1000;

  useEffect(() => {
    if (totalPaid <= visibleCount || !isAutoRotate || isPaused) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + stepSize) % totalPaid);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [totalPaid, visibleCount, stepSize, isAutoRotate, isPaused, intervalMs]);

  const visiblePaidAds = useMemo(
    () => getVisibleWindow(orderedPaidAds, currentIndex, visibleCount),
    [orderedPaidAds, currentIndex, visibleCount]
  );

  const effectiveShowPromoDesktop =
    showPromoDesktop && (activeCards.length + visiblePaidAds.length) % 2 === 1 && Boolean(activePromo);
  const hasAvailableAnnouncementSlot = visiblePaidAds.length < Math.max(1, Math.min(10, Number(maxConcurrentSlots) || 2));

  if (activeCards.length === 0 && visiblePaidAds.length === 0 && !showPromoMobile && !effectiveShowPromoDesktop && (!showAdOpportunity || announcementRule?.enabled === false || (!showAnnouncementCategoryCta && !showAnnouncementEachCardCta))) {
    return null;
  }

  return (
    <div
      className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 space-y-2"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {showAdOpportunity && showAnnouncementEachCardCta && visiblePaidAds.length === 0 && (
        <div className="flex justify-end"><button type="button" onClick={() => onPaidAdCta({ id: 'demo-your-ad-here-announcement', title: 'Your Ad Here — Announcement Card', type: 'banner', placement: 'dynamic-announcement-card', targetPages: ['jobs'], status: 'active', approvalStatus: 'Approved', submittedByUserId: 'system-demo', submittedByUserName: 'Platform Promotion', headline: 'Your Ad Here', bodyText: 'Promote your company or campaign in a featured announcement card.', badgeText: 'Advertise Here', ctaText: 'Explore Ad Plans', ctaUrl: '', theme: 'amber', dismissable: false, impressions: 0, clicks: 0, createdAt: new Date().toISOString(), durationUnit: 'days', durationValue: 1 } as Advertisement)} className="rounded-full border border-amber-400/60 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black text-amber-200">Your Ad Here →</button></div>
      )}
      {showAdOpportunity && showAnnouncementCategoryCta && hasAvailableAnnouncementSlot && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onPaidAdCta({
              id: 'demo-your-ad-here-announcement',
              title: 'Your Ad Here — Announcement Card',
              type: 'banner',
              placement: 'dynamic-announcement-card',
              targetPages: ['jobs'],
              status: 'active',
              approvalStatus: 'Approved',
              submittedByUserId: 'system-demo',
              submittedByUserName: 'Platform Promotion',
              headline: 'Your Ad Here',
              bodyText: 'Promote your company or campaign in a featured announcement card.',
              badgeText: 'Advertise Here',
              ctaText: 'Explore Ad Plans',
              ctaUrl: '',
              theme: 'amber',
              dismissable: false,
              impressions: 0,
              clicks: 0,
              createdAt: new Date().toISOString(),
              durationUnit: 'days',
              durationValue: 1
            } as Advertisement)}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black tracking-wide text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.12)] transition-all hover:border-amber-300 hover:bg-amber-400/20"
          >
            <Sparkles className="h-3 w-3" /> Your Ad Here <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 items-stretch">
        {activeCards.map((card, index) => (
          <div
            key={card.id}
            className={`min-w-0 p-3 sm:p-4 rounded-xl bg-gradient-to-r ${card.bgGradient || 'from-slate-900 to-indigo-950'} border border-white/10 text-white flex flex-col justify-between gap-3 shadow-lg ${index === activeCards.length - 1 && (activeCards.length + visiblePaidAds.length) % 2 === 1 && !effectiveShowPromoDesktop && visiblePaidAds.length === 0 ? 'md:col-span-2' : ''}`}
          >
            <div className="min-w-0 space-y-1.5">
              {card.imageUrl && (
                <img
                  src={card.imageUrl}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-32 sm:max-h-36 rounded-lg object-cover border border-white/10"
                />
              )}
              {card.badge && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-black/40 text-amber-300 border border-white/20 inline-block">
                  {card.badge}
                </span>
              )}
              <h4 className="text-base sm:text-lg font-black leading-snug">{card.title}</h4>
              <p className="text-xs text-slate-300 leading-snug">{card.description}</p>
            </div>
            <button
              onClick={() => onAdDestination(card.buttonUrl)}
              className="self-start px-3.5 py-2 rounded-lg bg-white text-slate-950 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer shadow-md"
            >
              {card.buttonText} →
            </button>
          </div>
        ))}

        {visiblePaidAds.map((ad, idx) => (
          <div
            key={`${ad.id}-${idx}`}
            className={`min-w-0 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 border border-white/10 text-white flex flex-col justify-between gap-3 shadow-lg ${idx === visiblePaidAds.length - 1 && (activeCards.length + visiblePaidAds.length) % 2 === 1 && !effectiveShowPromoDesktop ? 'md:col-span-2' : ''}`}
          >
            <div className="min-w-0 space-y-1.5">
              {ad.imageUrl && (
                <img
                  src={ad.imageUrl}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-32 sm:max-h-36 rounded-lg object-cover border border-white/10"
                />
              )}
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-black/40 text-amber-300 border border-white/20 inline-block">
                {ad.badgeText || 'SPONSORED ANNOUNCEMENT'}
              </span>
              <h4 className="text-base sm:text-lg font-black leading-snug">{ad.headline}</h4>
              <p className="text-xs text-slate-300 leading-snug">{ad.bodyText}</p>
            </div>
            {showAnnouncementEachCardCta && <button type="button" onClick={() => onPaidAdCta({ id: 'demo-your-ad-here-announcement', title: 'Your Ad Here — Announcement Card', type: 'banner', placement: 'dynamic-announcement-card', targetPages: ['jobs'], status: 'active', approvalStatus: 'Approved', submittedByUserId: 'system-demo', submittedByUserName: 'Platform Promotion', headline: 'Your Ad Here', bodyText: 'Promote your company or campaign in a featured announcement card.', badgeText: 'Advertise Here', ctaText: 'Explore Ad Plans', ctaUrl: '', theme: 'amber', dismissable: false, impressions: 0, clicks: 0, createdAt: new Date().toISOString(), durationUnit: 'days', durationValue: 1 } as Advertisement)} className="self-start rounded-full border border-amber-300/60 bg-slate-950/90 px-2.5 py-1 text-[10px] font-black text-amber-200">Your Ad Here →</button>}
            <button
              onClick={() => onPaidAdCta(ad)}
              className="self-start px-3.5 py-2 rounded-lg bg-white text-slate-950 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer shadow-md"
            >
              {ad.ctaText || 'Learn More'} →
            </button>
          </div>
        ))}

        {activePromo && (effectiveShowPromoDesktop || showPromoMobile) && (
          <article
            className={`min-w-0 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-rose-950 via-slate-900 to-amber-950 border border-rose-400/30 text-white flex flex-col justify-between gap-3 shadow-lg ${showPromoMobile ? (effectiveShowPromoDesktop ? 'flex' : 'flex md:hidden') : (effectiveShowPromoDesktop ? 'hidden md:flex' : 'hidden')}`}
          >
            <div className="min-w-0 space-y-1.5">
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 border border-rose-300/30 inline-block">
                {activePromo.badgeText || 'SPECIAL PROMOTION'}
              </span>
              <h4 className="text-base sm:text-lg font-black leading-snug">{activePromo.title}</h4>
              <p className="text-xs text-slate-200 leading-snug">{activePromo.description}</p>
              {activePromo.discountPercent > 0 && (
                <p className="text-xl font-black text-amber-300">{activePromo.discountPercent}% OFF</p>
              )}
              {activePromo.promoCode && (
                <p className="text-[11px] text-rose-100">
                  Code: <strong>{activePromo.promoCode}</strong>
                </p>
              )}
            </div>
            {activePromo.ctaText && (
              <button
                onClick={() => activePromo.ctaUrl ? onAdDestination(activePromo.ctaUrl) : undefined}
                className="self-start px-3.5 py-2 rounded-lg bg-rose-500 text-white font-bold text-xs hover:bg-rose-400 transition-all cursor-pointer shadow-md"
              >
                {activePromo.ctaText} →
              </button>
            )}
          </article>
        )}
      </div>

      {totalPaid > visibleCount && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => (prev - stepSize + totalPaid) % totalPaid)}
            className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title="Previous announcement card"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-slate-400 font-mono">
            {(currentIndex % totalPaid) + 1} / {totalPaid}
          </span>
          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => (prev + stepSize) % totalPaid)}
            className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title="Next announcement card"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

interface RotatingSidebarAdsProps {
  adOpportunityDisplay?: AdOpportunityDisplayConfig;
  onPaidAdCta?: (ad: Advertisement) => void;
  ads: Advertisement[];
  currentPage: AdTargetPage;
  isEnabled?: boolean;
  rotationSettings?: PlacementRotationConfig;
  maxConcurrentSlots?: number;
  showAdOpportunity?: boolean;
  onAdClick: (ad: Advertisement) => void;
  onNavigateTab?: (tab: 'jobs' | 'cv' | 'alerts' | 'dashboard') => void;
}

export const RotatingSidebarAds: React.FC<RotatingSidebarAdsProps> = ({
  ads,
  currentPage,
  isEnabled = true,
  rotationSettings = DEFAULT_PLACEMENT_ROTATION_CONFIG,
  maxConcurrentSlots = 1,
  showAdOpportunity = true,
  onAdClick,
  onNavigateTab,
  adOpportunityDisplay,
  onPaidAdCta
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const orderedAds = useMemo(() => {
    if (!isEnabled) return [];
    const filtered = ads.filter(
      (ad) =>
        isAdCurrentlyRunning(ad) &&
        ad.placement === 'sidebar' &&
        (ad.targetPages.includes('all') || ad.targetPages.includes(currentPage))
    );
    const enabled = rotationSettings?.enabled !== false;
    const mode = enabled ? (rotationSettings?.sequenceMode || 'sequential_per_visit') : 'fixed';
    return getRotatedItems(filtered, 'ad_sidebar', mode);
  }, [ads, currentPage, isEnabled, rotationSettings?.enabled, rotationSettings?.sequenceMode]);

  const sidebarRule = adOpportunityDisplay?.adPlacements?.sidebar;
  const showSidebarCategoryCta = showAdOpportunity && sidebarRule?.enabled !== false && (sidebarRule?.displayMode === 'whole_category' || sidebarRule?.displayMode === 'placement_level' || (sidebarRule?.displayMode === 'manual' && (sidebarRule.showOnCategory || sidebarRule.showOnPlacement)));
  const showSidebarEachCardCta = showAdOpportunity && sidebarRule?.enabled !== false && (sidebarRule?.displayMode === 'each_card' || (sidebarRule?.displayMode === 'manual' && sidebarRule.showOnEachCard));
  const total = orderedAds.length;
  const sidebarSlotLimit = Math.max(1, Math.min(6, Number(maxConcurrentSlots) || 1));
  const visibleCount = total > 0 ? Math.min(total, sidebarSlotLimit) : 0;
  const stepSize = getNextStepSize(total, visibleCount);
  const isAutoRotate = rotationSettings?.enabled !== false && rotationSettings?.autoRotateTimed !== false;
  const intervalMs = Math.max(2, Math.min(120, Number(rotationSettings?.intervalSeconds) || 6)) * 1000;

  useEffect(() => {
    if (total <= visibleCount || !isAutoRotate || isPaused) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + stepSize) % total);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [total, visibleCount, stepSize, isAutoRotate, isPaused, intervalMs]);

  const visibleAds = useMemo(
    () => getVisibleWindow(orderedAds, currentIndex, visibleCount),
    [orderedAds, currentIndex, visibleCount]
  );

  if (!isEnabled) return null;
  if (visibleAds.length === 0) {
    if (!showSidebarCategoryCta && !showSidebarEachCardCta) return null;
    return (
      <button type="button" onClick={() => onAdClick({
        id: 'demo-your-ad-here', title: 'Your Ad Here — Sidebar Advertisement',
        type: 'banner', placement: 'sidebar', targetPages: ['all'], status: 'active',
        approvalStatus: 'Approved', submittedByUserId: 'system-demo',
        submittedByUserName: 'Platform Promotion', headline: 'Your Ad Here',
        bodyText: 'Promote your business in the sidebar placement.', badgeText: 'Advertise Here',
        ctaText: 'Choose Ad Package', ctaUrl: '', theme: 'amber', dismissable: false,
        impressions: 0, clicks: 0, createdAt: new Date().toISOString(),
        durationUnit: 'days', durationValue: 1
      } as Advertisement)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-[10px] font-black text-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.1)] transition hover:border-amber-300 hover:bg-amber-400/20">
        <Sparkles className="h-3 w-3" /> Your Ad Here <ArrowRight className="h-3 w-3" />
      </button>
    );
  }

  const handleAction = (ad: Advertisement) => {
    onAdClick(ad);
    if (ad.ctaUrl) {
      if (ad.ctaUrl.startsWith('#') && onNavigateTab) {
        const tab = ad.ctaUrl.replace('#', '') as 'jobs' | 'cv' | 'alerts' | 'dashboard';
        if (['jobs', 'cv', 'alerts', 'dashboard'].includes(tab)) {
          onNavigateTab(tab);
          return;
        }
      }
      if (ad.ctaUrl.startsWith('http')) {
        window.open(ad.ctaUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div
      className="space-y-3"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {showSidebarCategoryCta && visibleAds.length < sidebarSlotLimit && (
        <button
          type="button"
          onClick={() => onAdClick({
            id: 'demo-your-ad-here',
            title: 'Your Ad Here — Sidebar Advertisement',
            type: 'banner',
            placement: 'sidebar',
            targetPages: ['all'],
            status: 'active',
            approvalStatus: 'Approved',
            submittedByUserId: 'system-demo',
            submittedByUserName: 'Platform Promotion',
            headline: 'Your Ad Here',
            bodyText: 'Promote your business in the sidebar placement.',
            badgeText: 'Advertise Here',
            ctaText: 'Choose Ad Package',
            ctaUrl: '',
            theme: 'amber',
            dismissable: false,
            impressions: 0,
            clicks: 0,
            createdAt: new Date().toISOString(),
            durationUnit: 'days',
            durationValue: 1
          } as Advertisement)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black tracking-wide text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.12)] transition-all hover:border-amber-300 hover:bg-amber-400/20"
        >
          <Sparkles className="h-3 w-3" /> Your Ad Here <ArrowRight className="h-3 w-3" />
        </button>
      )}
      {visibleAds.map((ad, idx) => (
        <div
          key={`${ad.id}-${idx}`}
          onClick={() => handleAction(ad)}
          className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 p-4 shadow-xl hover:border-indigo-400/60 transition-all cursor-pointer group space-y-2.5"
        >
          {showSidebarEachCardCta && <button type="button" onClick={(e) => { e.stopPropagation(); onPaidAdCta?.({ id: 'demo-your-ad-here-sidebar', title: 'Your Ad Here — Sidebar Advertisement', type: 'banner', placement: 'sidebar', targetPages: ['all'], status: 'active', approvalStatus: 'Approved', submittedByUserId: 'system-demo', submittedByUserName: 'Platform Promotion', headline: 'Your Ad Here', bodyText: 'Promote your business in the sidebar placement.', badgeText: 'Advertise Here', ctaText: 'Choose Ad Package', ctaUrl: '', theme: 'amber', dismissable: false, impressions: 0, clicks: 0, createdAt: new Date().toISOString(), durationUnit: 'days', durationValue: 1 } as Advertisement)}} className="inline-flex rounded-full border border-amber-300/60 bg-slate-950/90 px-2.5 py-1 text-[10px] font-black text-amber-200">Your Ad Here →</button>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>{ad.badgeText || 'Sponsored'}</span>
            </span>
            {total > visibleCount && idx === 0 && (
              <span className="text-[10px] font-mono text-slate-400">
                {(currentIndex % total) + 1}/{total}
              </span>
            )}
          </div>

          {ad.imageUrl && (
            <div className="w-full h-32 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <img
                src={ad.imageUrl}
                alt={ad.title}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}

          <h4 className="text-sm font-black text-white group-hover:text-indigo-300 transition-colors leading-snug">
            {ad.headline}
          </h4>

          {ad.bodyText && (
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
              {ad.bodyText}
            </p>
          )}

          <div className="pt-1 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAction(ad);
              }}
              className="px-3.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs inline-flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <span>{ad.ctaText || 'Learn More'}</span>
              {ad.ctaUrl?.startsWith('http') ? <ExternalLink className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            </button>

            {total > visibleCount && idx === 0 && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev - stepSize + total) % total)}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                  title="Previous sponsored card"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev + stepSize) % total)}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                  title="Next sponsored card"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
