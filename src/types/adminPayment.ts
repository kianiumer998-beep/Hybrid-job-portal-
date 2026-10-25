export interface AdminPaymentChannel {
  enabled: boolean;
  accountTitle: string;
  accountNumber: string;
  instructions: string;
  bankName?: string;
  iban?: string;
}

export interface AdminReceivingPaymentConfig {
  easypaisa: AdminPaymentChannel;
  jazzcash: AdminPaymentChannel;
  bank: AdminPaymentChannel & { bankName: string; iban: string };
  whatsapp: {
    enabled: boolean;
    phoneNumber: string;
    messageTemplate: string;
  };
  selectedDefaultMethod: 'JazzCash' | 'EasyPaisa' | 'Bank' | 'WhatsApp';
  activeDurationOptions: {
    id: string;
    label: string;
    days: number;
    enabled: boolean;
    badge?: string;
    pricePkr: number;
    isApprovedForDisplay: boolean;
  }[];
}

export const DEFAULT_ADMIN_RECEIVING_PAYMENT_CONFIG: AdminReceivingPaymentConfig = {
  easypaisa: {
    enabled: true,
    accountTitle: 'Jobs Portal Official',
    accountNumber: '0300-1234567',
    instructions: 'Send fee via EasyPaisa App or mobile account. After sending, upload receipt screenshot or WhatsApp the Transaction ID.'
  },
  jazzcash: {
    enabled: true,
    accountTitle: 'Jobs Portal Admin',
    accountNumber: '0301-9876543',
    instructions: 'Transfer via JazzCash App or Till Code. Attach proof in deposit modal for instant balance credit.'
  },
  bank: {
    enabled: true,
    bankName: 'Meezan Bank Ltd',
    accountTitle: 'Pakistan Job Alerts & Advertising Media',
    accountNumber: '01020304050607',
    iban: 'PK45MEZN0001020304050607',
    instructions: 'Direct Raast / IBAN wire transfer. Inter-bank fund transfer (IBFT) verified in 15 minutes.'
  },
  whatsapp: {
    enabled: true,
    phoneNumber: '+923001234567',
    messageTemplate: 'Assalam-o-Alaikum Admin, I have paid the campaign / job fee. Here is my transaction receipt.'
  },
  selectedDefaultMethod: 'EasyPaisa',
  activeDurationOptions: [
    { id: '1-day', label: '1 Day (24 Hours)', days: 1, enabled: true, badge: '⚡ Flash', pricePkr: 1500, isApprovedForDisplay: true },
    { id: '1-week', label: '1 Week (7 Days)', days: 7, enabled: true, badge: '⭐ Most Popular', pricePkr: 6000, isApprovedForDisplay: true },
    { id: '15-days', label: '15 Days (Mid-Month)', days: 15, enabled: true, badge: '🔥 Value', pricePkr: 11000, isApprovedForDisplay: true },
    { id: '20-days', label: '20 Days Extended', days: 20, enabled: true, badge: '🎯 Strategic', pricePkr: 14000, isApprovedForDisplay: true },
    { id: '30-days', label: '1 Month (30 Days)', days: 30, enabled: true, badge: '💎 Best Value', pricePkr: 18000, isApprovedForDisplay: true }
  ]
};

export interface CustomProofField {
  id: string;
  label: string;
  type: 'text' | 'number';
  placeholder?: string;
  helpText?: string;
  required: boolean;
  order: number;
}

export interface PublicPaymentMethodConfig {
  id: 'easypaisa' | 'jazzcash' | 'bank' | string;
  name: string;
  enabled: boolean;
  heading?: string;
  accountTitle: string;
  accountNumber: string;
  bankName?: string;
  iban?: string;
  instructions: string;
  formTitle?: string;
  formSubtitle?: string;
  isCustom?: boolean;

  // Proof requirement rules (at least one of transactionIdRequired or screenshotRequired must be true)
  transactionIdRequired: boolean;
  transactionIdLabel?: string;
  transactionIdPlaceholder?: string;
  transactionIdHelpText?: string;

  screenshotRequired: boolean;
  screenshotLabel?: string;
  screenshotHelpText?: string;

  senderNameRequired?: boolean;
  senderNameLabel?: string;
  senderPhoneRequired?: boolean;
  senderPhoneLabel?: string;
  senderPhonePlaceholder?: string;

  proofNoteRequired?: boolean;
  proofNoteLabel?: string;
  proofNotePlaceholder?: string;

  // Configurable arbitrary proof fields (e.g. CNIC, Branch Code, Reference Code)
  customFields?: CustomProofField[];
}

export interface PublicPaymentSettings {
  isConfigured: boolean;
  methods: {
    easypaisa: PublicPaymentMethodConfig;
    jazzcash: PublicPaymentMethodConfig;
    bank: PublicPaymentMethodConfig;
    [key: string]: PublicPaymentMethodConfig;
  };
  customMethods?: PublicPaymentMethodConfig[];
  defaultMethod?: string;
  updatedAt?: string;
  updatedBy?: string;
}

