import { PaymentRepository } from '../db/repositories/PaymentRepository';
import { UserRepository } from '../db/repositories/UserRepository';
import { Database } from '../db/database';

async function runTests() {
  console.log('=== Starting Subscription Snapshot Integrity Validation Tests (STEP65-D.12.8) ===\n');

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}${detail ? ` (${detail})` : ''}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failCount++;
    }
  }

  process.env.IS_TEST = 'true';

  try {
    // Helper to setup test data
    const setupTest = async (txData: any, userData: any) => {
      const uniqueId = Math.random().toString(36).substring(2, 9);
      const user = await UserRepository.createAsync({
        email: `test-${uniqueId}@example.com`,
        ...userData
      });
      const tx = await PaymentRepository.createAsync({ 
        type: 'Subscription',
        amount: 500,
        status: 'Pending',
        plan: 'Standard Plan',
        paymentMethod: 'Manual Transfer',
        ...txData, 
        userId: user.id 
      });
      return { user, tx };
    };

    const checkRes = async (id: string, testName: string, expectedReason?: string) => {
      await new Promise(r => setTimeout(r, 100)); // Ensure disk write settles
      const res = await PaymentRepository.getByIdAsync(id);
      console.log(`[DEBUG] ${testName} result: status=${res?.status}, reason=${res?.rejectionReason}`);
      let pass = res?.status === 'Pending';
      if (expectedReason) {
        pass = pass && res?.rejectionReason?.includes(expectedReason);
      }
      assert(pass, testName);
    };

    const validSnap = { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 30 };

    // 1. Valid snapshot activates correct membership duration
    console.log('\nTesting Valid Snapshot...');
    const { user: u1, tx: tx1 } = await setupTest(
      { amount: 500, packageSnapshot: validSnap, plan: 'Pro Plan' },
      { name: 'User 1', membershipTier: 'Free', membershipStatus: 'Inactive' }
    );
    await PaymentRepository.verify(tx1.id, 'approve');
    const u1Updated = await UserRepository.getByIdAsync(u1.id);
    assert(
      u1Updated.membershipStatus === 'Active' && 
      u1Updated.membershipTier === 'Pro Plan' &&
      u1Updated.subscriptionExpiresAt !== undefined,
      '1. Valid snapshot activates correct membership duration'
    );

    // 2. Missing snapshot remains Pending
    console.log('\nTesting Missing Snapshot...');
    const { tx: tx2 } = await setupTest(
      { amount: 500, packageSnapshot: undefined },
      { name: 'User 2', membershipStatus: 'Inactive' }
    );
    try {
      await PaymentRepository.verify(tx2.id, 'approve');
    } catch {}
    await checkRes(tx2.id, '2. Missing snapshot remains Pending', 'Missing or invalid package snapshot');

    // 3. Zero duration remains Pending
    console.log('\nTesting Zero Duration...');
    const zeroSnap = { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 0 };
    const { tx: tx3 } = await setupTest(
      { amount: 500, packageSnapshot: zeroSnap },
      { name: 'User 3', membershipStatus: 'Inactive' }
    );
    try { await PaymentRepository.verify(tx3.id, 'approve'); } catch {}
    await checkRes(tx3.id, '3. Zero duration remains Pending', 'Invalid duration');

    // 4. Negative duration remains Pending
    console.log('\nTesting Negative Duration...');
    const negSnap = { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: -30 };
    const { tx: tx4 } = await setupTest(
      { amount: 500, packageSnapshot: negSnap },
      { name: 'User 4' }
    );
    try { await PaymentRepository.verify(tx4.id, 'approve'); } catch {}
    await checkRes(tx4.id, '4. Negative duration remains Pending', 'Invalid duration');

    // 5. Decimal duration remains Pending
    console.log('\nTesting Decimal Duration...');
    const decSnap = { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 30.5 };
    const { tx: tx5 } = await setupTest(
      { amount: 500, packageSnapshot: decSnap },
      { name: 'User 5' }
    );
    try { await PaymentRepository.verify(tx5.id, 'approve'); } catch {}
    await checkRes(tx5.id, '5. Decimal duration remains Pending', 'Invalid duration');

    // 6. NaN/invalid duration remains Pending
    console.log('\nTesting NaN Duration...');
    const nanSnap = { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 'abc' as any };
    const { tx: tx6 } = await setupTest(
      { amount: 500, packageSnapshot: nanSnap },
      { name: 'User 6' }
    );
    try { await PaymentRepository.verify(tx6.id, 'approve'); } catch {}
    await checkRes(tx6.id, '6. NaN/invalid duration remains Pending', 'Invalid duration');

    // 7. Missing package ID/name remains Pending
    console.log('\nTesting Missing ID/Name...');
    const noIdSnap = { name: 'Pro Plan', pricePkr: 500, durationDays: 30 };
    const { tx: tx7 } = await setupTest(
      { amount: 500, packageSnapshot: noIdSnap as any },
      { name: 'User 7' }
    );
    try { await PaymentRepository.verify(tx7.id, 'approve'); } catch {}
    await checkRes(tx7.id, '7. Missing package ID remains Pending', 'Invalid package ID');

    // 8. Invalid price remains Pending
    console.log('\nTesting Invalid Price...');
    const invPriceSnap = { id: 'pro-1', name: 'Pro Plan', pricePkr: -500, durationDays: 30 };
    const { tx: tx8 } = await setupTest(
      { amount: -500, packageSnapshot: invPriceSnap },
      { name: 'User 8' }
    );
    try { await PaymentRepository.verify(tx8.id, 'approve'); } catch {}
    await checkRes(tx8.id, '8. Invalid price remains Pending', 'Invalid price');

    // 9. Transaction amount mismatch remains Pending
    console.log('\nTesting Amount Mismatch...');
    const mismatchSnap = { id: 'pro-1', name: 'Pro Plan', pricePkr: 500, durationDays: 30 };
    const { tx: tx9 } = await setupTest(
      { amount: 300, packageSnapshot: mismatchSnap },
      { name: 'User 9' }
    );
    try { await PaymentRepository.verify(tx9.id, 'approve'); } catch {}
    await checkRes(tx9.id, '9. Transaction amount mismatch remains Pending', 'amount mismatch');

    // 10. Rejection does not activate membership
    console.log('\nTesting Admin Rejection...');
    const { user: u10, tx: tx10 } = await setupTest(
      { amount: 500, packageSnapshot: validSnap },
      { name: 'User 10', membershipStatus: 'Inactive' }
    );
    await PaymentRepository.verify(tx10.id, 'reject');
    const u10Updated = await UserRepository.getByIdAsync(u10.id);
    const tx10Res = await PaymentRepository.getByIdAsync(tx10.id);
    assert(u10Updated.membershipStatus === 'Inactive' && tx10Res.status === 'Failed', '10. Rejection does not activate membership');

  } catch (err: any) {
    console.error('Fatal error during tests:', err?.message || err);
  } finally {
    console.log(`\nTests finished. PASSED: ${passCount}, FAILED: ${failCount}`);
    if (failCount > 0) process.exit(1);
    else process.exit(0);
  }
}

runTests();
