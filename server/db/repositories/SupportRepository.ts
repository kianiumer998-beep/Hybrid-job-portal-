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
      } catch (err) {
        // Fallback to local database
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
      } catch (err) {
        // Fallback to local database
      }
    }
    return this.getById(id);
  }

  static async createAsync(ticketData: Partial<SupportTicket>): Promise<SupportTicket> {
    const id = ticketData.id || `ticket-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const ticketNumber = ticketData.ticketNumber || `TICK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    const newTicket: SupportTicket = {
      id,
      ticketNumber,
      userId: ticketData.userId || 'guest',
      userName: ticketData.userName || 'Anonymous',
      userEmail: ticketData.userEmail || '',
      subject: ticketData.subject || 'Support Ticket',
      category: ticketData.category || 'General',
      status: ticketData.status || 'open',
      priority: ticketData.priority || 'medium',
      messages: ticketData.messages || [],
      createdAt: ticketData.createdAt || now,
      updatedAt: ticketData.updatedAt || now
    };

    if (isMongoConfigured()) {
      const coll = await getSupportTicketsCollection();
      await coll.insertOne({ ...newTicket });
      try {
        Database.addSupportTicket(newTicket);
      } catch {}
      return newTicket;
    }

    return Database.addSupportTicket(newTicket);
  }

  static create(ticketData: Partial<SupportTicket>): SupportTicket {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous create is prohibited to ensure authoritative persistence; use createAsync.');
    }
    const newTicket = Database.addSupportTicket(ticketData);
    return newTicket;
  }

  static async addMessageAsync(
    ticketId: string,
    messageData: { senderId: string; senderName: string; senderRole: string; message: string; attachments?: string[] }
  ): Promise<SupportTicket | null> {
    const existing = await this.getByIdAsync(ticketId);
    if (!existing) return null;

    const newMsg: SupportTicketMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...messageData
    };

    const updatedMessages = [...(existing.messages || []), newMsg];
    const newStatus = messageData.senderRole.toLowerCase().includes('admin') ? 'waiting_user' : 'in_progress';
    const now = new Date().toISOString();

    if (isMongoConfigured()) {
      const coll = await getSupportTicketsCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { $or: [{ id: existing.id }, { ticketNumber: existing.ticketNumber }] },
        { $set: { messages: updatedMessages, status: newStatus, updatedAt: now } },
        { returnDocument: 'after' }
      );
      if (!updatedDoc) return null;
      const { _id, ...rest } = updatedDoc;
      try {
        Database.updateSupportTicket(existing.id, { messages: updatedMessages, status: newStatus });
      } catch {}
      return rest as SupportTicket;
    }

    return Database.updateSupportTicket(existing.id, {
      messages: updatedMessages,
      status: newStatus
    });
  }

  static addMessage(
    ticketId: string,
    messageData: { senderId: string; senderName: string; senderRole: string; message: string; attachments?: string[] }
  ): SupportTicket | null {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous addMessage is prohibited to ensure authoritative persistence; use addMessageAsync.');
    }
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

    return updated;
  }

  static async updateStatusAsync(ticketId: string, status: SupportTicket['status']): Promise<SupportTicket | null> {
    const existing = await this.getByIdAsync(ticketId);
    if (!existing) return null;
    const now = new Date().toISOString();

    if (isMongoConfigured()) {
      const coll = await getSupportTicketsCollection();
      const updatedDoc = await coll.findOneAndUpdate(
        { $or: [{ id: existing.id }, { ticketNumber: existing.ticketNumber }] },
        { $set: { status, updatedAt: now } },
        { returnDocument: 'after' }
      );
      if (!updatedDoc) return null;
      const { _id, ...rest } = updatedDoc;
      try {
        Database.updateSupportTicket(existing.id, { status });
      } catch {}
      return rest as SupportTicket;
    }

    return Database.updateSupportTicket(existing.id, { status });
  }

  static updateStatus(ticketId: string, status: SupportTicket['status']): SupportTicket | null {
    if (isMongoConfigured()) {
      throw new Error('MongoDB is configured. Synchronous updateStatus is prohibited to ensure authoritative persistence; use updateStatusAsync.');
    }
    const updated = Database.updateSupportTicket(ticketId, { status });
    return updated;
  }
}

