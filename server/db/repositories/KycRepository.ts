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

        // Validate verifiedAt and verifiedBy whenever supplied (regardless of status)
        const auditFields: (keyof EmployerKycRequest)[] = ['verifiedAt', 'verifiedBy'];
        for (const field of auditFields) {
          const val = req[field];
          if (val !== undefined && val !== null) {
            if (typeof val !== 'string' || val.trim() === '') { isRecordInvalid = true; break; }
            sanitized[field] = val.trim();
          }
        }
        if (isRecordInvalid) { invalid++; continue; }

        // Additional allowlisted optional fields
        const optionalFields: (keyof EmployerKycRequest)[] = ['secpRegistrationNumber', 'officialDocUrl'];
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
