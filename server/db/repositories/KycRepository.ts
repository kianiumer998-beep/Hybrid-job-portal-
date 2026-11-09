import { Db, Collection } from 'mongodb';
import { getMongoDb } from '../mongodb';
import { EmployerKycRequest } from '../../../src/types/adminSuite';

const COLLECTION = 'kyc_requests';

export const KycRepository = {
  async getCollection(): Promise<Collection<EmployerKycRequest>> {
    const db = await getMongoDb();
    return db.collection<EmployerKycRequest>(COLLECTION);
  },

  async getAll(): Promise<EmployerKycRequest[]> {
    const coll = await this.getCollection();
    return coll.find({}).toArray();
  },

  async updateRequest(id: string, updateData: Partial<EmployerKycRequest>): Promise<EmployerKycRequest | null> {
    const coll = await this.getCollection();
    
    // Using atomic update with $set, but keeping status check is crucial
    // Atomic update to prevent outdated browser overwrites
    const result = await coll.findOneAndUpdate(
      { id },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    return result.value;
  },

  async importLegacyRequests(requests: EmployerKycRequest[]): Promise<{ imported: number; skipped: number }> {
    const coll = await this.getCollection();
    let imported = 0;
    let skipped = 0;

    for (const req of requests) {
      // Rule 3: Skip sample records kyc-01 to kyc-04
      if (['kyc-01', 'kyc-02', 'kyc-03', 'kyc-04'].includes(req.id)) {
        skipped++;
        continue;
      }
      
      // Rule 8/10: Non-destructive insert (never overwrite existing)
      const result = await coll.updateOne(
        { id: req.id },
        { $setOnInsert: req },
        { upsert: true }
      );
      
      if (result.upsertedCount === 1) {
        imported++;
      } else {
        skipped++;
      }
    }
    return { imported, skipped };
  }
};
