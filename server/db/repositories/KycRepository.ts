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
    return dbColl.find({}).toArray();
  },

  async getByUserId(userId: string, coll?: Collection<EmployerKycRequest>): Promise<EmployerKycRequest | null> {
    const dbColl = await this.getCollection(coll);
    const records = await dbColl.find({ userId }).sort({ submittedAt: -1 }).limit(1).toArray();
    return records[0] || null;
  },

  async ensureIndexes(coll?: Collection<EmployerKycRequest>): Promise<void> {
    try {
      const dbColl = await this.getCollection(coll);
      await dbColl.createIndex(
        { userId: 1 },
        {
          unique: true,
          partialFilterExpression: { status: 'Pending' },
          name: 'unique_active_pending_kyc_user'
        }
      );
      await dbColl.createIndex(
        { userId: 1 },
        {
          unique: true,
          partialFilterExpression: { status: 'Verified' },
          name: 'unique_active_verified_kyc_user'
        }
      );
    } catch (e) {
      // Ignore index creation errors if background process or duplicate index definition
    }
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

    // 2. Database-level atomic insertion with partial unique index protection against race conditions
    try {
      await dbColl.insertOne(newReq);
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
    
    // Atomic update: only allow transition from Pending
    const result = await dbColl.findOneAndUpdate(
      { id, status: 'Pending' },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    // In MongoDB driver v7, result is the document directly, or null if not found
    return result;
  },

  async importLegacyRequests(requests: EmployerKycRequest[], coll?: Collection<EmployerKycRequest>): Promise<{ imported: number; skipped: number; invalid: number }> {
    const dbColl = await this.getCollection(coll);
    let imported = 0;
    let skipped = 0;
    let invalid = 0;

    if (!Array.isArray(requests)) {
      return { imported, skipped, invalid: 1 };
    }

    for (const req of requests) {
      try {
        // 1. Basic type and null check
        if (!req || typeof req !== 'object' || Array.isArray(req)) {
          invalid++;
          continue;
        }

        // 2. Required string fields validation & sanitization (non-empty trimmed)
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

        // 3. Status validation
        if (!['Pending', 'Verified', 'Rejected'].includes(req.status)) {
          invalid++;
          continue;
        }
        sanitized.status = req.status;

        // 4. Conditional validations & Robust Optional Field Validation
        if (req.status === 'Verified') {
          const validBadges = ['Standard Verified', 'Top Employer', 'Government Agency'];
          if (!req.badgeLevel || !validBadges.includes(req.badgeLevel)) {
            invalid++;
            continue;
          }
          sanitized.badgeLevel = req.badgeLevel;
        }

        if (req.status === 'Rejected') {
          if (!req.rejectionReason || typeof req.rejectionReason !== 'string' || req.rejectionReason.trim() === '') {
            invalid++;
            continue;
          }
          sanitized.rejectionReason = req.rejectionReason.trim();
        }

        // Validate optional audit & legacy fields whenever supplied as non-null
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

        // 5. Sample exclusions
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
