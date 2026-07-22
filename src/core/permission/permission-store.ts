/**
 * 权限持久化存储 — 基于 expo-sqlite
 *
 * 存储全局权限模式和工具调用历史（供审计）。
 */

import * as SQLite from 'expo-sqlite'
import type { GlobalMode, PatternRule } from '../../types'

let db: SQLite.SQLiteDatabase | null = null

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('xiaoye-permissions.db')
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS permissions (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tool_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        tool_args TEXT,
        decision TEXT NOT NULL,
        error TEXT,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tool_history_time ON tool_history(timestamp DESC);
    `)
  }
  return db
}

async function get(key: string): Promise<string | null> {
  const d = await getDb()
  const row = await d.getFirstAsync<{ value: string }>(
    'SELECT value FROM permissions WHERE key = ?', key
  )
  return row?.value ?? null
}

async function set(key: string, value: string): Promise<void> {
  const d = await getDb()
  await d.runAsync(
    'INSERT OR REPLACE INTO permissions (key, value) VALUES (?, ?)', key, value
  )
}

/* ── 全局模式 ── */

export async function getGlobalMode(): Promise<GlobalMode> {
  const raw = await get('globalMode')
  return (raw as GlobalMode) || 'ask'
}

export async function setGlobalMode(mode: GlobalMode): Promise<void> {
  await set('globalMode', mode)
}

/* ── 模式规则 ── */

export async function getPatternRules(): Promise<PatternRule[]> {
  const raw = await get('patternRules')
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export async function savePatternRules(rules: PatternRule[]): Promise<void> {
  await set('patternRules', JSON.stringify(rules))
}

export async function addPatternRule(rule: PatternRule): Promise<void> {
  const rules = await getPatternRules()
  rules.push(rule)
  await savePatternRules(rules)
}

export async function removePatternRule(id: string): Promise<void> {
  let rules = await getPatternRules()
  rules = rules.filter(r => r.id !== id)
  await savePatternRules(rules)
}

/* ── 工具调用历史 ── */

export interface ToolHistoryEntry {
  id: number
  toolName: string
  toolArgs: string
  decision: string
  error: string | null
  timestamp: number
}

export async function recordToolCall(
  toolName: string,
  toolArgs: string,
  decision: string,
  error?: string
): Promise<void> {
  const d = await getDb()
  await d.runAsync(
    `INSERT INTO tool_history (tool_name, tool_args, decision, error, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    toolName, toolArgs, decision, error || null, Date.now()
  )
}

export async function getToolHistory(limit: number = 50): Promise<ToolHistoryEntry[]> {
  const d = await getDb()
  const rows = await d.getAllAsync<ToolHistoryEntry>(
    'SELECT * FROM tool_history ORDER BY timestamp DESC LIMIT ?', limit
  )
  return rows
}

export async function clearToolHistory(): Promise<void> {
  const d = await getDb()
  await d.runAsync('DELETE FROM tool_history')
}
