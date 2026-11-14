import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer, Server } from 'http';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Strict isolated test mode before importing repositories/routes
process.env.IS_TEST = 'true';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.MONGO_URI = '';

import {
  SystemSettingsRepository,
  DEFAULT_WHATSAPP_SUPPORT_CONFIG,
  sanitizeWhatsAppSupportConfig,
  resetSystemSettingsTestStore
} from '../db/repositories/SystemSettingsRepository';
import { FeatureFlagsRepository, DEFAULT_FEATURE_FLAGS } from '../db/repositories/FeatureFlagsRepository';
import { AuditRepository } from '../db/repositories/AuditRepository';
import { UserRepository } from '../db/repositories/UserRepository';
import { systemSettingsRouter } from '../routes/systemSettingsRoutes';
import { authMiddleware, createToken } from '../auth/authManager';
import {
  WhatsAppStickyButton,
  DEFAULT_WHATSAPP_CONFIG,
  buildWhatsAppChatUrl,
  sanitizeWhatsAppConfig
} from '../../src/components/WhatsAppStickyButton';
import {
  AdminWhatsAppManager,
  LEGACY_WHATSAPP_GROUP_LINK_KEY,
  resolveInitialWhatsAppFormData,
  syncWhatsAppFormWithConfig,
  runLegacyGroupMigration,
  executeRestoreWhatsAppDefaults,
  canShowLegacyMigrationRetry,
  getStoredValidLegacyGroupLink,
  LegacyMigrationStatus
} from '../../src/components/admin/AdminWhatsAppManager';

function getDataSnapshot(): Record<string, string> {
  const dataDir = path.resolve(process.cwd(), 'data');
  const map: Record<string, string> = {};
  if (!fs.existsSync(dataDir)) return map;
  for (const file of fs.readdirSync(dataDir)) {
    if (file.endsWith('.json')) {
      map[file] = crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(dataDir, file)))
        .digest('hex');
    }
  }
  return map;
}

function getFileSha256(relPath: string): string {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.resolve(process.cwd(), relPath)))
    .digest('hex');
}

async function runTests() {
  console.log('==================================================================');
  console.log('   STEP-C.3: WHATSAPP SAFETY, DEFAULTS & AUTHORITY TEST SUITE     ');
  console.log('==================================================================');

  const preData = getDataSnapshot();
  const preMongoHash = getFileSha256('server/db/mongodb.ts');

  let passed = 0;
  let failed = 0;

  async function runTest(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      passed++;
      console.log(`✓ [PASS] ${name}`);
    } catch (err: any) {
      failed++;
      console.error(`✗ [FAIL] ${name}: ${err?.message || err}`);
    }
  }

  const originalGetUserByIdAsync = UserRepository.getByIdAsync;
  const originalAuditAdd = AuditRepository.add;
  const originalGetFlags = FeatureFlagsRepository.getFlags;
  const originalSaveSetting = SystemSettingsRepository.saveSetting;

  const adminUser = { id: 'wa-admin-1', name: 'WA Settings Admin', email: 'wa-admin@hybridjobs.pk', role: 'Super Admin' };
  const viewerUser = { id: 'wa-viewer-1', name: 'Job Seeker', email: 'seeker@hybridjobs.pk', role: 'Job Seeker' };

  UserRepository.getByIdAsync = async (id: string) => {
    if (id === adminUser.id) return adminUser;
    if (id === viewerUser.id) return viewerUser;
    return null;
  };
  AuditRepository.add = async (entry: any) => entry;

  let mockedFlags = { ...DEFAULT_FEATURE_FLAGS, enableEmailAlerts: true, enableWhatsAppAlerts: false };
  FeatureFlagsRepository.getFlags = async () => ({ ...mockedFlags });

  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use('/api/system-settings', systemSettingsRouter);

  const server: Server = await new Promise((resolve) => {
    const s = createServer(app);
    s.listen(0, '127.0.0.1', () => resolve(s));
  });

  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/system-settings/communication`;
  const adminToken = createToken({ userId: adminUser.id, email: adminUser.email, role: adminUser.role });
  const viewerToken = createToken({ userId: viewerUser.id, email: viewerUser.email, role: viewerUser.role });

  try {
    await runTest('1. Safe backend defaults are disabled with blank phoneNumber and blank groupLink', async () => {
      resetSystemSettingsTestStore();
      assert.strictEqual(DEFAULT_WHATSAPP_SUPPORT_CONFIG.enabled, false);
      assert.strictEqual(DEFAULT_WHATSAPP_SUPPORT_CONFIG.phoneNumber, '');
      assert.strictEqual(DEFAULT_WHATSAPP_SUPPORT_CONFIG.groupLink, '');
      assert.ok(DEFAULT_WHATSAPP_SUPPORT_CONFIG.agentName.length > 0);
      assert.ok(DEFAULT_WHATSAPP_SUPPORT_CONFIG.defaultMessage.length > 0);

      const loaded = await SystemSettingsRepository.getWhatsAppSupportConfig();
      assert.strictEqual(loaded.enabled, false);
      assert.strictEqual(loaded.phoneNumber, '');
      assert.strictEqual(loaded.groupLink, '');

      const res = await fetch(baseUrl);
      assert.strictEqual(res.status, 200, 'GET /communication must remain publicly accessible');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.whatsAppSupportConfig.enabled, false);
      assert.strictEqual(data.whatsAppSupportConfig.phoneNumber, '');
      assert.strictEqual(data.whatsAppSupportConfig.groupLink, '');
      assert.strictEqual(data.channelAvailability.email, true);
      assert.strictEqual(data.channelAvailability.whatsapp, false);
    });

    await runTest('2. Known sample phone numbers are sanitized on read and rejected on PUT with HTTP 400', async () => {
      resetSystemSettingsTestStore();
      // Simulate legacy stored sample document
      await SystemSettingsRepository.saveSetting('whats_app_support_config', {
        ...DEFAULT_WHATSAPP_SUPPORT_CONFIG,
        enabled: true,
        phoneNumber: '923001234567',
        agentName: 'Legacy Custom Advisor'
      });

      const sanitized = await SystemSettingsRepository.getWhatsAppSupportConfig();
      assert.strictEqual(sanitized.phoneNumber, '');
      assert.strictEqual(sanitized.enabled, false, 'Sample number must force effective enabled=false');
      assert.strictEqual(sanitized.agentName, 'Legacy Custom Advisor');

      const getRes = await fetch(baseUrl);
      const getData = await getRes.json();
      assert.strictEqual(getData.whatsAppSupportConfig.phoneNumber, '');
      assert.strictEqual(getData.whatsAppSupportConfig.enabled, false);

      for (const samplePhone of ['923001234567', '+92 300 1234567', '03001234567', '923219876543', '0000000000']) {
        const putRes = await fetch(baseUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({
            whatsAppSupportConfig: { enabled: true, phoneNumber: samplePhone }
          })
        });
        assert.strictEqual(putRes.status, 400, `Sample phone "${samplePhone}" must be rejected with HTTP 400`);
      }
    });

    await runTest('3. Known sample groupLink is sanitized on read and rejected on PUT with HTTP 400', async () => {
      resetSystemSettingsTestStore();
      await SystemSettingsRepository.saveSetting('whats_app_support_config', {
        ...DEFAULT_WHATSAPP_SUPPORT_CONFIG,
        enabled: true,
        phoneNumber: '923115559988',
        groupLink: 'https://chat.whatsapp.com/sampleCareerPakCommunity'
      });

      const loaded = await SystemSettingsRepository.getWhatsAppSupportConfig();
      assert.strictEqual(loaded.groupLink, '');
      assert.strictEqual(loaded.phoneNumber, '923115559988', 'Valid phone must survive groupLink sanitization');
      assert.strictEqual(loaded.enabled, true);

      const putRes = await fetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          whatsAppSupportConfig: {
            enabled: false,
            phoneNumber: '',
            groupLink: 'https://chat.whatsapp.com/sampleCareerPakCommunity'
          }
        })
      });
      assert.strictEqual(putRes.status, 400);
    });

    await runTest('4. Valid admin-configured international phone number is saved and preserved via PUT & GET', async () => {
      resetSystemSettingsTestStore();

      // Verify RBAC remains enforced on PUT
      const unauthRes = await fetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsAppSupportConfig: { enabled: true, phoneNumber: '923118889900' } })
      });
      assert.strictEqual(unauthRes.status, 401);

      const forbiddenRes = await fetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerToken}` },
        body: JSON.stringify({ whatsAppSupportConfig: { enabled: true, phoneNumber: '923118889900' } })
      });
      assert.strictEqual(forbiddenRes.status, 403);

      const putRes = await fetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          whatsAppSupportConfig: {
            enabled: true,
            phoneNumber: '+92 311 8889900',
            agentName: 'Sana (Verified Support)',
            position: 'bottom-left'
          }
        })
      });
      assert.strictEqual(putRes.status, 200);
      const putData = await putRes.json();
      assert.strictEqual(putData.success, true);
      assert.strictEqual(putData.whatsAppSupportConfig.phoneNumber, '923118889900');
      assert.strictEqual(putData.whatsAppSupportConfig.enabled, true);
      assert.strictEqual(putData.whatsAppSupportConfig.agentName, 'Sana (Verified Support)');
      assert.strictEqual(putData.whatsAppSupportConfig.position, 'bottom-left');

      const getRes = await fetch(baseUrl);
      const getData = await getRes.json();
      assert.strictEqual(getData.whatsAppSupportConfig.phoneNumber, '923118889900');
      assert.strictEqual(getData.whatsAppSupportConfig.enabled, true);
    });

    await runTest('5. Valid admin-configured groupLink is preserved and blank groupLink is accepted', async () => {
      const validGroup = 'https://chat.whatsapp.com/RealHybridAlertsInvite2026';
      const putValid = await fetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          whatsAppSupportConfig: { groupLink: validGroup }
        })
      });
      assert.strictEqual(putValid.status, 200);
      const validData = await putValid.json();
      assert.strictEqual(validData.whatsAppSupportConfig.groupLink, validGroup);
      assert.strictEqual(validData.whatsAppSupportConfig.phoneNumber, '923118889900', 'Partial PUT preserves valid phone');

      const putBlank = await fetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          whatsAppSupportConfig: { groupLink: '' }
        })
      });
      assert.strictEqual(putBlank.status, 200);
      const blankData = await putBlank.json();
      assert.strictEqual(blankData.whatsAppSupportConfig.groupLink, '');
    });

    await runTest('6. enabled=true without valid phone number is rejected with HTTP 400', async () => {
      resetSystemSettingsTestStore();
      for (const badPhone of ['', '   ', 'abc12345', '1234', '03115559988']) {
        const res = await fetch(baseUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({
            whatsAppSupportConfig: { enabled: true, phoneNumber: badPhone }
          })
        });
        assert.strictEqual(res.status, 400, `enabled=true with phone "${badPhone}" must return HTTP 400`);
      }

      // Partial PUT with enabled=true when stored phone is blank must also reject with 400
      const partialRes = await fetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ whatsAppSupportConfig: { enabled: true } })
      });
      assert.strictEqual(partialRes.status, 400);

      // Wrong type for phoneNumber rejected
      const wrongTypeRes = await fetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ whatsAppSupportConfig: { enabled: false, phoneNumber: 923118889900 } })
      });
      assert.strictEqual(wrongTypeRes.status, 400);
    });

    await runTest('7. enabled=false with blank phoneNumber is accepted (HTTP 200)', async () => {
      resetSystemSettingsTestStore();
      const res = await fetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          whatsAppSupportConfig: { enabled: false, phoneNumber: '', groupLink: '' }
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.whatsAppSupportConfig.enabled, false);
      assert.strictEqual(data.whatsAppSupportConfig.phoneNumber, '');
    });

    await runTest('8. Invalid groupLink formats are rejected with HTTP 400', async () => {
      const invalidLinks = [
        'http://chat.whatsapp.com/RealCode123',
        'https://whatsapp.com/RealCode123',
        'https://evil.example.com/chat.whatsapp.com/RealCode123',
        'https://chat.whatsapp.com/',
        'not-a-url',
        12345 as any
      ];
      for (const badLink of invalidLinks) {
        const res = await fetch(baseUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({
            whatsAppSupportConfig: { enabled: false, phoneNumber: '', groupLink: badLink }
          })
        });
        assert.strictEqual(res.status, 400, `Invalid groupLink "${badLink}" must return HTTP 400`);
      }
    });

    await runTest('9. MongoDB save failure returns HTTP 500 and never reports success', async () => {
      SystemSettingsRepository.saveSetting = async () => {
        throw new Error('Simulated MongoDB write failure');
      };
      try {
        const res = await fetch(baseUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({
            whatsAppSupportConfig: { enabled: true, phoneNumber: '923118889900' }
          })
        });
        assert.strictEqual(res.status, 500);
        const data = await res.json();
        assert.strictEqual(data.success, false);
      } finally {
        SystemSettingsRepository.saveSetting = originalSaveSetting;
      }
    });

    await runTest('10. Sticky widget does not render or construct wa.me link without valid configured number', () => {
      assert.strictEqual(buildWhatsAppChatUrl(''), null);
      assert.strictEqual(buildWhatsAppChatUrl('923001234567'), null);
      assert.strictEqual(buildWhatsAppChatUrl('invalid'), null);
      assert.ok(buildWhatsAppChatUrl('923118889900', 'Hi')?.startsWith('https://wa.me/923118889900?text='));

      const defaultHtml = renderToStaticMarkup(React.createElement(WhatsAppStickyButton));
      assert.strictEqual(defaultHtml, '', 'Default unconfigured sticky button must render nothing');

      const sampleEnabledHtml = renderToStaticMarkup(
        React.createElement(WhatsAppStickyButton, {
          config: { ...DEFAULT_WHATSAPP_CONFIG, enabled: true, phoneNumber: '923001234567' }
        })
      );
      assert.strictEqual(sampleEnabledHtml, '', 'Sample number must render no sticky button even if enabled=true');

      const blankEnabledHtml = renderToStaticMarkup(
        React.createElement(WhatsAppStickyButton, {
          config: { ...DEFAULT_WHATSAPP_CONFIG, enabled: true, phoneNumber: '' }
        })
      );
      assert.strictEqual(blankEnabledHtml, '', 'Blank number must render no sticky button even if enabled=true');

      const validHtml = renderToStaticMarkup(
        React.createElement(WhatsAppStickyButton, {
          config: {
            ...DEFAULT_WHATSAPP_CONFIG,
            enabled: true,
            phoneNumber: '923118889900',
            agentName: 'Sana Advisor',
            position: 'bottom-left'
          }
        })
      );
      assert.ok(validHtml.includes('whatsapp-sticky-button'), 'Valid active config must render sticky button');
    });

    await runTest('11. AdminWhatsAppManager safe defaults, disabled test links when blank, and valid config display', () => {
      assert.strictEqual(DEFAULT_WHATSAPP_CONFIG.enabled, false);
      assert.strictEqual(DEFAULT_WHATSAPP_CONFIG.phoneNumber, '');
      assert.strictEqual(DEFAULT_WHATSAPP_CONFIG.groupLink, '');

      const blankAdminHtml = renderToStaticMarkup(
        React.createElement(AdminWhatsAppManager, {
          config: DEFAULT_WHATSAPP_CONFIG,
          onUpdateConfig: async () => true
        })
      );
      assert.strictEqual(blankAdminHtml.includes('923001234567'), false, 'Admin UI must never render sample phone');
      assert.strictEqual(blankAdminHtml.includes('sampleCareerPakCommunity'), false, 'Admin UI must never render sample group link');
      assert.strictEqual(blankAdminHtml.includes('https://wa.me/'), false, 'Test chat wa.me links must be disabled when blank');
      assert.ok(blankAdminHtml.includes('No valid WhatsApp number configured'), 'Live preview must show safe unconfigured state');

      const validAdminHtml = renderToStaticMarkup(
        React.createElement(AdminWhatsAppManager, {
          config: {
            ...DEFAULT_WHATSAPP_CONFIG,
            enabled: true,
            phoneNumber: '923118889900',
            groupLink: 'https://chat.whatsapp.com/RealHybridAlertsInvite2026'
          },
          onUpdateConfig: async () => true
        })
      );
      assert.ok(validAdminHtml.includes('923118889900'), 'Saved valid phone must remain visible in Admin UI');
      assert.ok(validAdminHtml.includes('https://wa.me/923118889900'), 'Valid config enables Test Chat wa.me link');
      assert.ok(validAdminHtml.includes('https://chat.whatsapp.com/RealHybridAlertsInvite2026'), 'Saved valid group link preserved');

      // Verify App.tsx has no hardcoded sample number & enforces backend authority + 4-part sticky gate
      const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
      assert.strictEqual(appSrc.includes('923001234567'), false, 'App.tsx must not contain sample number fallback');
      assert.ok(appSrc.includes('sanitizeWhatsAppConfig(res.whatsAppSupportConfig)'));
      assert.ok(appSrc.includes('isValidWhatsAppPhone(whatsAppSupportConfig.phoneNumber)'));
    });

    await runTest('12. Existing widget customization values survive safe-default normalization', () => {
      const customRaw = {
        enabled: true,
        phoneNumber: '923001234567', // sample should be sanitized out
        groupLink: 'https://chat.whatsapp.com/sampleCareerPakCommunity', // sample should be sanitized out
        agentName: 'Zara (Lead Recruiter)',
        supportHoursText: 'Online • 24/7 Support',
        defaultMessage: 'Custom prefilled career query',
        position: 'bottom-left' as const,
        showGreetingBubble: false,
        greetingText: 'Custom greeting copy',
        greetingCtaText: 'Message Team Now',
        mobileSize: 'compact' as const,
        desktopSize: 'large' as const,
        iconSize: 'large' as const,
        bubbleSize: 'compact' as const,
        autoShowDelaySeconds: 12,
        showOnlineBadge: false,
        enablePulseAnimation: false
      };

      const backendNormalized = sanitizeWhatsAppSupportConfig(customRaw);
      const frontendNormalized = sanitizeWhatsAppConfig(customRaw);

      for (const normalized of [backendNormalized, frontendNormalized]) {
        assert.strictEqual(normalized.enabled, false);
        assert.strictEqual(normalized.phoneNumber, '');
        assert.strictEqual(normalized.groupLink, '');
        assert.strictEqual(normalized.agentName, 'Zara (Lead Recruiter)');
        assert.strictEqual(normalized.supportHoursText, 'Online • 24/7 Support');
        assert.strictEqual(normalized.defaultMessage, 'Custom prefilled career query');
        assert.strictEqual(normalized.position, 'bottom-left');
        assert.strictEqual(normalized.showGreetingBubble, false);
        assert.strictEqual(normalized.greetingText, 'Custom greeting copy');
        assert.strictEqual(normalized.greetingCtaText, 'Message Team Now');
        assert.strictEqual(normalized.mobileSize, 'compact');
        assert.strictEqual(normalized.desktopSize, 'large');
        assert.strictEqual(normalized.iconSize, 'large');
        assert.strictEqual(normalized.bubbleSize, 'compact');
        assert.strictEqual(normalized.autoShowDelaySeconds, 12);
        assert.strictEqual(normalized.showOnlineBadge, false);
        assert.strictEqual(normalized.enablePulseAnimation, false);
      }
    });

    await runTest('13. Email and WhatsApp channelAvailability remain independent on GET /communication', async () => {
      mockedFlags = { ...DEFAULT_FEATURE_FLAGS, enableEmailAlerts: true, enableWhatsAppAlerts: false };
      let res = await fetch(baseUrl);
      let data = await res.json();
      assert.strictEqual(data.channelAvailability.email, true);
      assert.strictEqual(data.channelAvailability.whatsapp, false);

      mockedFlags = { ...DEFAULT_FEATURE_FLAGS, enableEmailAlerts: false, enableWhatsAppAlerts: true };
      res = await fetch(baseUrl);
      data = await res.json();
      assert.strictEqual(data.channelAvailability.email, false);
      assert.strictEqual(data.channelAvailability.whatsapp, true);
    });

    await runTest('14. Restore Defaults clears legacy LocalStorage and prevents re-import on prop updates or remount', async () => {
      const mongoLink = 'https://chat.whatsapp.com/MongoActiveInvite1';
      const legacyLink = 'https://chat.whatsapp.com/LegacyStoredInvite2';

      const memStorage = new Map<string, string>();
      const prevLocalStorage = (globalThis as any).localStorage;
      (globalThis as any).localStorage = {
        getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
        setItem: (k: string, v: string) => {
          memStorage.set(k, String(v));
        },
        removeItem: (k: string) => {
          memStorage.delete(k);
        }
      };

      try {
        memStorage.set(LEGACY_WHATSAPP_GROUP_LINK_KEY, legacyLink);
        let currentMongoConfig = {
          ...DEFAULT_WHATSAPP_CONFIG,
          enabled: true,
          phoneNumber: '923118889900',
          groupLink: mongoLink
        };

        let formData = resolveInitialWhatsAppFormData(currentMongoConfig);
        assert.strictEqual(formData.groupLink, mongoLink, 'MongoDB groupLink must take priority on initial load');

        const setFormData: any = (updater: any) => {
          formData = typeof updater === 'function' ? updater(formData) : updater;
        };
        let saveError: string | null = null;
        let isSaving = false;
        let savedSuccess = false;
        const hasAttemptedMigrationRef = { current: false };
        const isRestoringDefaultsRef = { current: false };

        let updateCalls: any[] = [];
        const onUpdateConfig = async (payload: any) => {
          updateCalls.push(payload);
          const putRes = await fetch(baseUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ whatsAppSupportConfig: payload })
          });
          const data = await putRes.json();
          if (putRes.ok && data?.success) {
            currentMongoConfig = data.whatsAppSupportConfig;
            // Simulate immediate parent prop sync during await
            formData = syncWhatsAppFormWithConfig(formData, currentMongoConfig, hasAttemptedMigrationRef.current);
            await runLegacyGroupMigration({
              config: currentMongoConfig,
              hasAttemptedMigrationRef,
              isRestoringDefaultsRef,
              onUpdateConfig,
              setFormData
            });
          }
          return data;
        };

        // Initial migration effect must NOT overwrite existing MongoDB group link
        const migratedInitial = await runLegacyGroupMigration({
          config: currentMongoConfig,
          hasAttemptedMigrationRef,
          isRestoringDefaultsRef,
          onUpdateConfig,
          setFormData
        });
        assert.strictEqual(migratedInitial, false);
        assert.strictEqual(updateCalls.length, 0);
        assert.strictEqual(memStorage.get(LEGACY_WHATSAPP_GROUP_LINK_KEY), legacyLink);

        // Admin restores defaults
        const restored = await executeRestoreWhatsAppDefaults({
          onUpdateConfig,
          hasAttemptedMigrationRef,
          isRestoringDefaultsRef,
          setFormData,
          setSaveError: (v: any) => { saveError = typeof v === 'function' ? v(saveError) : v; },
          setIsSaving: (v: any) => { isSaving = typeof v === 'function' ? v(isSaving) : v; },
          setSavedSuccess: (v: any) => { savedSuccess = typeof v === 'function' ? v(savedSuccess) : v; }
        });

        assert.strictEqual(restored, true);
        assert.strictEqual(saveError, null);
        assert.strictEqual(isSaving, false);
        assert.strictEqual(savedSuccess, true);
        assert.strictEqual(updateCalls.length, 1, 'Only the Restore Defaults PUT should execute');
        assert.strictEqual(memStorage.has(LEGACY_WHATSAPP_GROUP_LINK_KEY), false, 'Legacy LocalStorage key must be cleared');
        assert.strictEqual(hasAttemptedMigrationRef.current, true);
        assert.deepStrictEqual(formData, DEFAULT_WHATSAPP_CONFIG);
        assert.strictEqual(currentMongoConfig.enabled, false);
        assert.strictEqual(currentMongoConfig.phoneNumber, '');
        assert.strictEqual(currentMongoConfig.groupLink, '');

        // Subsequent prop updates must NOT re-import legacy link
        formData = syncWhatsAppFormWithConfig(formData, currentMongoConfig, hasAttemptedMigrationRef.current);
        const migratedAfterUpdate = await runLegacyGroupMigration({
          config: currentMongoConfig,
          hasAttemptedMigrationRef,
          isRestoringDefaultsRef,
          onUpdateConfig,
          setFormData
        });
        assert.strictEqual(migratedAfterUpdate, false);
        assert.strictEqual(updateCalls.length, 1);

        // Component remount after restore must remain blank & disabled
        const remountHasAttempted = { current: false };
        const remountIsRestoring = { current: false };
        let remountFormData = resolveInitialWhatsAppFormData(currentMongoConfig);
        const migratedOnRemount = await runLegacyGroupMigration({
          config: currentMongoConfig,
          hasAttemptedMigrationRef: remountHasAttempted,
          isRestoringDefaultsRef: remountIsRestoring,
          onUpdateConfig,
          setFormData: (u: any) => {
            remountFormData = typeof u === 'function' ? u(remountFormData) : u;
          }
        });
        assert.strictEqual(migratedOnRemount, false);
        assert.strictEqual(remountFormData.enabled, false);
        assert.strictEqual(remountFormData.phoneNumber, '');
        assert.strictEqual(remountFormData.groupLink, '');
        assert.strictEqual(updateCalls.length, 1);

        const remountHtml = renderToStaticMarkup(
          React.createElement(AdminWhatsAppManager, {
            config: currentMongoConfig,
            onUpdateConfig: async () => true
          })
        );
        assert.strictEqual(remountHtml.includes(legacyLink), false);
        assert.strictEqual(remountHtml.includes(mongoLink), false);
      } finally {
        if (prevLocalStorage === undefined) {
          delete (globalThis as any).localStorage;
        } else {
          (globalThis as any).localStorage = prevLocalStorage;
        }
      }
    });

    await runTest('15. Failed Restore Defaults retains legacy LocalStorage, preserves form values, and keeps migration uncompleted', async () => {
      const legacyLink = 'https://chat.whatsapp.com/LegacyRetainedOnFailure';
      const activeMongoLink = 'https://chat.whatsapp.com/ActiveMongoOnFailure';

      const memStorage = new Map<string, string>();
      const prevLocalStorage = (globalThis as any).localStorage;
      (globalThis as any).localStorage = {
        getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
        setItem: (k: string, v: string) => { memStorage.set(k, String(v)); },
        removeItem: (k: string) => { memStorage.delete(k); }
      };

      try {
        memStorage.set(LEGACY_WHATSAPP_GROUP_LINK_KEY, legacyLink);
        const initialConfig = {
          ...DEFAULT_WHATSAPP_CONFIG,
          enabled: true,
          phoneNumber: '923118889900',
          groupLink: activeMongoLink
        };

        for (const failMode of ['false_response', 'rejected_promise'] as const) {
          let formData = resolveInitialWhatsAppFormData(initialConfig);
          let saveError: string | null = null;
          let isSaving = false;
          let savedSuccess = false;
          const hasAttemptedMigrationRef = { current: false };
          const isRestoringDefaultsRef = { current: false };

          const ok = await executeRestoreWhatsAppDefaults({
            onUpdateConfig: async () => {
              if (failMode === 'rejected_promise') {
                throw new Error('Simulated backend outage');
              }
              return { success: false };
            },
            hasAttemptedMigrationRef,
            isRestoringDefaultsRef,
            setFormData: (u: any) => { formData = typeof u === 'function' ? u(formData) : u; },
            setSaveError: (v: any) => { saveError = typeof v === 'function' ? v(saveError) : v; },
            setIsSaving: (v: any) => { isSaving = typeof v === 'function' ? v(isSaving) : v; },
            setSavedSuccess: (v: any) => { savedSuccess = typeof v === 'function' ? v(savedSuccess) : v; }
          });

          assert.strictEqual(ok, false);
          assert.strictEqual(savedSuccess, false);
          assert.strictEqual(isSaving, false);
          assert.strictEqual(isRestoringDefaultsRef.current, false);
          assert.ok(saveError && saveError.length > 0, `${failMode} must populate saveError`);
          assert.strictEqual(memStorage.get(LEGACY_WHATSAPP_GROUP_LINK_KEY), legacyLink, `${failMode} must retain legacy LocalStorage`);
          assert.strictEqual(hasAttemptedMigrationRef.current, false, `${failMode} must not mark migration completed`);
          assert.strictEqual(formData.groupLink, activeMongoLink, `${failMode} must preserve form groupLink`);
          assert.strictEqual(formData.phoneNumber, '923118889900', `${failMode} must preserve form phoneNumber`);
        }
      } finally {
        if (prevLocalStorage === undefined) {
          delete (globalThis as any).localStorage;
        } else {
          (globalThis as any).localStorage = prevLocalStorage;
        }
      }
    });

    await runTest('16. Normal legacy migration still works when unconfigured and admin can save a new valid group link after restore', async () => {
      resetSystemSettingsTestStore();
      const legacyLink = 'https://chat.whatsapp.com/LegacyValidMigrate2026';
      const newLinkAfterRestore = 'https://chat.whatsapp.com/BrandNewGroupInvite2026';

      const memStorage = new Map<string, string>();
      const prevLocalStorage = (globalThis as any).localStorage;
      (globalThis as any).localStorage = {
        getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
        setItem: (k: string, v: string) => { memStorage.set(k, String(v)); },
        removeItem: (k: string) => { memStorage.delete(k); }
      };

      try {
        memStorage.set(LEGACY_WHATSAPP_GROUP_LINK_KEY, legacyLink);
        let formData = resolveInitialWhatsAppFormData(DEFAULT_WHATSAPP_CONFIG);
        assert.strictEqual(formData.groupLink, legacyLink);

        const hasAttemptedMigrationRef = { current: false };
        const isRestoringDefaultsRef = { current: false };
        const onUpdateConfig = async (payload: any) => {
          const putRes = await fetch(baseUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ whatsAppSupportConfig: payload })
          });
          return putRes.json();
        };

        const migrated = await runLegacyGroupMigration({
          config: DEFAULT_WHATSAPP_CONFIG,
          hasAttemptedMigrationRef,
          isRestoringDefaultsRef,
          onUpdateConfig,
          setFormData: (u: any) => { formData = typeof u === 'function' ? u(formData) : u; }
        });
        assert.strictEqual(migrated, true, 'Normal legacy migration should succeed when MongoDB has no group link');
        assert.strictEqual(memStorage.has(LEGACY_WHATSAPP_GROUP_LINK_KEY), false, 'Legacy key cleared after confirmed migration');
        assert.strictEqual(formData.groupLink, legacyLink);

        // Now restore defaults and then save a new valid group link
        const restored = await executeRestoreWhatsAppDefaults({
          onUpdateConfig,
          hasAttemptedMigrationRef,
          isRestoringDefaultsRef,
          setFormData: (u: any) => { formData = typeof u === 'function' ? u(formData) : u; },
          setSaveError: () => {},
          setIsSaving: () => {},
          setSavedSuccess: () => {}
        });
        assert.strictEqual(restored, true);
        assert.strictEqual(formData.groupLink, '');

        const saveNewRes = await fetch(baseUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({
            whatsAppSupportConfig: {
              ...formData,
              enabled: true,
              phoneNumber: '923118889900',
              groupLink: newLinkAfterRestore
            }
          })
        });
        assert.strictEqual(saveNewRes.status, 200);
        const saveNewData = await saveNewRes.json();
        assert.strictEqual(saveNewData.whatsAppSupportConfig.groupLink, newLinkAfterRestore);
        assert.strictEqual(saveNewData.whatsAppSupportConfig.enabled, true);

        const postSaveHtml = renderToStaticMarkup(
          React.createElement(AdminWhatsAppManager, {
            config: saveNewData.whatsAppSupportConfig,
            onUpdateConfig: async () => true
          })
        );
        assert.ok(postSaveHtml.includes(newLinkAfterRestore));
      } finally {
        if (prevLocalStorage === undefined) {
          delete (globalThis as any).localStorage;
        } else {
          (globalThis as any).localStorage = prevLocalStorage;
        }
      }
    });

    await runTest('17. Failed, undefined, or malformed migration responses retain legacy LocalStorage, reset in-flight lock, and allow controlled retry', async () => {
      resetSystemSettingsTestStore();
      const legacyLink = 'https://chat.whatsapp.com/LegacyRetryAfterFailure1';

      const memStorage = new Map<string, string>();
      const prevLocalStorage = (globalThis as any).localStorage;
      (globalThis as any).localStorage = {
        getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
        setItem: (k: string, v: string) => { memStorage.set(k, String(v)); },
        removeItem: (k: string) => { memStorage.delete(k); }
      };

      try {
        const failureResponses: any[] = [
          false,
          { success: false, message: 'Temporary write failure' },
          undefined,
          { ok: true }
        ];

        for (const failValue of failureResponses) {
          resetSystemSettingsTestStore();
          memStorage.set(LEGACY_WHATSAPP_GROUP_LINK_KEY, legacyLink);

          let formData = resolveInitialWhatsAppFormData(DEFAULT_WHATSAPP_CONFIG);
          const hasAttemptedMigrationRef = { current: false };
          const isRestoringDefaultsRef = { current: false };
          const migrationInFlightRef = { current: false };

          let attemptCount = 0;
          const onUpdateConfig = async (payload: any) => {
            attemptCount++;
            if (attemptCount === 1) {
              return failValue;
            }
            const putRes = await fetch(baseUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
              body: JSON.stringify({ whatsAppSupportConfig: payload })
            });
            return putRes.json();
          };

          const firstAttempt = await runLegacyGroupMigration({
            config: DEFAULT_WHATSAPP_CONFIG,
            hasAttemptedMigrationRef,
            isRestoringDefaultsRef,
            migrationInFlightRef,
            onUpdateConfig,
            setFormData: (u: any) => { formData = typeof u === 'function' ? u(formData) : u; }
          });

          assert.strictEqual(firstAttempt, false, `First attempt with ${JSON.stringify(failValue)} must return false`);
          assert.strictEqual(attemptCount, 1);
          assert.strictEqual(hasAttemptedMigrationRef.current, false, 'Migration must not be marked completed before backend confirmation');
          assert.strictEqual(migrationInFlightRef.current, false, 'In-flight guard must be released after failure');
          assert.strictEqual(memStorage.get(LEGACY_WHATSAPP_GROUP_LINK_KEY), legacyLink, 'Legacy LocalStorage must remain intact after failure');

          // Controlled retry after transient failure must succeed
          const retryAttempt = await runLegacyGroupMigration({
            config: DEFAULT_WHATSAPP_CONFIG,
            hasAttemptedMigrationRef,
            isRestoringDefaultsRef,
            migrationInFlightRef,
            onUpdateConfig,
            setFormData: (u: any) => { formData = typeof u === 'function' ? u(formData) : u; }
          });

          assert.strictEqual(retryAttempt, true, 'Controlled retry must succeed');
          assert.strictEqual(attemptCount, 2);
          assert.strictEqual(hasAttemptedMigrationRef.current, true, 'Migration must be marked completed only after confirmed success');
          assert.strictEqual(migrationInFlightRef.current, false);
          assert.strictEqual(memStorage.has(LEGACY_WHATSAPP_GROUP_LINK_KEY), false, 'Legacy LocalStorage must be cleared after confirmed retry');
          assert.strictEqual(formData.groupLink, legacyLink);

          // Once completed, another call must be skipped
          const afterSuccessAttempt = await runLegacyGroupMigration({
            config: DEFAULT_WHATSAPP_CONFIG,
            hasAttemptedMigrationRef,
            isRestoringDefaultsRef,
            migrationInFlightRef,
            onUpdateConfig,
            setFormData: (u: any) => { formData = typeof u === 'function' ? u(formData) : u; }
          });
          assert.strictEqual(afterSuccessAttempt, false);
          assert.strictEqual(attemptCount, 2);
        }
      } finally {
        if (prevLocalStorage === undefined) {
          delete (globalThis as any).localStorage;
        } else {
          (globalThis as any).localStorage = prevLocalStorage;
        }
      }
    });

    await runTest('18. Rejected migration Promise retains legacy LocalStorage, releases lock, and allows later controlled retry', async () => {
      resetSystemSettingsTestStore();
      const legacyLink = 'https://chat.whatsapp.com/LegacyRetryAfterReject2';

      const memStorage = new Map<string, string>();
      const prevLocalStorage = (globalThis as any).localStorage;
      (globalThis as any).localStorage = {
        getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
        setItem: (k: string, v: string) => { memStorage.set(k, String(v)); },
        removeItem: (k: string) => { memStorage.delete(k); }
      };

      try {
        memStorage.set(LEGACY_WHATSAPP_GROUP_LINK_KEY, legacyLink);
        let formData = resolveInitialWhatsAppFormData(DEFAULT_WHATSAPP_CONFIG);
        const hasAttemptedMigrationRef = { current: false };
        const isRestoringDefaultsRef = { current: false };
        const migrationInFlightRef = { current: false };

        let callCount = 0;
        const onUpdateConfig = async (payload: any) => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Simulated network timeout');
          }
          const putRes = await fetch(baseUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ whatsAppSupportConfig: payload })
          });
          return putRes.json();
        };

        const firstResult = await runLegacyGroupMigration({
          config: DEFAULT_WHATSAPP_CONFIG,
          hasAttemptedMigrationRef,
          isRestoringDefaultsRef,
          migrationInFlightRef,
          onUpdateConfig,
          setFormData: (u: any) => { formData = typeof u === 'function' ? u(formData) : u; }
        });

        assert.strictEqual(firstResult, false);
        assert.strictEqual(callCount, 1);
        assert.strictEqual(hasAttemptedMigrationRef.current, false);
        assert.strictEqual(migrationInFlightRef.current, false);
        assert.strictEqual(memStorage.get(LEGACY_WHATSAPP_GROUP_LINK_KEY), legacyLink);

        const retryResult = await runLegacyGroupMigration({
          config: DEFAULT_WHATSAPP_CONFIG,
          hasAttemptedMigrationRef,
          isRestoringDefaultsRef,
          migrationInFlightRef,
          onUpdateConfig,
          setFormData: (u: any) => { formData = typeof u === 'function' ? u(formData) : u; }
        });

        assert.strictEqual(retryResult, true);
        assert.strictEqual(callCount, 2);
        assert.strictEqual(hasAttemptedMigrationRef.current, true);
        assert.strictEqual(migrationInFlightRef.current, false);
        assert.strictEqual(memStorage.has(LEGACY_WHATSAPP_GROUP_LINK_KEY), false);
        assert.strictEqual(formData.groupLink, legacyLink);
      } finally {
        if (prevLocalStorage === undefined) {
          delete (globalThis as any).localStorage;
        } else {
          (globalThis as any).localStorage = prevLocalStorage;
        }
      }
    });

    await runTest('19. Concurrent runLegacyGroupMigration calls execute only one in-flight request and release lock afterwards', async () => {
      const legacyLink = 'https://chat.whatsapp.com/LegacyConcurrentGuard3';

      const memStorage = new Map<string, string>();
      const prevLocalStorage = (globalThis as any).localStorage;
      (globalThis as any).localStorage = {
        getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
        setItem: (k: string, v: string) => { memStorage.set(k, String(v)); },
        removeItem: (k: string) => { memStorage.delete(k); }
      };

      try {
        // Case A: Explicit migrationInFlightRef — first fails, second concurrent is blocked, then later retry succeeds
        memStorage.set(LEGACY_WHATSAPP_GROUP_LINK_KEY, legacyLink);
        let formData = resolveInitialWhatsAppFormData(DEFAULT_WHATSAPP_CONFIG);
        const hasAttemptedMigrationRef = { current: false };
        const isRestoringDefaultsRef = { current: false };
        const migrationInFlightRef = { current: false };

        let resolvePending!: (val: any) => void;
        let callCount = 0;
        const onUpdateConfig = (payload: any) => {
          callCount++;
          if (callCount === 1) {
            return new Promise((resolve) => {
              resolvePending = resolve;
            });
          }
          return Promise.resolve({
            success: true,
            whatsAppSupportConfig: { ...DEFAULT_WHATSAPP_CONFIG, ...payload }
          });
        };

        const p1 = runLegacyGroupMigration({
          config: DEFAULT_WHATSAPP_CONFIG,
          hasAttemptedMigrationRef,
          isRestoringDefaultsRef,
          migrationInFlightRef,
          onUpdateConfig,
          setFormData: (u: any) => { formData = typeof u === 'function' ? u(formData) : u; }
        });

        // Allow p1 to reach the pending await
        await Promise.resolve();
        assert.strictEqual(migrationInFlightRef.current, true);

        const p2 = runLegacyGroupMigration({
          config: DEFAULT_WHATSAPP_CONFIG,
          hasAttemptedMigrationRef,
          isRestoringDefaultsRef,
          migrationInFlightRef,
          onUpdateConfig,
          setFormData: (u: any) => { formData = typeof u === 'function' ? u(formData) : u; }
        });

        assert.strictEqual(await p2, false, 'Concurrent second call must be blocked while first request is in flight');
        assert.strictEqual(callCount, 1, 'Only one backend request may run concurrently');

        resolvePending({ success: false });
        assert.strictEqual(await p1, false);
        assert.strictEqual(migrationInFlightRef.current, false, 'Lock must release after failure');
        assert.strictEqual(hasAttemptedMigrationRef.current, false);
        assert.strictEqual(memStorage.get(LEGACY_WHATSAPP_GROUP_LINK_KEY), legacyLink);

        // Retry after release succeeds
        const retryOk = await runLegacyGroupMigration({
          config: DEFAULT_WHATSAPP_CONFIG,
          hasAttemptedMigrationRef,
          isRestoringDefaultsRef,
          migrationInFlightRef,
          onUpdateConfig,
          setFormData: (u: any) => { formData = typeof u === 'function' ? u(formData) : u; }
        });
        assert.strictEqual(retryOk, true);
        assert.strictEqual(callCount, 2);
        assert.strictEqual(hasAttemptedMigrationRef.current, true);
        assert.strictEqual(migrationInFlightRef.current, false);
        assert.strictEqual(memStorage.has(LEGACY_WHATSAPP_GROUP_LINK_KEY), false);

        // Case B: Omitted migrationInFlightRef (WeakMap fallback keyed by hasAttemptedMigrationRef)
        memStorage.set(LEGACY_WHATSAPP_GROUP_LINK_KEY, legacyLink);
        const fallbackHasAttemptedRef = { current: false };
        let resolveFallbackPending!: (val: any) => void;
        let fallbackCalls = 0;
        const fallbackUpdate = (payload: any) => {
          fallbackCalls++;
          if (fallbackCalls === 1) {
            return new Promise((resolve) => {
              resolveFallbackPending = resolve;
            });
          }
          return Promise.resolve({
            success: true,
            whatsAppSupportConfig: { ...DEFAULT_WHATSAPP_CONFIG, ...payload }
          });
        };

        const fp1 = runLegacyGroupMigration({
          config: DEFAULT_WHATSAPP_CONFIG,
          hasAttemptedMigrationRef: fallbackHasAttemptedRef,
          onUpdateConfig: fallbackUpdate,
          setFormData: (u: any) => { formData = typeof u === 'function' ? u(formData) : u; }
        });
        await Promise.resolve();

        const fp2 = runLegacyGroupMigration({
          config: DEFAULT_WHATSAPP_CONFIG,
          hasAttemptedMigrationRef: fallbackHasAttemptedRef,
          onUpdateConfig: fallbackUpdate,
          setFormData: (u: any) => { formData = typeof u === 'function' ? u(formData) : u; }
        });
        assert.strictEqual(await fp2, false, 'Concurrent call without explicit migrationInFlightRef must still be blocked');
        assert.strictEqual(fallbackCalls, 1);

        resolveFallbackPending({ success: true, whatsAppSupportConfig: { ...DEFAULT_WHATSAPP_CONFIG, groupLink: legacyLink } });
        assert.strictEqual(await fp1, true);
        assert.strictEqual(fallbackHasAttemptedRef.current, true);
        assert.strictEqual(memStorage.has(LEGACY_WHATSAPP_GROUP_LINK_KEY), false);
      } finally {
        if (prevLocalStorage === undefined) {
          delete (globalThis as any).localStorage;
        } else {
          (globalThis as any).localStorage = prevLocalStorage;
        }
      }
    });

    await runTest('20. Controlled retry eligibility, lifecycle callbacks, and MongoDB priority stay synchronized', async () => {
      resetSystemSettingsTestStore();
      const legacyLink = 'https://chat.whatsapp.com/LegacyControlledRetry20';
      const mongoLink = 'https://chat.whatsapp.com/AuthoritativeMongo20';

      const memStorage = new Map<string, string>();
      const prevLocalStorage = (globalThis as any).localStorage;
      (globalThis as any).localStorage = {
        getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
        setItem: (k: string, v: string) => { memStorage.set(k, String(v)); },
        removeItem: (k: string) => { memStorage.delete(k); }
      };

      try {
        // 1. Absent or invalid/sample legacy keys never show retry or start migration
        assert.strictEqual(getStoredValidLegacyGroupLink(), '');
        assert.strictEqual(
          canShowLegacyMigrationRetry({
            config: DEFAULT_WHATSAPP_CONFIG,
            legacyLink: getStoredValidLegacyGroupLink(),
            migrationStatus: 'failed'
          }),
          false
        );

        for (const badLink of ['not-a-url', 'http://chat.whatsapp.com/InsecureLink', 'https://chat.whatsapp.com/samplecareerpakcommunity']) {
          memStorage.set(LEGACY_WHATSAPP_GROUP_LINK_KEY, badLink);
          assert.strictEqual(getStoredValidLegacyGroupLink(), '');
          assert.strictEqual(
            canShowLegacyMigrationRetry({
              config: DEFAULT_WHATSAPP_CONFIG,
              legacyLink: getStoredValidLegacyGroupLink(),
              migrationStatus: 'failed'
            }),
            false
          );
        }

        // 2. Valid legacy link -> failed migration triggers lifecycle callbacks & enables retry
        memStorage.set(LEGACY_WHATSAPP_GROUP_LINK_KEY, legacyLink);
        assert.strictEqual(getStoredValidLegacyGroupLink(), legacyLink);

        let formData = resolveInitialWhatsAppFormData(DEFAULT_WHATSAPP_CONFIG);
        const hasAttemptedMigrationRef = { current: false };
        const isRestoringDefaultsRef = { current: false };
        const migrationInFlightRef = { current: false };

        let status: LegacyMigrationStatus = 'idle';
        let migrationError: string | null = null;
        let finishEvents = 0;

        let shouldFail = true;
        let backendCalls = 0;
        const onUpdateConfig = async (payload: any) => {
          backendCalls++;
          if (shouldFail) {
            return { success: false, message: 'Simulated transient migration failure' };
          }
          const putRes = await fetch(baseUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ whatsAppSupportConfig: payload })
          });
          return putRes.json();
        };

        const runAttempt = (cfg: any) =>
          runLegacyGroupMigration({
            config: cfg,
            hasAttemptedMigrationRef,
            isRestoringDefaultsRef,
            migrationInFlightRef,
            onUpdateConfig,
            setFormData: (u: any) => { formData = typeof u === 'function' ? u(formData) : u; },
            onMigrationStart: () => {
              migrationError = null;
              status = 'in_flight';
            },
            onMigrationSuccess: () => {
              migrationError = null;
              status = 'succeeded';
            },
            onMigrationFailure: (msg) => {
              migrationError = msg;
              status = 'failed';
            },
            onMigrationFinish: () => {
              finishEvents++;
              if (status === 'in_flight') status = 'idle';
            }
          });

        assert.strictEqual(await runAttempt(DEFAULT_WHATSAPP_CONFIG), false);
        assert.strictEqual(backendCalls, 1);
        assert.strictEqual(status, 'failed');
        assert.strictEqual(finishEvents, 1);
        assert.strictEqual(migrationError, 'Simulated transient migration failure');
        assert.strictEqual(memStorage.get(LEGACY_WHATSAPP_GROUP_LINK_KEY), legacyLink);
        assert.strictEqual(
          canShowLegacyMigrationRetry({
            config: DEFAULT_WHATSAPP_CONFIG,
            legacyLink: getStoredValidLegacyGroupLink(),
            migrationStatus: status,
            hasAttemptedMigration: hasAttemptedMigrationRef.current
          }),
          true
        );

        // If valid MongoDB groupLink appears while retry is eligible, retry hides & never migrates/overwrites it
        const configWithMongo = { ...DEFAULT_WHATSAPP_CONFIG, groupLink: mongoLink };
        assert.strictEqual(
          canShowLegacyMigrationRetry({
            config: configWithMongo,
            legacyLink: getStoredValidLegacyGroupLink(),
            migrationStatus: status,
            hasAttemptedMigration: hasAttemptedMigrationRef.current
          }),
          false
        );
        assert.strictEqual(await runAttempt(configWithMongo), false);
        assert.strictEqual(backendCalls, 1, 'Valid MongoDB groupLink must block legacy migration');

        // Clicking retry when backend recovers succeeds & hides retry permanently
        shouldFail = false;
        assert.strictEqual(await runAttempt(DEFAULT_WHATSAPP_CONFIG), true);
        assert.strictEqual(backendCalls, 2);
        assert.strictEqual(status, 'succeeded');
        assert.strictEqual(migrationError, null);
        assert.strictEqual(hasAttemptedMigrationRef.current, true);
        assert.strictEqual(memStorage.has(LEGACY_WHATSAPP_GROUP_LINK_KEY), false);
        assert.strictEqual(formData.groupLink, legacyLink);
        assert.strictEqual(
          canShowLegacyMigrationRetry({
            config: DEFAULT_WHATSAPP_CONFIG,
            legacyLink: getStoredValidLegacyGroupLink(),
            migrationStatus: status,
            hasAttemptedMigration: hasAttemptedMigrationRef.current
          }),
          false
        );
      } finally {
        if (prevLocalStorage === undefined) {
          delete (globalThis as any).localStorage;
        } else {
          (globalThis as any).localStorage = prevLocalStorage;
        }
      }
    });

    await runTest('21. AdminWhatsAppManager SSR output exposes Retry Migration only when eligible and disables Restore Defaults while in flight', () => {
      const legacyLink = 'https://chat.whatsapp.com/LegacySsrComponent21';
      const mongoLink = 'https://chat.whatsapp.com/MongoSsrComponent21';

      const memStorage = new Map<string, string>();
      const prevLocalStorage = (globalThis as any).localStorage;
      (globalThis as any).localStorage = {
        getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
        setItem: (k: string, v: string) => { memStorage.set(k, String(v)); },
        removeItem: (k: string) => { memStorage.delete(k); }
      };

      try {
        // Note: React SSR renderToStaticMarkup verifies rendered component states without simulating browser DOM click/effect loops.
        // 1. Failed state + valid legacy key + empty Mongo groupLink -> Retry Migration button visible & enabled; Restore Defaults enabled
        memStorage.set(LEGACY_WHATSAPP_GROUP_LINK_KEY, legacyLink);
        const failedHtml = renderToStaticMarkup(
          React.createElement(AdminWhatsAppManager, {
            config: DEFAULT_WHATSAPP_CONFIG,
            onUpdateConfig: async () => false,
            initialMigrationStatus: 'failed',
            initialMigrationError: 'Server rejected migration'
          })
        );
        assert.ok(failedHtml.includes('data-testid="retry-legacy-migration-btn"'), 'Retry button must render after failed migration');
        assert.ok(failedHtml.includes('Retry Migration'));
        assert.ok(failedHtml.includes('Server rejected migration'));
        assert.ok(failedHtml.includes('data-testid="restore-whatsapp-defaults-btn"'));
        const restoreDisabledRegex = /<button[^>]*data-testid="restore-whatsapp-defaults-btn"[^>]*\sdisabled=""/;
        assert.strictEqual(restoreDisabledRegex.test(failedHtml), false, 'Restore button must be enabled after migration finishes');

        // 2. In-flight migration state -> Retry button hidden, in-flight banner shown, Restore Defaults visibly disabled
        const inFlightHtml = renderToStaticMarkup(
          React.createElement(AdminWhatsAppManager, {
            config: DEFAULT_WHATSAPP_CONFIG,
            onUpdateConfig: async () => true,
            initialMigrationStatus: 'in_flight'
          })
        );
        assert.strictEqual(inFlightHtml.includes('data-testid="retry-legacy-migration-btn"'), false, 'Retry button must hide while migration is in flight');
        assert.ok(inFlightHtml.includes('data-testid="legacy-migration-in-flight-banner"'));
        assert.ok(restoreDisabledRegex.test(inFlightHtml), 'Restore button must be disabled while migration is active');

        // 3. Valid MongoDB groupLink hides retry control even if legacy key exists
        const mongoPresentHtml = renderToStaticMarkup(
          React.createElement(AdminWhatsAppManager, {
            config: { ...DEFAULT_WHATSAPP_CONFIG, groupLink: mongoLink },
            onUpdateConfig: async () => true,
            initialMigrationStatus: 'failed'
          })
        );
        assert.strictEqual(mongoPresentHtml.includes('data-testid="retry-legacy-migration-btn"'), false);

        // 4. Succeeded or restored states hide retry control
        for (const terminalStatus of ['succeeded', 'restored'] as const) {
          const terminalHtml = renderToStaticMarkup(
            React.createElement(AdminWhatsAppManager, {
              config: DEFAULT_WHATSAPP_CONFIG,
              onUpdateConfig: async () => true,
              initialMigrationStatus: terminalStatus
            })
          );
          assert.strictEqual(terminalHtml.includes('data-testid="retry-legacy-migration-btn"'), false);
        }

        // 5. Absent or sample/invalid legacy keys hide retry control
        memStorage.delete(LEGACY_WHATSAPP_GROUP_LINK_KEY);
        const noKeyHtml = renderToStaticMarkup(
          React.createElement(AdminWhatsAppManager, {
            config: DEFAULT_WHATSAPP_CONFIG,
            onUpdateConfig: async () => false,
            initialMigrationStatus: 'failed'
          })
        );
        assert.strictEqual(noKeyHtml.includes('data-testid="retry-legacy-migration-btn"'), false);

        memStorage.set(LEGACY_WHATSAPP_GROUP_LINK_KEY, 'https://chat.whatsapp.com/samplecareerpakcommunity');
        const sampleKeyHtml = renderToStaticMarkup(
          React.createElement(AdminWhatsAppManager, {
            config: DEFAULT_WHATSAPP_CONFIG,
            onUpdateConfig: async () => false,
            initialMigrationStatus: 'failed'
          })
        );
        assert.strictEqual(sampleKeyHtml.includes('data-testid="retry-legacy-migration-btn"'), false);
      } finally {
        if (prevLocalStorage === undefined) {
          delete (globalThis as any).localStorage;
        } else {
          (globalThis as any).localStorage = prevLocalStorage;
        }
      }
    });

    await runTest('22. Bidirectional mutual exclusion between Migration and Restore Defaults blocks races and concurrent duplicates', async () => {
      resetSystemSettingsTestStore();
      const legacyLink = 'https://chat.whatsapp.com/LegacyMutualExclusion22';

      const memStorage = new Map<string, string>();
      const prevLocalStorage = (globalThis as any).localStorage;
      (globalThis as any).localStorage = {
        getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
        setItem: (k: string, v: string) => { memStorage.set(k, String(v)); },
        removeItem: (k: string) => { memStorage.delete(k); }
      };

      try {
        // PART A: Migration in flight blocks Restore Defaults (both explicit migrationInFlightRef and WeakMap fallback)
        memStorage.set(LEGACY_WHATSAPP_GROUP_LINK_KEY, legacyLink);
        const initialConfig = {
          ...DEFAULT_WHATSAPP_CONFIG,
          enabled: true,
          phoneNumber: '923118889900',
          groupLink: ''
        };
        let formData = { ...initialConfig, groupLink: legacyLink };
        const setFormData: any = (u: any) => { formData = typeof u === 'function' ? u(formData) : u; };
        const hasAttemptedMigrationRef = { current: false };
        const isRestoringDefaultsRef = { current: false };
        const migrationInFlightRef = { current: false };

        let saveError: string | null = null;
        let isSaving = false;
        let savedSuccess = false;

        let resolvePendingMigration!: (val: any) => void;
        let migrationBackendCalls = 0;
        const onUpdateConfig = (payload: any) => {
          migrationBackendCalls++;
          if (migrationBackendCalls === 1) {
            return new Promise((resolve) => {
              resolvePendingMigration = resolve;
            });
          }
          return fetch(baseUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ whatsAppSupportConfig: payload })
          }).then(r => r.json());
        };

        const pendingMigration = runLegacyGroupMigration({
          config: initialConfig,
          hasAttemptedMigrationRef,
          isRestoringDefaultsRef,
          migrationInFlightRef,
          onUpdateConfig,
          setFormData
        });
        await Promise.resolve();
        assert.strictEqual(migrationInFlightRef.current, true);

        // Attempt Restore Defaults while migration is in flight (with explicit ref)
        let onRestoreFailureCalled = false;
        const blockedRestore1 = await executeRestoreWhatsAppDefaults({
          onUpdateConfig,
          hasAttemptedMigrationRef,
          isRestoringDefaultsRef,
          migrationInFlightRef,
          setFormData,
          setSaveError: (v: any) => { saveError = typeof v === 'function' ? v(saveError) : v; },
          setIsSaving: (v: any) => { isSaving = typeof v === 'function' ? v(isSaving) : v; },
          setSavedSuccess: (v: any) => { savedSuccess = typeof v === 'function' ? v(savedSuccess) : v; },
          onRestoreFailure: () => { onRestoreFailureCalled = true; }
        });
        assert.strictEqual(blockedRestore1, false, 'Restore Defaults must be rejected while migration is in flight');
        assert.strictEqual(onRestoreFailureCalled, true);
        assert.ok(saveError && String(saveError).toLowerCase().includes('migration'));
        assert.strictEqual(migrationBackendCalls, 1, 'Blocked Restore Defaults must NOT call onUpdateConfig');
        assert.strictEqual(memStorage.get(LEGACY_WHATSAPP_GROUP_LINK_KEY), legacyLink, 'Blocked Restore must NOT remove LocalStorage');
        assert.strictEqual(formData.groupLink, legacyLink, 'Blocked Restore must NOT change formData');
        assert.strictEqual(formData.phoneNumber, '923118889900');
        assert.strictEqual(hasAttemptedMigrationRef.current, false, 'Blocked Restore must NOT mark migration completed');
        assert.strictEqual(isRestoringDefaultsRef.current, false);
        assert.strictEqual(isSaving, false);
        assert.strictEqual(savedSuccess, false);

        // Also blocked if caller omitted migrationInFlightRef (via WeakMap fallback)
        const blockedRestore2 = await executeRestoreWhatsAppDefaults({
          onUpdateConfig,
          hasAttemptedMigrationRef,
          isRestoringDefaultsRef,
          setFormData,
          setSaveError: (v: any) => { saveError = typeof v === 'function' ? v(saveError) : v; },
          setIsSaving: (v: any) => { isSaving = typeof v === 'function' ? v(isSaving) : v; },
          setSavedSuccess: (v: any) => { savedSuccess = typeof v === 'function' ? v(savedSuccess) : v; }
        });
        assert.strictEqual(blockedRestore2, false);
        assert.strictEqual(migrationBackendCalls, 1);

        // Finish migration with failure so lock releases, then Restore Defaults must succeed cleanly
        resolvePendingMigration({ success: false });
        assert.strictEqual(await pendingMigration, false);
        assert.strictEqual(migrationInFlightRef.current, false);

        let restoreSuccessCb = false;
        const restoreAfterMigration = await executeRestoreWhatsAppDefaults({
          onUpdateConfig,
          hasAttemptedMigrationRef,
          isRestoringDefaultsRef,
          migrationInFlightRef,
          setFormData,
          setSaveError: (v: any) => { saveError = typeof v === 'function' ? v(saveError) : v; },
          setIsSaving: (v: any) => { isSaving = typeof v === 'function' ? v(isSaving) : v; },
          setSavedSuccess: (v: any) => { savedSuccess = typeof v === 'function' ? v(savedSuccess) : v; },
          onRestoreSuccess: () => { restoreSuccessCb = true; }
        });
        assert.strictEqual(restoreAfterMigration, true, 'Restore Defaults must succeed once migration finishes');
        assert.strictEqual(restoreSuccessCb, true);
        assert.strictEqual(migrationBackendCalls, 2);
        assert.strictEqual(memStorage.has(LEGACY_WHATSAPP_GROUP_LINK_KEY), false);
        assert.strictEqual(hasAttemptedMigrationRef.current, true);
        assert.deepStrictEqual(formData, DEFAULT_WHATSAPP_CONFIG);

        // PART B: Restore Defaults in flight blocks concurrent duplicate Restore AND blocks Migration
        resetSystemSettingsTestStore();
        memStorage.set(LEGACY_WHATSAPP_GROUP_LINK_KEY, legacyLink);
        const rHasAttemptedRef = { current: false };
        const rIsRestoringRef = { current: false };
        const rMigrationInFlightRef = { current: false };
        let rFormData = { ...initialConfig, groupLink: legacyLink };
        const rSetFormData: any = (u: any) => { rFormData = typeof u === 'function' ? u(rFormData) : u; };

        let resolvePendingRestore!: (val: any) => void;
        let restoreCalls = 0;
        const slowRestoreUpdate = () => {
          restoreCalls++;
          return new Promise((resolve) => {
            resolvePendingRestore = resolve;
          });
        };

        const pRestore1 = executeRestoreWhatsAppDefaults({
          onUpdateConfig: slowRestoreUpdate,
          hasAttemptedMigrationRef: rHasAttemptedRef,
          isRestoringDefaultsRef: rIsRestoringRef,
          migrationInFlightRef: rMigrationInFlightRef,
          setFormData: rSetFormData,
          setSaveError: () => {},
          setIsSaving: () => {},
          setSavedSuccess: () => {}
        });
        await Promise.resolve();
        assert.strictEqual(rIsRestoringRef.current, true);

        // Duplicate Restore Defaults call must be blocked immediately
        const pRestore2 = await executeRestoreWhatsAppDefaults({
          onUpdateConfig: slowRestoreUpdate,
          hasAttemptedMigrationRef: rHasAttemptedRef,
          isRestoringDefaultsRef: rIsRestoringRef,
          migrationInFlightRef: rMigrationInFlightRef,
          setFormData: rSetFormData,
          setSaveError: () => {},
          setIsSaving: () => {},
          setSavedSuccess: () => {}
        });
        assert.strictEqual(pRestore2, false, 'Concurrent duplicate Restore Defaults must be blocked');

        // Migration during active Restore Defaults must also be blocked
        const blockedMigration = await runLegacyGroupMigration({
          config: DEFAULT_WHATSAPP_CONFIG,
          hasAttemptedMigrationRef: rHasAttemptedRef,
          isRestoringDefaultsRef: rIsRestoringRef,
          migrationInFlightRef: rMigrationInFlightRef,
          onUpdateConfig: slowRestoreUpdate,
          setFormData: rSetFormData
        });
        assert.strictEqual(blockedMigration, false, 'Migration must not start while Restore Defaults is active');
        assert.strictEqual(restoreCalls, 1, 'Only one backend write allowed while restore is active');

        // Complete pending restore as failure first -> preserves LocalStorage & formData & releases lock
        resolvePendingRestore({ success: false });
        assert.strictEqual(await pRestore1, false);
        assert.strictEqual(rIsRestoringRef.current, false);
        assert.strictEqual(memStorage.get(LEGACY_WHATSAPP_GROUP_LINK_KEY), legacyLink);
        assert.strictEqual(rFormData.phoneNumber, '923118889900');
        assert.strictEqual(rHasAttemptedRef.current, false);
      } finally {
        if (prevLocalStorage === undefined) {
          delete (globalThis as any).localStorage;
        } else {
          (globalThis as any).localStorage = prevLocalStorage;
        }
      }
    });

    await runTest('23. Protected files (server/db/mongodb.ts & data/*.json) remain byte-for-byte unchanged', () => {
      assert.strictEqual(getFileSha256('server/db/mongodb.ts'), preMongoHash);
      const postData = getDataSnapshot();
      assert.deepStrictEqual(Object.keys(postData).sort(), Object.keys(preData).sort());
      for (const k of Object.keys(preData)) {
        assert.strictEqual(postData[k], preData[k], `data/${k} must remain untouched`);
      }
    });
  } finally {
    UserRepository.getByIdAsync = originalGetUserByIdAsync;
    AuditRepository.add = originalAuditAdd;
    FeatureFlagsRepository.getFlags = originalGetFlags;
    SystemSettingsRepository.saveSetting = originalSaveSetting;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log(`\n=== STEP-C.3 WhatsApp Safety Test Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
