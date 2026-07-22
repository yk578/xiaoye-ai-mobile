/**
 * ConversationStore — 对话持久化存储
 *
 * 将对话保存到 SQLite，支持列表浏览、历史加载、删除。
 */

import * as SQLite from 'expo-sqlite'

interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  model: string
}

interface MessageRecord {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoningContent?: string
  timestamp: number
}

let db: SQLite.SQLiteDatabase | null = null

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('xiaoye-conversations.db')
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '新对话',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        model TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
        content TEXT NOT NULL,
        reasoning_content TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, timestamp);
    `)
  }
  return db
}

/* ── 对话管理 ── */

export async function createConversation(
  id: string,
  model: string = ''
): Promise<void> {
  const now = Date.now()
  const d = await getDb()
  await d.runAsync(
    `INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at, message_count, model)
     VALUES (?, '新对话', ?, ?, 0, ?)`,
    id, now, now, model
  )
}

export async function updateConversationTitle(
  id: string,
  title: string
): Promise<void> {
  const d = await getDb()
  await d.runAsync(
    'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
    title, Date.now(), id
  )
}

export async function deleteConversation(id: string): Promise<void> {
  const d = await getDb()
  await d.runAsync('DELETE FROM messages WHERE conversation_id = ?', id)
  await d.runAsync('DELETE FROM conversations WHERE id = ?', id)
}

export async function listConversations(): Promise<Conversation[]> {
  const d = await getDb()
  const rows = await d.getAllAsync<Conversation>(
    'SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50'
  )
  return rows
}

/* ── 消息管理 ── */

export async function addMessage(msg: {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoningContent?: string
}): Promise<void> {
  const d = await getDb()
  const now = Date.now()
  await d.runAsync(
    `INSERT OR REPLACE INTO messages (id, conversation_id, role, content, reasoning_content, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`,
    msg.id, msg.conversationId, msg.role, msg.content, msg.reasoningContent || null, now
  )
  // 更新对话计数和时间
  await d.runAsync(
    `UPDATE conversations SET message_count = message_count + 1, updated_at = ? WHERE id = ?`,
    now, msg.conversationId
  )
}

export async function getMessages(
  conversationId: string
): Promise<MessageRecord[]> {
  const d = await getDb()
  const rows = await d.getAllAsync<MessageRecord>(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
    conversationId
  )
  return rows
}

export async function getConversation(
  id: string
): Promise<Conversation | null> {
  const d = await getDb()
  const row = await d.getFirstAsync<Conversation>(
    'SELECT * FROM conversations WHERE id = ?',
    id
  )
  return row || null
}

/** 根据历史消息自动生成对话标题 */
export async function autoTitle(
  conversationId: string
): Promise<void> {
  const msgs = await getMessages(conversationId)
  const firstUser = msgs.find(m => m.role === 'user')
  if (!firstUser) return
  const title = firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? '...' : '')
  await updateConversationTitle(conversationId, title)
}

/** 清理旧对话（保留最近 50 个） */
export async function cleanupOldConversations(): Promise<void> {
  const d = await getDb()
  await d.runAsync(`
    DELETE FROM conversations WHERE id NOT IN (
      SELECT id FROM conversations ORDER BY updated_at DESC LIMIT 50
    )
  `)
  // 清理孤立消息
  await d.runAsync(`
    DELETE FROM messages WHERE conversation_id NOT IN (
      SELECT id FROM conversations
    )
  `)
}
