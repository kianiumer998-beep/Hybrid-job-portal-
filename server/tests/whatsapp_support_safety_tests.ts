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
import { AdminWhatsAppManager } from '../../src/components/admin/AdminWhatsAppManager';

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

    await runTest('14. Protected files (server/db/mongodb.ts & data/*.json) remain byte-for-byte unchanged', () => {
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
