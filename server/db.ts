import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, models, conversations, messages, InsertModel, InsertConversation, InsertMessage } from "../drizzle/schema";
import { ENV } from './_core/env';
import type { Model, Conversation, Message } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Model queries
export async function getAllModels() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(models).orderBy(models.createdAt);
}

export async function getModelById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(models).where(eq(models.id, id)).limit(1);
  return result[0];
}

export async function createModel(data: InsertModel) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(models).values(data);
  return result;
}

export async function updateModel(id: number, data: Partial<InsertModel>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(models).set(data).where(eq(models.id, id));
}

export async function deleteModel(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(models).where(eq(models.id, id));
}

// Conversation queries
export async function createConversation(data: InsertConversation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(conversations).values(data);
  const insertId = (result as any)[0]?.insertId || (result as any).insertId;
  if (insertId && insertId > 0) {
    const conversation = await db.select().from(conversations).where(eq(conversations.id, Number(insertId))).limit(1);
    if (conversation[0]) {
      return conversation[0];
    }
  }
  const allConversations = await db.select().from(conversations).orderBy(desc(conversations.id)).limit(1);
  return allConversations[0] || { id: 0, ...data };
}

export async function getConversationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return result[0];
}

// Message queries
export async function addMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(messages).values(data);
}

export async function getConversationMessages(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
}
