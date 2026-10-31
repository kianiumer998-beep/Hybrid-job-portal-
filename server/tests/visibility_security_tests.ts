import { JobVisibilityRepository } from '../db/repositories/JobVisibilityRepository';
import { Job } from '../../src/types/job';

async function runTests() {
  console.log('--- Starting Visibility Security Tests ---');

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${message}`);
      failCount++;
    }
  }

  // Test Case 1: Redaction for Free User
  const mockJob: any = {
    title: 'Software Engineer',
    applicationUrl: 'https://example.com/apply',
    contactEmail: 'hr@example.com',
    attachments: [{ id: '1', name: 'Details.pdf', isPublic: true }],
    fieldVisibility: {
      applicationUrl: 'Premium',
      contactEmail: 'Premium',
      attachments: 'Premium'
    }
  };

  const filteredFree = JobVisibilityRepository.filterJobForUser(mockJob, { role: 'Job Seeker' }, false);
  assert(filteredFree.applicationUrl === '🔒 Unlock with Premium Subscription', 'applicationUrl redacted for free user');
  assert(filteredFree.contactEmail === '🔒 Unlock with Premium Subscription', 'contactEmail redacted for free user');
  assert(filteredFree.attachments.length === 0, 'attachments array emptied for free user');

  // Test Case 2: Access for Premium User
  const filteredPremium = JobVisibilityRepository.filterJobForUser(mockJob, { role: 'Job Seeker' }, true);
  assert(filteredPremium.applicationUrl === 'https://example.com/apply', 'applicationUrl visible for premium user');
  assert(filteredPremium.attachments.length === 1, 'attachments visible for premium user');

  // Test Case 3: Admin Bypass
  const filteredAdmin = JobVisibilityRepository.filterJobForUser(mockJob, { role: 'Admin' }, false);
  assert(filteredAdmin.applicationUrl === 'https://example.com/apply', 'Admin bypasses visibility rules');

  // Test Case 4: Hidden Field
  const hiddenJob: any = {
    title: 'Secret Job',
    salary: '100k',
    fieldVisibility: {
      salary: 'Hidden'
    }
  };
  const filteredHidden = JobVisibilityRepository.filterJobForUser(hiddenJob, { role: 'Job Seeker' }, true);
  assert(filteredHidden.salary === undefined, 'Hidden field is removed even for premium user');

  // Test Case 5: Attachment Privacy Preservation
  const mixedAttachmentsJob: any = {
    title: 'Job with Mixed Attachments',
    attachments: [
      { id: '1', name: 'Public.pdf', isPublic: true },
      { id: '2', name: 'Private.pdf', isPublic: false }
    ],
    fieldVisibility: {
      attachments: 'Free'
    }
  };
  const filteredMixed = JobVisibilityRepository.filterJobForUser(mixedAttachmentsJob, { role: 'Job Seeker' }, false);
  assert(filteredMixed.attachments.length === 1, 'Only public attachments preserved');
  assert(filteredMixed.attachments[0].name === 'Public.pdf', 'Private attachment filtered out independently');

  // Test Case 6: Registry Exhaustion
  const fullJob: any = {
    pdfCaseNumber: 'F.4-118/2026',
    fieldVisibility: {
      pdfCaseNumber: 'Premium'
    }
  };
  const filteredFull = JobVisibilityRepository.filterJobForUser(fullJob, { role: 'Job Seeker' }, false);
  assert(filteredFull.pdfCaseNumber === '🔒 [Premium Content - Upgrade to View]', 'Registry field pdfCaseNumber correctly redacted');

  console.log(`\nTests finished: ${passCount} PASSED, ${failCount} FAILED`);
  if (failCount > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test Execution Error:', err);
  process.exit(1);
});
