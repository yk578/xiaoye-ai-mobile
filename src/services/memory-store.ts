/**
 * 记忆存储 — expo-sqlite 版
 *
 * 替代桌面端的 sql.js（WASM），使用原生 SQLite + FTS5。
 */

import * as SQLite from 'expo-sqlite'

let db: SQLite.SQLiteDatabase | null = null

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('xiaoye-memory.db')
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        reasoning_content TEXT DEFAULT '',
        timestamp TEXT NOT NULL,
        token_count INTEGER DEFAULT 0,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(timestamp);
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        content, reasoning_content,
        tokenize='unicode61'
      );
      CREATE TRIGGER IF NOT EXISTS messages_ftsi AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts (rowid, content, reasoning_content)
        VALUES (new.rowid, new.content, new.reasoning_content);
      END;
      CREATE TABLE IF NOT EXISTS summaries (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        level TEXT NOT NULL,
        content TEXT NOT NULL,
        model TEXT DEFAULT '',
        token_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_summaries_conv ON summaries(conversation_id);
    `)
  }
  return db
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoningContent?: string
  timestamp: string
  tokenCount: number
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount?: number
}

/* ── 对话 CRUD ── */

export async function createConversation(id: string, title?: string): Promise<void> {
  const d = await getDb()
  const now = new Date().toISOString()
  await d.runAsync(
    'INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    id, title || '新对话', now, now
  )
}

export async function listConversations(): Promise<Conversation[]> {
  const d = await getDb()
  const rows = await d.getAllAsync<Record<string, unknown>>(`
    SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as messageCount
    FROM conversations c ORDER BY c.updated_at DESC
  `)
  return rows.map(r => ({
    id: r.id as string,
    title: r.title as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    messageCount: r.messageCount as number,
  }))
}

export async function deleteConversation(id: string): Promise<void> {
  const d = await getDb()
  await d.runAsync('DELETE FROM messages WHERE conversation_id = ?', id)
  await d.runAsync('DELETE FROM conversations WHERE id = ?', id)
}

export async function updateConversationTitle(id: string, title: string): Promise<void> {
  const d = await getDb()
  await d.runAsync('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', title, new Date().toISOString(), id)
}

/* ── 消息 CRUD ── */

export async function addMessage(msg: Message): Promise<void> {
  const d = await getDb()
  await d.runAsync(
    'INSERT OR IGNORE INTO messages (id, conversation_id, role, content, reasoning_content, timestamp, token_count) VALUES (?, ?, ?, ?, ?, ?, ?)',
    msg.id, msg.conversationId, msg.role, msg.content, msg.reasoningContent || '', msg.timestamp, msg.tokenCount
  )
  await d.runAsync('UPDATE conversations SET updated_at = ? WHERE id = ?', msg.timestamp, msg.conversationId)
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const d = await getDb()
  const rows = await d.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC', conversationId
  )
  return rows.map(r => ({
    id: r.id as string,
    conversationId: r.conversation_id as string,
    role: r.role as Message['role'],
    content: r.content as string,
    reasoningContent: r.reasoning_content as string || undefined,
    timestamp: r.timestamp as string,
    tokenCount: r.token_count as number,
  }))
}

/* ── 全文搜索 ── */

export async function searchMessages(query: string): Promise<Array<{ message: Message; snippet: string }>> {
  const d = await getDb()
  const escaped = query.replace(/["']/g, '')
  try {
    const rows = await d.getAllAsync<Record<string, unknown>>(
      `SELECT m.*, snippet(messages_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
       FROM messages_fts f JOIN messages m ON f.rowid = m.rowid
       WHERE messages_fts MATCH ? ORDER BY m.timestamp DESC LIMIT 50`,
      escaped
    )
    return rows.map(r => ({
      message: {
        id: r.id as string,
        conversationId: r.conversation_id as string,
        role: r.role as Message['role'],
        content: r.content as string,
        reasoningContent: r.reasoning_content as string || undefined,
        timestamp: r.timestamp as string,
        tokenCount: r.token_count as number,
      },
      snippet: (r.snippet as string) || '',
    }))
  } catch {
    // 搜索词有问题时降级到 LIKE
    const rows = await d.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM messages WHERE content LIKE ? ORDER BY timestamp DESC LIMIT 50`,
      `%${query}%`
    )
    return rows.map(r => ({
      message: {
        id: r.id as string,
        conversationId: r.conversation_id as string,
        role: r.role as Message['role'],
        content: r.content as string,
        timestamp: r.timestamp as string,
        tokenCount: r.token_count as number,
      },
      snippet: (r.content as string).substring(0, 100),
    }))
  }
}
