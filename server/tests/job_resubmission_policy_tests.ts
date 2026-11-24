process.env.IS_TEST = 'true';

import assert from 'node:assert/strict';

async function run() {
  // Import after setting test mode so repository persistence uses its local fallback.
  const { Database } = await import('../db/database');
  const { JobRepository } = await import('../db/repositories/JobRepository');

  const originalGetPendingJobs = Database.getPendingJobs;
  const originalSavePendingJobs = Database.savePendingJobs;
  let records: any[] = [];

  (Database as any).getPendingJobs = () => records;
  (Database as any).savePendingJobs = (next: any[]) => {
    records = next;
  };

  try {
    records = [{
      id: 'user-job-1',
      title: 'Original title',
      company: 'Example employer',
      description: 'Original description',
      status: 'Rejected',
      sourceType: 'user_posted',
      submittedByUserId: 'owner-1',
      rejectionReason: 'Please correct the salary details.',
      rejectedAt: '2026-11-23T10:00:00.000Z',
      resubmissionCount: 0,
      moderationHistory: [{ action: 'rejected', reason: 'Please correct the salary details.', at: '2026-11-23T10:00:00.000Z' }]
    }];

    const resubmitted = await JobRepository.resubmitRejectedPending(
      'user-job-1',
      'owner-1',
      {
        id: 'attacker-id',
        title: 'Corrected title',
        status: 'Approved',
        sourceType: 'scraped',
        submittedByUserId: 'attacker-user',
        rejectionReason: 'forged reason',
        resubmissionCount: 99,
        moderationHistory: [{ action: 'forged' }]
      },
      3
    );

    assert.equal(resubmitted.job?.status, 'Pending', 'resubmitted job always returns to Pending review');
    assert.equal(resubmitted.job?.title, 'Corrected title', 'owner-editable fields are applied');
    assert.equal(resubmitted.job?.id, 'user-job-1', 'client cannot replace the job ID');
    assert.equal(resubmitted.job?.submittedByUserId, 'owner-1', 'client cannot change job ownership');
    assert.equal(resubmitted.job?.sourceType, 'user_posted', 'client cannot change persisted source classification');
    assert.equal(resubmitted.job?.resubmissionCount, 1, 'resubmission attempt counter increments exactly once');
    assert.equal(resubmitted.job?.rejectionReason, '', 'current rejection reason clears after correction');
    assert.equal(resubmitted.job?.moderationHistory.length, 2, 'previous rejection history is retained and resubmission is appended');

    const wrongOwner = await JobRepository.resubmitRejectedPending('user-job-1', 'other-user', { title: 'Unauthorized' }, 3);
    assert.equal(wrongOwner.reason, 'not_found', 'a different user cannot resubmit another employer job');

    records = [{
      id: 'limit-job',
      status: 'Rejected',
      submittedByUserId: 'owner-1',
      resubmissionCount: 1,
      moderationHistory: []
    }];
    const limitReached = await JobRepository.resubmitRejectedPending('limit-job', 'owner-1', { title: 'Another try' }, 1);
    assert.equal(limitReached.reason, 'limit_reached', 'configured maximum attempt limit is enforced');

    records = [{ id: 'reject-job', status: 'Pending', submittedByUserId: 'owner-1', moderationHistory: [] }];
    const rejected = await JobRepository.rejectPending('reject-job', 'Correct the application link.', { name: 'Reviewer One', role: 'Job Moderator' });
    assert.equal(rejected, true, 'pending job can be rejected');
    assert.equal(records[0].status, 'Rejected', 'rejected job status is persisted');
    assert.equal(records[0].moderationHistory[0].actorName, 'Reviewer One', 'rejection history records the admin actor');

    records = [{ id: 'bulk-job', status: 'Pending', submittedByUserId: 'owner-1', moderationHistory: [] }];
    const bulk = await JobRepository.bulkRejectPending(['bulk-job'], 'Correct missing details.', { name: 'Reviewer Two', role: 'Admin' });
    assert.equal(bulk.successCount, 1, 'bulk rejection uses the same successful moderation path');
    assert.equal(records[0].moderationHistory[0].actorName, 'Reviewer Two', 'bulk rejection also records its admin actor');

    console.log('Job resubmission and moderation policy tests passed (15 assertions).');
  } finally {
    (Database as any).getPendingJobs = originalGetPendingJobs;
    (Database as any).savePendingJobs = originalSavePendingJobs;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
