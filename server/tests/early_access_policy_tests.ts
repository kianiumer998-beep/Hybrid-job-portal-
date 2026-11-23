process.env.IS_TEST = 'true';

import assert from 'node:assert/strict';

async function run() {
  const { isEarlyAccessJobLocked, buildEarlyAccessDisplayJob, getEarlyAccessLandingConfig } = await import('../services/earlyAccessPolicy');
  const config = {
    enabled: true,
    sourceTypes: ['scraped', 'user_posted'],
    durationHours: 24,
    showOnLanding: true,
    showJobCount: true,
    showCountdown: true,
    maxJobs: 5,
    displayFields: ['title', 'department'],
    showSource: true
  };
  const now = Date.parse('2026-11-23T12:00:00.000Z');
  const scraped = { id: 's1', title: 'Scraped role', isScraped: true, createdAt: '2026-11-23T00:00:00.000Z', department: 'MES', paymentStatus: 'private' };
  const userPosted = { id: 'u1', title: 'User role', submittedByUserId: 'user-1', createdAt: '2026-11-23T00:00:00.000Z' };
  const adminPosted = { id: 'a1', title: 'Admin role', isAdminCreated: true, createdAt: '2026-11-23T00:00:00.000Z' };

  assert.equal(isEarlyAccessJobLocked(scraped, config, now), true, 'selected scraped source is held during the early window');
  const approvedAfterPending = { id: 'u2', title: 'Approved user job', submittedByUserId: 'user-2', createdAt: '2026-11-20T00:00:00.000Z', verifiedDate: '2026-11-23T00:00:00.000Z' };
  assert.equal(isEarlyAccessJobLocked(approvedAfterPending, config, now), true, 'user job early-access window starts from approval verification, not initial submission');
  assert.equal(isEarlyAccessJobLocked(approvedAfterPending, config, Date.parse('2026-11-24T01:00:00.000Z')), false, 'user job becomes public 24 hours after approval verification');
  assert.equal(isEarlyAccessJobLocked(userPosted, config, now), true, 'selected user source is held during the early window');
  assert.equal(isEarlyAccessJobLocked(adminPosted, config, now), false, 'unselected admin source remains public');
  assert.equal(isEarlyAccessJobLocked(scraped, config, Date.parse('2026-11-24T00:00:00.000Z')), false, 'job becomes public after 24 hours');
  assert.equal(isEarlyAccessJobLocked(scraped, { ...config, enabled: false }, now), false, 'disabled policy does not hold jobs');
  assert.equal(isEarlyAccessJobLocked({ ...scraped, createdAt: 'invalid' }, config, now), true, 'selected source with invalid start time fails closed');

  const display = buildEarlyAccessDisplayJob(scraped, config);
  assert.deepEqual(Object.keys(display).sort(), ['department', 'earlyAccessEndsAt', 'id', 'sourceLabel', 'sourceType', 'title'].sort(), 'display payload includes only configured fields and approved metadata');
  assert.equal(display.paymentStatus, undefined, 'internal payment fields are never included in the landing payload');

  const landing = getEarlyAccessLandingConfig(config);
  assert.equal(landing.maxJobs, 5);
  assert.equal(landing.showCountdown, true);

  console.log('Premium early access policy tests passed (12 assertions).');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
