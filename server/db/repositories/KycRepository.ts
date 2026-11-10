import { Collection } from 'mongodb';
import { getMongoDb } from '../mongodb';
import { EmployerKycRequest } from '../../../src/types/adminSuite';

const COLLECTION = 'kyc_requests';

// Collection-instance-safe initialization cache using WeakMap and WeakSet
const inFlightInitMap = new WeakMap<Collection<any>, Promise<void>>();
const initializedSet = new WeakSet<Collection<any>>();

export function isCollectionInitialized(coll: Collection<any>): boolean {
  return initializedSet.has(coll);
}

export function isValidCombinedIndexDefinition(indexSpec: any): boolean {
  if (!indexSpec || typeof indexSpec !== 'object') return false;

  // 1. Key must be exactly { activeUserId: 1 } with no additional key fields
  if (!indexSpec.key || typeof indexSpec.key !== 'object') return false;
  const keyEntries = Object.entries(indexSpec.key);
  if (keyEntries.length !== 1) return false;
  const [firstKey, firstVal] = keyEntries[0];
  if (firstKey !== 'activeUserId' || (firstVal !== 1 && firstVal !== 1.0)) return false;

  // 2. unique must be exactly true
  if (indexSpec.unique !== true) return false;

  // 3. partialFilterExpression must be exactly { activeUserId: { $type: 'string' } }
  // with no additional conditions or extra operators
  const pfe = indexSpec.partialFilterExpression;
  if (!pfe || typeof pfe !== 'object') return false;
  const pfeKeys = Object.keys(pfe);
  if (pfeKeys.length !== 1 || pfeKeys[0] !== 'activeUserId') return false;

  const activeUserIdCond = pfe.activeUserId;
  if (!activeUserIdCond || typeof activeUserIdCond !== 'object') return false;
  const condKeys = Object.keys(activeUserIdCond);
  if (condKeys.length !== 1 || condKeys[0] !== '$type') return false;
  if (activeUserIdCond.$type !== 'string' && activeUserIdCond.$type !== 2) return false;

  return true;
}

async function getCollectionIndexes(coll: Collection<any>): Promise<any[]> {
  try {
    return await coll.indexes();
  } catch (err: any) {
    if (err && (err.code === 26 || err.codeName === 'NamespaceNotFound')) {
      return [];
    }
    throw err;
  }
}

export const KycRepository = {
  resetIndexInitialization(coll?: Collection<any>): void {
    if (coll) {
      inFlightInitMap.delete(coll);
      initializedSet.delete(coll);
    }
  },

  async getCollection(coll?: Collection<EmployerKycRequest>): Promise<Collection<EmployerKycRequest>> {
    if (coll) return coll;
    const db = await getMongoDb();
    return db.collection<EmployerKycRequest>(COLLECTION);
  },

  async getAll(coll?: Collection<EmployerKycRequest>): Promise<EmployerKycRequest[]> {
    const dbColl = await this.getCollection(coll);
    const records = await dbColl.find({}).toArray();
    return records.map(r => {
      const { _id, activeUserId, ...safe } = r as any;
      return safe as EmployerKycRequest;
    });
  },

  async getByUserId(userId: string, coll?: Collection<EmployerKycRequest>): Promise<EmployerKycRequest | null> {
    const dbColl = await this.getCollection(coll);
    const records = await dbColl.find({ userId }).sort({ submittedAt: -1 }).limit(1).toArray();
    if (!records[0]) return null;
    const { _id, activeUserId, ...safe } = records[0] as any;
    return safe as EmployerKycRequest;
  },

  async runMigrationAndIndexSetup(dbColl: Collection<EmployerKycRequest>): Promise<void> {
    const targetIndexName = 'unique_combined_active_kyc_user';
    const existingIndexes = await getCollectionIndexes(dbColl);
    const foundIndex = existingIndexes.find(idx => idx.name === targetIndexName);

    // If index already exists before initialization, validate exact definition immediately
    if (foundIndex) {
      if (!isValidCombinedIndexDefinition(foundIndex)) {
        throw new Error(
          `Index Conflict Error: Index "${targetIndexName}" already exists with incompatible definition: ${JSON.stringify(foundIndex)}`
        );
      }
    }

    // 1. Inspect existing Pending and Verified records
    const activeRecords = await dbColl.find({ status: { $in: ['Pending', 'Verified'] } }).toArray();

    // 2 & 3. Validate every active record's userId (fail closed if missing, empty, or whitespace-only)
    for (const rec of activeRecords) {
      if (typeof rec.userId !== 'string' || rec.userId.trim() === '') {
        throw new Error(`Database Integrity Error: Active KYC record with id "${rec.id}" has missing, empty, or whitespace-only userId.`);
      }
    }

    // 4 & 5. Detect multiple active records belonging to the same user using Map
    const activeCounts = new Map<string, number>();
    for (const rec of activeRecords) {
      const uId = rec.userId.trim();
      activeCounts.set(uId, (activeCounts.get(uId) || 0) + 1);
    }

    const conflictingUsers: string[] = [];
    for (const [uId, count] of activeCounts.entries()) {
      if (count > 1) {
        conflictingUsers.push(uId);
      }
    }

    if (conflictingUsers.length > 0) {
      const errMsg = `Database Conflict Error: Multiple active (Pending/Verified) KYC records exist for user(s): ${conflictingUsers.join(', ')}. Index initialization failed closed.`;
      console.error('[KycRepository]', errMsg);
      throw new Error(errMsg);
    }

    // 6, 7, 8 & 9. Backfill activeUserId using exact _id filters and verify results
    const allRecords = await dbColl.find({}).toArray();
    for (const rec of allRecords) {
      const mongoId = (rec as any)._id;
      if (rec.status === 'Pending' || rec.status === 'Verified') {
        const expectedActive = rec.userId.trim();
        if ((rec as any).activeUserId !== expectedActive) {
          const updateRes = await dbColl.updateOne(
            { _id: mongoId },
            { $set: { activeUserId: expectedActive } as any }
          );
          if (updateRes.matchedCount !== 1) {
            throw new Error(`Database Migration Error: Failed to match record with _id "${mongoId}" during activeUserId backfill.`);
          }
        }
      } else if (rec.status === 'Rejected') {
        if ((rec as any).activeUserId !== undefined) {
          const updateRes = await dbColl.updateOne(
            { _id: mongoId },
            { $unset: { activeUserId: '' } as any }
          );
          if (updateRes.matchedCount !== 1) {
            throw new Error(`Database Migration Error: Failed to match record with _id "${mongoId}" during activeUserId cleanup.`);
          }
        }
      }
    }

    // 10 & 11. Create combined unique index and verify exact index definition if not already created
    if (!foundIndex) {
      await dbColl.createIndex(
        { activeUserId: 1 } as any,
        {
          unique: true,
          partialFilterExpression: { activeUserId: { $type: 'string' } },
          name: targetIndexName
        }
      );

      const verifiedIndexes = await getCollectionIndexes(dbColl);
      const verifiedIndex = verifiedIndexes.find(idx => idx.name === targetIndexName);
      if (!verifiedIndex || !isValidCombinedIndexDefinition(verifiedIndex)) {
        throw new Error(
          `Index Verification Error: Index "${targetIndexName}" created with incompatible definition: ${JSON.stringify(verifiedIndex)}`
        );
      }
    }

    // 12. Remove obsolete separate Pending/Verified indexes only after successful verification
    const finalIndexes = await getCollectionIndexes(dbColl);
    for (const idx of finalIndexes) {
      if (idx.name === 'unique_active_pending_kyc_user' || idx.name === 'unique_active_verified_kyc_user') {
        try {
          await dbColl.dropIndex(idx.name);
        } catch (dropErr: any) {
          if (dropErr && dropErr.codeName !== 'IndexNotFound' && dropErr.code !== 27) {
            throw new Error(`Index Drop Error: Failed to drop obsolete index "${idx.name}": ${dropErr.message}`);
          }
        }
      }
    }
  },

  async ensureIndexes(coll?: Collection<EmployerKycRequest>): Promise<void> {
    const dbColl = await this.getCollection(coll);

    if (initializedSet.has(dbColl)) {
      return;
    }

    const existingPromise = inFlightInitMap.get(dbColl);
    if (existingPromise) {
      return existingPromise;
    }

    const initPromise = (async () => {
      try {
        await this.runMigrationAndIndexSetup(dbColl);
        initializedSet.add(dbColl);
      } catch (err) {
        throw err;
      } finally {
        inFlightInitMap.delete(dbColl);
      }
    })();

    inFlightInitMap.set(dbColl, initPromise);
    return initPromise;
  },

  async createRequest(newReq: EmployerKycRequest, coll?: Collection<EmployerKycRequest>): Promise<EmployerKycRequest> {
    const dbColl = await this.getCollection(coll);
    await this.ensureIndexes(dbColl);

    if (!newReq.userId || typeof newReq.userId !== 'string' || !newReq.userId.trim()) {
      throw new Error('Validation Error: "userId" is required and must be a non-empty string.');
    }

    const cleanUserId = newReq.userId.trim();

    // Pre-check for existing active ('Pending' or 'Verified') request for this user
    const existing = await dbColl.findOne({
      userId: cleanUserId,
      status: { $in: ['Pending', 'Verified'] }
    });

    if (existing) {
      throw new Error('Duplicate Request Error: An active or verified KYC request already exists for this employer.');
    }

    const { activeUserId: _ignoredActive, _id: _ignoredId, ...safeInput } = newReq as any;

    const docToInsert: any = {
      ...safeInput,
      userId: cleanUserId,
      status: 'Pending',
      activeUserId: cleanUserId
    };

    try {
      await dbColl.insertOne(docToInsert);
      const { activeUserId: _, _id: __, ...safeResult } = docToInsert;
      return safeResult as EmployerKycRequest;
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

    const { activeUserId: _ignoredActive, userId: _ignoredUser, id: _ignoredId, _id: _ignoredMongoId, ...safeUpdates } = updateData as any;

    const payload: any = { ...safeUpdates };
    let updateOp: any = { $set: payload };

    if (updateData.status === 'Rejected') {
      updateOp = {
        $set: payload,
        $unset: { activeUserId: '' }
      };
    } else if (updateData.status === 'Verified') {
      // Pending -> Verified: active slot remains occupied with activeUserId
    }

    // Atomic update: only allow transition from Pending
    const result = await dbColl.findOneAndUpdate(
      { id, status: 'Pending' },
      updateOp,
      { returnDocument: 'after' }
    );

    if (!result) return null;
    const { _id, activeUserId: _, ...safe } = result as any;
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

        const existingById = await dbColl.findOne({ id: sanitized.id });
        if (existingById) {
          skipped++;
          continue;
        }

        if (sanitized.activeUserId) {
          const existingActive = await dbColl.findOne({
            userId: sanitized.userId,
            status: { $in: ['Pending', 'Verified'] }
          });
          if (existingActive) {
            invalid++;
            continue;
          }
        }

        try {
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
        } catch (insertErr: any) {
          if (insertErr && (insertErr.code === 11000 || (insertErr.message && insertErr.message.includes('E11000')))) {
            invalid++;
          } else {
            throw insertErr;
          }
        }
      } catch (err) {
        console.error('[KycRepository] Unexpected error during legacy import loop:', err);
        invalid++;
      }
    }
    return { imported, skipped, invalid };
  }
};
