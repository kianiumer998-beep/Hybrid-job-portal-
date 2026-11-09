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

    for (const req of requests) {
      if (!req.id || !req.companyName || !['Pending', 'Verified', 'Rejected'].includes(req.status)) {
        invalid++;
        continue;
      }
      if (['kyc-01', 'kyc-02', 'kyc-03', 'kyc-04'].includes(req.id)) {
        skipped++;
        continue;
      }
      
      const result = await dbColl.updateOne(
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
    return { imported, skipped, invalid };
  }
};
