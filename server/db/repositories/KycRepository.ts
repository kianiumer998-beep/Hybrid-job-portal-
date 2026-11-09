import { Collection } from 'mongodb';
import { getMongoDb } from '../mongodb';
import { EmployerKycRequest } from '../../../src/types/adminSuite';

const COLLECTION = 'kyc_requests';

export const KycRepository = {
  async getCollection(coll?: Collection<EmployerKycRequest>): Promise<Collection<EmployerKycRequest>> {
    if (coll) return coll;
    const db = await getMongoDb();
    return db.collection<EmployerKycRequest>(COLLECTION);
  },

  async getAll(coll?: Collection<EmployerKycRequest>): Promise<EmployerKycRequest[]> {
    const dbColl = await this.getCollection(coll);
    const records = await dbColl.find({}).toArray();
    return records.map(r => {
      const { _id, ...safe } = r as any;
      return safe;
    });
  },

  async getByUserId(userId: string, coll?: Collection<EmployerKycRequest>): Promise<EmployerKycRequest | null> {
    const dbColl = await this.getCollection(coll);
    const records = await dbColl.find({ userId }).sort({ submittedAt: -1 }).limit(1).toArray();
    if (!records[0]) return null;
    const { _id, ...safe } = records[0] as any;
    return safe;
  },

  async ensureIndexes(coll?: Collection<EmployerKycRequest>): Promise<void> {
    const dbColl = await this.getCollection(coll);

    // 1. Conflict detection: query existing active (Pending or Verified) records
    const activeRecords = await dbColl.find({ status: { $in: ['Pending', 'Verified'] } }).toArray();
    const activeCounts: Record<string, number> = {};
    for (const rec of activeRecords) {
      if (rec.userId) {
        activeCounts[rec.userId] = (activeCounts[rec.userId] || 0) + 1;
      }
    }

    const conflictingUsers = Object.keys(activeCounts).filter(u => activeCounts[u] > 1);
    if (conflictingUsers.length > 0) {
      const errMsg = `Database Conflict Error: Multiple active (Pending/Verified) KYC records exist for user(s): ${conflictingUsers.join(', ')}. Index initialization failed closed.`;
      console.error('[KycRepository]', errMsg);
      throw new Error(errMsg);
    }

    // 2. Safe Backfill: set activeUserId on existing Pending/Verified docs, unset on Rejected docs
    const allRecords = await dbColl.find({}).toArray();
    for (const rec of allRecords) {
      if (rec.status === 'Pending' || rec.status === 'Verified') {
        if ((rec as any).activeUserId !== rec.userId) {
          await dbColl.updateOne({ id: rec.id }, { $set: { activeUserId: rec.userId } as any });
        }
      } else if (rec.status === 'Rejected') {
        if ((rec as any).activeUserId) {
          await dbColl.updateOne({ id: rec.id }, { $unset: { activeUserId: '' } as any });
        }
      }
    }

    // 3. Drop legacy separate indexes if present
    try {
      await dbColl.dropIndex('unique_active_pending_kyc_user');
    } catch (e) {}
    try {
      await dbColl.dropIndex('unique_active_verified_kyc_user');
    } catch (e) {}

    // 4. Create single combined unique partial index on activeUserId
    await dbColl.createIndex(
      { activeUserId: 1 } as any,
      {
        unique: true,
        partialFilterExpression: { activeUserId: { $type: 'string' } },
        name: 'unique_combined_active_kyc_user'
      }
    );
  },

  async createRequest(newReq: EmployerKycRequest, coll?: Collection<EmployerKycRequest>): Promise<EmployerKycRequest> {
    const dbColl = await this.getCollection(coll);
    await this.ensureIndexes(dbColl);

    // 1. Pre-check for existing active ('Pending' or 'Verified') request for this user
    const existing = await dbColl.findOne({
      userId: newReq.userId,
      status: { $in: ['Pending', 'Verified'] }
    });

    if (existing) {
      throw new Error('Duplicate Request Error: An active or verified KYC request already exists for this employer.');
    }

    const docToInsert: any = {
      ...newReq,
      status: 'Pending',
      activeUserId: newReq.userId
    };

    // 2. Database-level atomic insertion with single partial unique index protection against race conditions
    try {
      await dbColl.insertOne(docToInsert);
      return newReq;
    } catch (err: any) {
      if (err && (err.code === 11000 || (err.message && err.message.includes('E11000')))) {
        throw new Error('Duplicate Request Error: An active or verified KYC request already exists for this employer.');
      }
      throw err;
    }
  },

  async updateRequest(id: string, updateData: Partial<EmployerKycRequest>, coll?: Collection<EmployerKycRequest>): Promise<EmployerKycRequest | null> {
    const dbColl = await this.getCollection(coll);
    await this.ensureIndexes(dbColl);

    const payload: any = { ...updateData };
    let updateOp: any = { $set: payload };

    if (updateData.status === 'Rejected') {
      updateOp = {
        $set: payload,
        $unset: { activeUserId: '' }
      };
    } else if (updateData.status === 'Verified') {
      // Pending -> Verified: activeUserId is preserved so the active slot remains occupied
    }

    // Atomic update: only allow transition from Pending
    const result = await dbColl.findOneAndUpdate(
      { id, status: 'Pending' },
      updateOp,
      { returnDocument: 'after' }
    );

    if (!result) return null;
    const { _id, ...safe } = result as any;
    return safe as EmployerKycRequest;
  },

  async importLegacyRequests(requests: EmployerKycRequest[], coll?: Collection<EmployerKycRequest>): Promise<{ imported: number; skipped: number; invalid: number }> {
    const dbColl = await this.getCollection(coll);
    await this.ensureIndexes(dbColl);

    let imported = 0;
    let skipped = 0;
    let invalid = 0;

    if (!Array.isArray(requests)) {
      return { imported, skipped, invalid: 1 };
    }

    for (const req of requests) {
      try {
        if (!req || typeof req !== 'object' || Array.isArray(req)) {
          invalid++;
          continue;
        }

        const requiredFields: (keyof EmployerKycRequest)[] = ['id', 'userId', 'companyName', 'contactPerson', 'email', 'phone', 'ntnOrTaxNumber', 'companyWebsite', 'submittedAt'];
        const sanitized: any = {};
        let isRecordInvalid = false;

        for (const field of requiredFields) {
          const val = req[field];
          if (typeof val !== 'string' || val.trim() === '') {
            isRecordInvalid = true;
            break;
          }
          sanitized[field] = val.trim();
        }

        if (isRecordInvalid) {
          invalid++;
          continue;
        }

        if (!['Pending', 'Verified', 'Rejected'].includes(req.status)) {
          invalid++;
          continue;
        }
        sanitized.status = req.status;

        if (req.status === 'Verified') {
          const validBadges = ['Standard Verified', 'Top Employer', 'Government Agency'];
          if (!req.badgeLevel || !validBadges.includes(req.badgeLevel)) {
            invalid++;
            continue;
          }
          sanitized.badgeLevel = req.badgeLevel;
          sanitized.activeUserId = sanitized.userId;
        } else if (req.status === 'Pending') {
          sanitized.activeUserId = sanitized.userId;
        }

        if (req.status === 'Rejected') {
          if (!req.rejectionReason || typeof req.rejectionReason !== 'string' || req.rejectionReason.trim() === '') {
            invalid++;
            continue;
          }
          sanitized.rejectionReason = req.rejectionReason.trim();
        }

        const optionalFields: (keyof EmployerKycRequest)[] = ['verifiedAt', 'verifiedBy', 'secpRegistrationNumber', 'officialDocUrl'];
        for (const field of optionalFields) {
          const val = req[field];
          if (val !== undefined && val !== null) {
            if (typeof val !== 'string' || val.trim() === '') {
              isRecordInvalid = true;
              break;
            }
            sanitized[field] = val.trim();
          }
        }

        if (isRecordInvalid) {
          invalid++;
          continue;
        }

        if (['kyc-01', 'kyc-02', 'kyc-03', 'kyc-04'].includes(sanitized.id)) {
          skipped++;
          continue;
        }
        
        const result = await dbColl.updateOne(
          { id: sanitized.id },
          { $setOnInsert: sanitized },
          { upsert: true }
        );
        
        if (result.upsertedCount === 1) {
          imported++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error('[KycRepository] Unexpected error during legacy import loop:', err);
        invalid++;
      }
    }
    return { imported, skipped, invalid };
  }
};
