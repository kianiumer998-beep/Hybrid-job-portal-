import { Collection, Db } from 'mongodb';
import { getMongoDb, withMongoTimeout, isMongoConfigured } from '../mongodb';
import { ChatMessage } from '../../../src/types/job';

let testMessages: ChatMessage[] = [];

export class ChatMessageRepository {
  private static collectionName = 'chat_messages';

  private static async getCollection(): Promise<Collection<ChatMessage>> {
    const db: Db = await getMongoDb();
    return db.collection<ChatMessage>(this.collectionName);
  }

  static async save(message: ChatMessage): Promise<ChatMessage> {
    if (process.env.IS_TEST === 'true' && !isMongoConfigured()) {
      const existing = testMessages.find(m => m.id === message.id);
      if (existing) return existing;
      testMessages.push(message);
      return message;
    }

    if (!isMongoConfigured()) {
      throw new Error('Database unavailable: MongoDB is not configured.');
    }

    const collection = await this.getCollection();
    
    // Idempotency: use updateOne with upsert to prevent duplicates if client retries
    await withMongoTimeout(
      collection.updateOne(
        { id: message.id },
        { $setOnInsert: message },
        { upsert: true }
      ),
      5000,
      'SaveChatMessage'
    );

    return message;
  }

  static async getByUserId(userId: string): Promise<ChatMessage[]> {
    if (process.env.IS_TEST === 'true' && !isMongoConfigured()) {
      return testMessages
        .filter(m => m.userId === userId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    if (!isMongoConfigured()) {
      throw new Error('Database unavailable: MongoDB is not configured.');
    }

    const collection = await this.getCollection();
    const messages = await withMongoTimeout(
      collection.find({ userId }).sort({ timestamp: 1 }).toArray(),
      5000,
      'GetChatByUserId'
    );

    return messages.map(this.normalize);
  }

  static async getAll(limit = 1000): Promise<ChatMessage[]> {
    if (process.env.IS_TEST === 'true' && !isMongoConfigured()) {
      return [...testMessages]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-limit);
    }

    if (!isMongoConfigured()) {
      throw new Error('Database unavailable: MongoDB is not configured.');
    }

    const collection = await this.getCollection();
    const messages = await withMongoTimeout(
      collection.find().sort({ timestamp: 1 }).limit(limit).toArray(),
      10000,
      'GetAllChatMessages'
    );

    return messages.map(this.normalize);
  }

  static async deleteByUserId(userId: string): Promise<number> {
    if (process.env.IS_TEST === 'true' && !isMongoConfigured()) {
      const initialCount = testMessages.length;
      testMessages = testMessages.filter(m => m.userId !== userId);
      return initialCount - testMessages.length;
    }

    if (!isMongoConfigured()) {
      throw new Error('Database unavailable: MongoDB is not configured.');
    }

    const collection = await this.getCollection();
    const result = await withMongoTimeout(
      collection.deleteMany({ userId }),
      5000,
      'DeleteChatByUserId'
    );

    return result.deletedCount;
  }

  private static normalize(doc: any): ChatMessage {
    const { _id, ...message } = doc;
    return message as ChatMessage;
  }

  static resetTestStore(): void {
    testMessages = [];
  }
}
