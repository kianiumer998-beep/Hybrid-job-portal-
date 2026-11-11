import { Collection, Db } from 'mongodb';
import { getMongoDb, withMongoTimeout, isMongoConfigured } from '../mongodb';
import { ChatMessage } from '../../../src/types/job';

let testMessages: ChatMessage[] = [];

export class ChatMessageRepository {
  private static collectionName = 'chat_messages';

  private static indexesInitialized = false;

  private static async getCollection(): Promise<Collection<ChatMessage>> {
    const db: Db = await getMongoDb();
    const collection = db.collection<ChatMessage>(this.collectionName);
    
    if (!this.indexesInitialized && isMongoConfigured()) {
      try {
        await collection.createIndex({ userId: 1, id: 1 }, { unique: true });
        this.indexesInitialized = true;
      } catch (err) {
        console.warn('[ChatMessageRepository] Index creation note:', err);
      }
    }
    
    return collection;
  }

  static async save(message: ChatMessage): Promise<ChatMessage> {
    if (process.env.IS_TEST === 'true' && !isMongoConfigured()) {
      const existing = testMessages.find(m => m.userId === message.userId && m.id === message.id);
      if (existing) return existing;
      testMessages.push({ ...message });
      return message;
    }

    if (!isMongoConfigured()) {
      throw new Error('Database unavailable: MongoDB is not configured.');
    }

    const collection = await this.getCollection();
    
    // User-scoped idempotency: use updateOne with upsert to prevent duplicates for same user
    await withMongoTimeout(
      collection.updateOne(
        { userId: message.userId, id: message.id },
        { $setOnInsert: message },
        { upsert: true }
      ),
      5000,
      'SaveChatMessage'
    );

    // Return authoritative stored document
    const stored = await withMongoTimeout(
      collection.findOne({ userId: message.userId, id: message.id }),
      2000,
      'FindAuthoritativeChatMessage'
    );

    if (!stored) {
      throw new Error('Failed to retrieve authoritative chat message after save.');
    }

    return this.normalize(stored);
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
    // To get the latest N messages in chronological order:
    // 1. Sort by timestamp DESC to get the newest ones
    // 2. Limit to the requested count
    // 3. Reverse the array to restore chronological order
    const messages = await withMongoTimeout(
      collection.find().sort({ timestamp: -1 }).limit(limit).toArray(),
      10000,
      'GetAllChatMessages'
    );

    return messages.map(this.normalize).reverse();
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
