import { Database } from '../database';
import { getCasesCollection, isMongoConfigured } from '../mongodb';

export interface CaseTimelineEvent {
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  note: string;
}

export interface UniversalCase {
  id: string;
  caseNumber: string;
  type: 'job_submission' | 'application' | 'campaign' | 'deposit' | 'withdrawal' | 'kyc' | 'support' | 'correction' | 'dispute';
  referenceId?: string;
  title: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  status: 'pending' | 'under_review' | 'needs_correction' | 'approved' | 'rejected' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timeline: CaseTimelineEvent[];
  correctionNotes?: string;
  disputeNotes?: string;
  resolutionNotes?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export class CaseRepository {
  static getAll(filters?: { type?: string; status?: string; userId?: string }): UniversalCase[] {
    let cases = Database.getCases();
    if (filters?.type) {
      cases = cases.filter(c => c.type === filters.type);
    }
    if (filters?.status) {
      cases = cases.filter(c => c.status === filters.status);
    }
    if (filters?.userId) {
      cases = cases.filter(c => c.userId === filters.userId);
    }
    return cases;
  }

  static async getAllAsync(filters?: { type?: string; status?: string; userId?: string }): Promise<UniversalCase[]> {
    if (isMongoConfigured()) {
      try {
        const coll = await getCasesCollection();
        const query: Record<string, any> = {};
        if (filters?.type) query.type = filters.type;
        if (filters?.status) query.status = filters.status;
        if (filters?.userId) query.userId = filters.userId;

        const docs = await coll.find(query).sort({ createdAt: -1 }).toArray();
        if (docs && docs.length > 0) {
          return docs.map(d => {
            const { _id, ...rest } = d;
            return rest as UniversalCase;
          });
        }
      } catch (err: any) {
        console.warn('[MongoDB] getAllAsync cases error, falling back:', err.message);
      }
    }
    return this.getAll(filters);
  }

  static getById(id: string): UniversalCase | null {
    return Database.getCaseById(id);
  }

  static async getByIdAsync(id: string): Promise<UniversalCase | null> {
    if (isMongoConfigured()) {
      try {
        const coll = await getCasesCollection();
        const doc = await coll.findOne({ $or: [{ id }, { caseNumber: id }] });
        if (doc) {
          const { _id, ...rest } = doc;
          return rest as UniversalCase;
        }
      } catch (err: any) {
        console.warn('[MongoDB] getByIdAsync case error:', err.message);
      }
    }
    return this.getById(id);
  }


  static create(caseData: Partial<UniversalCase>): UniversalCase {
    const newCase = Database.addCase(caseData);
    this.syncMongoCase(newCase);
    return newCase;
  }

  static update(id: string, updates: Partial<UniversalCase>): UniversalCase | null {
    const updated = Database.updateCase(id, updates);
    if (updated) {
      this.syncMongoCase(updated);
    }
    return updated;
  }

  static addTimelineEvent(id: string, event: { actor: string; role: string; action: string; note: string }): UniversalCase | null {
    const existing = Database.getCaseById(id);
    if (!existing) return null;

    const timelineEvent: CaseTimelineEvent = {
      timestamp: new Date().toISOString(),
      ...event
    };

    const updatedTimeline = [timelineEvent, ...(existing.timeline || [])];
    return this.update(id, { timeline: updatedTimeline });
  }

  static updateStatus(
    id: string,
    status: UniversalCase['status'],
    actor: string,
    role: string,
    note?: string
  ): UniversalCase | null {
    const existing = Database.getCaseById(id);
    if (!existing) return null;

    const timelineEvent: CaseTimelineEvent = {
      timestamp: new Date().toISOString(),
      actor,
      role,
      action: `Status changed to ${status}`,
      note: note || `Case transitioned from ${existing.status} to ${status}`
    };

    const updatedTimeline = [timelineEvent, ...(existing.timeline || [])];
    return this.update(id, { status, timeline: updatedTimeline });
  }

  static requestCorrection(
    id: string,
    actor: string,
    role: string,
    correctionNotes: string
  ): UniversalCase | null {
    const existing = Database.getCaseById(id);
    if (!existing) return null;

    const timelineEvent: CaseTimelineEvent = {
      timestamp: new Date().toISOString(),
      actor,
      role,
      action: 'Correction Requested',
      note: correctionNotes
    };

    const updatedTimeline = [timelineEvent, ...(existing.timeline || [])];
    return this.update(id, {
      status: 'needs_correction',
      correctionNotes,
      timeline: updatedTimeline
    });
  }

  static submitDispute(
    id: string,
    actor: string,
    role: string,
    disputeNotes: string
  ): UniversalCase | null {
    const existing = Database.getCaseById(id);
    if (!existing) return null;

    const timelineEvent: CaseTimelineEvent = {
      timestamp: new Date().toISOString(),
      actor,
      role,
      action: 'Dispute Raised',
      note: disputeNotes
    };

    const updatedTimeline = [timelineEvent, ...(existing.timeline || [])];
    return this.update(id, {
      status: 'under_review',
      disputeNotes,
      timeline: updatedTimeline
    });
  }

  static resolveDispute(
    id: string,
    actor: string,
    role: string,
    resolutionNotes: string,
    newStatus: UniversalCase['status'] = 'resolved'
  ): UniversalCase | null {
    const existing = Database.getCaseById(id);
    if (!existing) return null;

    const timelineEvent: CaseTimelineEvent = {
      timestamp: new Date().toISOString(),
      actor,
      role,
      action: 'Dispute Resolved',
      note: resolutionNotes
    };

    const updatedTimeline = [timelineEvent, ...(existing.timeline || [])];
    return this.update(id, {
      status: newStatus,
      resolutionNotes,
      timeline: updatedTimeline
    });
  }

  private static syncMongoCase(c: any): void {
    if (!isMongoConfigured()) return;
    getCasesCollection()
      .then(coll => {
        coll.updateOne({ id: c.id }, { $set: c }, { upsert: true }).catch(err =>
          console.warn('[MongoDB] Sync Case notice:', err.message)
        );
      })
      .catch(() => {});
  }
}
