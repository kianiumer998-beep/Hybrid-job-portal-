export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationTargetAudience =
  | 'all'
  | 'jobseekers'
  | 'employers'
  | 'subscribers'
  | 'unpaid_expired'
  | 'specific_users';
export type NotificationChannel = 'In-App' | 'Email' | 'WhatsApp' | 'Push Notification' | 'Multi-Channel';
export type NotificationStatus = 'draft' | 'published' | 'archived';
export type MandatoryActionType = 'kyc' | 'terms_acceptance' | 'cta_confirmation' | 'custom_acknowledgement';

export interface NotificationItem {
  id: string;
  title: string;
  body: string; // Sanitized HTML
  plainText?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  target?: '_blank' | '_self';
  enabled: boolean;
  priority: NotificationPriority;
  startDate?: string;
  expiryDate?: string;
  targetAudience: NotificationTargetAudience;
  targetUserIds?: string[];
  channels: {
    bell: boolean;
    popup: boolean;
    pageBanner: boolean;
  };
  dismissible: boolean;
  status: NotificationStatus;

  // Mandatory action fields
  isMandatory?: boolean;
  mandatoryActionType?: MandatoryActionType;
  policyVersion?: string;
  restrictedFeatures?: string[]; // e.g. ['post_job', 'apply_job']

  // Metadata / Tracking
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  recipientsCount?: number;
  viewCount?: number;
  clickCount?: number;
  completionCount?: number;

  // User-specific attached state
  userState?: {
    read: boolean;
    readAt?: string;
    dismissed: boolean;
    dismissedAt?: string;
    completed: boolean;
    completedAt?: string;
    adminOverridden?: boolean;
  };
}

export interface UserNotificationRecord {
  id: string;
  userId: string;
  notificationId: string;
  read: boolean;
  readAt?: string;
  dismissed: boolean;
  dismissedAt?: string;
  completed: boolean;
  completedAt?: string;
  adminOverridden?: boolean;
  overriddenBy?: string;
  overriddenAt?: string;
  updatedAt: string;
}
