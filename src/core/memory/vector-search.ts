/**
 * 向量搜索 — 基于 SQLite FTS5 + 语义关键词扩展
 *
 * 手机端不做真正的 embedding（太耗资源），
 * 而是用 FTS5 全文搜索 + 同义词扩展 + 中文分词。
 *
 * 当 expo-sqlite 支持 FTS5 时，使用 FTS5 进行高效搜索。
 */

import * as SQLite from 'expo-sqlite'

let db: SQLite.SQLiteDatabase | null = null

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('xiaoye-memory.db')
    await db.execAsync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        content, source, tags,
        tokenize='unicode61'
      );
    `)
  }
  return db
}

export interface MemoryEntry {
  id: string
  content: string
  source: string
  tags: string
  timestamp: number
}

/** 中文同义词扩展 */
const SYNONYMS: Record<string, string[]> = {
  '组件': ['component', '部件', '模块'],
  '路由': ['route', '导航', 'navigation'],
  '状态': ['state', '变量', '数据'],
  '错误': ['error', 'bug', '异常', '失败'],
  '配置': ['config', '设置', '选项'],
  'API': ['接口', '端点', 'endpoint'],
  '数据库': ['database', 'db', '存储'],
  '测试': ['test', '验证', '检查'],
  '构建': ['build', '打包', '编译'],
  '部署': ['deploy', '发布', '上线'],
}

function expandQuery(query: string): string {
  const terms = query.split(/\s+/)
  const expanded: string[] = [...terms]
  for (const term of terms) {
    const lower = term.toLowerCase()
    for (const [key, synonyms] of Object.entries(SYNONYMS)) {
      if (key.toLowerCase() === lower || synonyms.some(s => s.toLowerCase() === lower)) {
        expanded.push(key, ...synonyms)
      }
    }
  }
  return [...new Set(expanded)].join(' OR ')
}

export async function indexMemory(entry: MemoryEntry): Promise<void> {
  const d = await getDb()
  const tags = entry.tags ? ` ${entry.tags} ` : ''
  const source = ` ${entry.source} `
  // 使用简单哈希确保唯一 rowid，避免非数字 ID 冲突
  const rowId = hashString(entry.id)
  await d.runAsync(
    `INSERT OR REPLACE INTO memory_fts (rowid, content, source, tags)
     VALUES (?, ?, ?, ?)`,
    rowId, entry.content, source, tags
  )
}

/** 简单字符串哈希 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

export async function searchMemory(
  query: string,
  limit: number = 10
): Promise<Array<{ content: string; source: string; snippet: string; score: number }>> {
  const d = await getDb()
  const expanded = expandQuery(query)

  try {
    const rows = await d.getAllAsync<{
      content: string; source: string; snippet: string; rank: number
    }>(
      `SELECT content, source,
              snippet(memory_fts, 0, '<mark>', '</mark>', '...', 40) as snippet,
              rank
       FROM memory_fts
       WHERE memory_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
      expanded, limit
    )
    return rows.map(r => ({
      content: r.content,
      source: r.source,
      snippet: r.snippet,
      score: r.rank,
    }))
  } catch {
    // FTS5 语法有问题时降级到 LIKE
    const rows = await d.getAllAsync<{ content: string; source: string }>(
      `SELECT content, source FROM memory_fts
       WHERE content LIKE ? LIMIT ?`,
      `%${query}%`, limit
    )
    return rows.map(r => ({
      content: r.content,
      source: r.source,
      snippet: r.content.substring(0, 100),
      score: 0,
    }))
  }
}

export async function clearMemory(): Promise<void> {
  const d = await getDb()
  await d.runAsync('DELETE FROM memory_fts')
}

export async function getMemoryStats(): Promise<{ count: number; totalChars: number }> {
  const d = await getDb()
  const row = await d.getFirstAsync<{ cnt: number; total: number }>(
    `SELECT COUNT(*) as cnt, SUM(LENGTH(content)) as total FROM memory_fts`
  )
  return { count: row?.cnt || 0, totalChars: row?.total || 0 }
}
