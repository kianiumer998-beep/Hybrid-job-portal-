import { Database } from '../database';
import { getSupportTicketsCollection, isMongoConfigured } from '../mongodb';

export interface SupportTicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  timestamp: string;
  attachments?: string[];
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: 'General' | 'Billing' | 'Employer' | 'Technical' | 'Dispute';
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  messages: SupportTicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export class SupportRepository {
  static getAll(userId?: string): SupportTicket[] {
    let tickets = Database.getSupportTickets();
    if (userId) {
      tickets = tickets.filter(t => t.userId === userId);
    }
    return tickets;
  }

  static async getAllAsync(userId?: string): Promise<SupportTicket[]> {
    if (isMongoConfigured()) {
      try {
        const coll = await getSupportTicketsCollection();
        const query: Record<string, any> = {};
        if (userId) query.userId = userId;

        const docs = await coll.find(query).sort({ createdAt: -1 }).toArray();
        if (docs && docs.length > 0) {
          return docs.map(d => {
            const { _id, ...rest } = d;
            return rest as SupportTicket;
          });
        }
      } catch (err: any) {
        console.warn('[MongoDB] getAllAsync support tickets error, falling back:', err.message);
      }
    }
    return this.getAll(userId);
  }

  static getById(id: string): SupportTicket | null {
    const list = Database.getSupportTickets();
    return list.find(t => t.id === id || t.ticketNumber === id) || null;
  }

  static async getByIdAsync(id: string): Promise<SupportTicket | null> {
    if (isMongoConfigured()) {
      try {
        const coll = await getSupportTicketsCollection();
        const doc = await coll.findOne({ $or: [{ id }, { ticketNumber: id }] });
        if (doc) {
          const { _id, ...rest } = doc;
          return rest as SupportTicket;
        }
      } catch (err: any) {
        console.warn('[MongoDB] getByIdAsync support ticket error:', err.message);
      }
    }
    return this.getById(id);
  }


  static create(ticketData: Partial<SupportTicket>): SupportTicket {
    const newTicket = Database.addSupportTicket(ticketData);
    this.syncMongoTicket(newTicket);
    return newTicket;
  }

  static addMessage(
    ticketId: string,
    messageData: { senderId: string; senderName: string; senderRole: string; message: string; attachments?: string[] }
  ): SupportTicket | null {
    const ticket = this.getById(ticketId);
    if (!ticket) return null;

    const newMsg: SupportTicketMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...messageData
    };

    const updatedMessages = [...(ticket.messages || []), newMsg];
    const updated = Database.updateSupportTicket(ticket.id, {
      messages: updatedMessages,
      status: messageData.senderRole.toLowerCase().includes('admin') ? 'waiting_user' : 'in_progress'
    });

    if (updated) {
      this.syncMongoTicket(updated);
    }
    return updated;
  }

  static updateStatus(ticketId: string, status: SupportTicket['status']): SupportTicket | null {
    const updated = Database.updateSupportTicket(ticketId, { status });
    if (updated) {
      this.syncMongoTicket(updated);
    }
    return updated;
  }

  private static syncMongoTicket(ticket: any): void {
    if (!isMongoConfigured()) return;
    getSupportTicketsCollection()
      .then(coll => {
        coll.updateOne({ id: ticket.id }, { $set: ticket }, { upsert: true }).catch(err =>
          console.warn('[MongoDB] Sync Ticket notice:', err.message)
        );
      })
      .catch(() => {});
  }
}
