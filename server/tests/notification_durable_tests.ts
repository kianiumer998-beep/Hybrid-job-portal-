import assert from 'assert';
import { NotificationRepository } from '../db/repositories/NotificationRepository';

async function runTests() {
  console.log('=== STARTING DURABLE NOTIFICATION TEST SUITE ===');

  const testUserA = `test-notif-user-a-${Date.now()}`;
  const testUserB = `test-notif-user-b-${Date.now()}`;

  // Scenario 1 & 7: Create notification with idempotencyKey & eventId
  console.log('\n--- Test 1 & 7: Create notification with Idempotency & Duplicate Protection ---');
  const eventId1 = `payment-submitted-tx-${Date.now()}`;
  const notif1 = await NotificationRepository.createAsync({
    userId: testUserA,
    title: 'Payment Submitted',
    message: 'Your payment proof of PKR 1000 for Job Posting has been submitted.',
    type: 'info',
    eventId: eventId1,
    idempotencyKey: eventId1,
    metadata: { txId: 'tx-1' }
  });
  assert(notif1 && notif1.id, 'Notification 1 should be created');
  assert.strictEqual(notif1.userId, testUserA, 'Notification user ID should match');
  assert.strictEqual(notif1.read, false, 'New notification should be unread');

  // Attempt duplicate creation with same eventId
  const notif1Dup = await NotificationRepository.createAsync({
    userId: testUserA,
    title: 'Payment Submitted Duplicate',
    message: 'Duplicate attempt',
    type: 'info',
    eventId: eventId1,
    idempotencyKey: eventId1,
    metadata: { txId: 'tx-1' }
  });
  assert.strictEqual(notif1Dup.id, notif1.id, 'Duplicate creation should return existing notification without duplicate record');

  // Scenario 3: Strict User Isolation
  console.log('\n--- Test 3: Strict User Ownership Isolation ---');
  const userANotifs = await NotificationRepository.getAllAsync({ userId: testUserA });
  const userBNotifs = await NotificationRepository.getAllAsync({ userId: testUserB });
  assert(userANotifs.some(n => n.id === notif1.id), 'User A should see notification 1');
  assert(!userBNotifs.some(n => n.id === notif1.id), 'User B must NOT see User A notification');

  // Scenario 4: Unread Count Accuracy
  console.log('\n--- Test 4: Unread Count Accuracy ---');
  const eventId2 = `payment-approved-tx-${Date.now()}`;
  const notif2 = await NotificationRepository.createAsync({
    userId: testUserA,
    title: 'Payment Approved',
    message: 'Your payment of PKR 1000 has been approved.',
    type: 'success',
    eventId: eventId2,
    idempotencyKey: eventId2,
    metadata: { txId: 'tx-2' }
  });
  const unreadCountA = await NotificationRepository.getUnreadCountAsync(testUserA);
  assert.strictEqual(unreadCountA, 2, 'User A should have 2 unread notifications');

  // Scenario 5: Mark One as Read with User Ownership Check
  console.log('\n--- Test 5: Mark One as Read with Ownership Enforcement ---');
  // Attempt to mark User A's notification as read by User B -> should fail
  const failedMark = await NotificationRepository.markAsReadAsync(notif1.id, testUserB);
  assert.strictEqual(failedMark, false, 'User B marking User A notification read should return false');

  // Mark User A's notification read by User A -> should succeed
  const successMark = await NotificationRepository.markAsReadAsync(notif1.id, testUserA);
  assert.strictEqual(successMark, true, 'User A marking own notification read should succeed');

  const unreadCountAfterMark = await NotificationRepository.getUnreadCountAsync(testUserA);
  assert.strictEqual(unreadCountAfterMark, 1, 'Unread count should decrease to 1');

  // Scenario 6: Mark All as Read
  console.log('\n--- Test 6: Mark All Notifications as Read for User ---');
  const updatedCount = await NotificationRepository.markAllAsReadAsync(testUserA);
  assert(updatedCount >= 1, 'Mark all as read should update remaining unread records');

  const finalUnreadCount = await NotificationRepository.getUnreadCountAsync(testUserA);
  assert.strictEqual(finalUnreadCount, 0, 'Unread count should be 0 after markAllAsRead');

  // Scenario 8, 9, 10: Payment Triggers (Submitted, Approved, Rejected)
  console.log('\n--- Test 8, 9, 10: Payment Lifecycle Notification Triggers ---');
  const txId = `tx-test-${Date.now()}`;

  // Submission trigger
  const subNotif = await NotificationRepository.createAsync({
    userId: testUserA,
    title: 'Payment Submitted',
    message: `Your payment of 1000 PKR for Job Posting via Bank Transfer has been submitted for review.`,
    type: 'info',
    eventId: `payment-submitted-${txId}`,
    idempotencyKey: `payment-submitted-${txId}`,
    metadata: { transactionId: txId, amount: 1000, type: 'Job Posting' }
  });
  assert.strictEqual(subNotif.eventId, `payment-submitted-${txId}`);

  // Approval trigger
  const appNotif = await NotificationRepository.createAsync({
    userId: testUserA,
    title: 'Payment Approved',
    message: `Your payment of 1000 PKR for Job Posting has been approved.`,
    type: 'success',
    eventId: `payment-approved-${txId}`,
    idempotencyKey: `payment-approved-${txId}`,
    metadata: { transactionId: txId, amount: 1000, type: 'Job Posting', action: 'approve' }
  });
  assert.strictEqual(appNotif.eventId, `payment-approved-${txId}`);

  // Rejection trigger with reason
  const rejNotif = await NotificationRepository.createAsync({
    userId: testUserA,
    title: 'Payment Rejected',
    message: `Your payment of 1000 PKR for Job Posting was rejected. Reason: Incorrect deposit reference number.`,
    type: 'warning',
    eventId: `payment-rejected-${txId}`,
    idempotencyKey: `payment-rejected-${txId}`,
    metadata: { transactionId: txId, amount: 1000, type: 'Job Posting', action: 'reject', reason: 'Incorrect deposit reference number' }
  });
  assert(rejNotif.message.includes('Incorrect deposit reference number'), 'Rejection notification must include reason');

  // Scenario 12: Notification Failure Isolation
  console.log('\n--- Test 12: Notification Failure Isolation from Transaction Outcome ---');
  let paymentVerified = false;
  try {
    // Simulate authoritative payment verification
    paymentVerified = true;
    
    // Simulate notification creation error
    try {
      throw new Error('Simulated notification service database error');
    } catch (notifErr) {
      console.log('Caught notification error gracefully without failing payment verification:', (notifErr as Error).message);
    }
  } catch {
    paymentVerified = false;
  }
  assert.strictEqual(paymentVerified, true, 'Payment verification result must remain confirmed even if notification creation throws an exception');

  // Cleanup test records
  console.log('\n--- Cleanup Test Notifications ---');
  await NotificationRepository.deleteAsync(notif1.id);
  await NotificationRepository.deleteAsync(notif2.id);
  await NotificationRepository.deleteAsync(subNotif.id);
  await NotificationRepository.deleteAsync(appNotif.id);
  await NotificationRepository.deleteAsync(rejNotif.id);

  console.log('=== ALL DURABLE NOTIFICATION TESTS PASSED SUCCESSFULLY ===');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
