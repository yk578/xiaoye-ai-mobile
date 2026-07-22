/**
 * MemoryStore — 手机端 KV 记忆存储
 *
 * 基于 expo-file-system 的 JSON 文件存储，
 * 写入失败自动降级到内存。
 *
 * 对比 config-store：增加重要性排序 + 关键词检索。
 */

import * as FileSystem from 'expo-file-system/legacy'
import type { MemoryEntry, MemoryCategory, MemoryType } from './memory-types'

const STORE_DIR = 'xiaoye-memory/'
const STORE_FILE = 'entries.json'

let storePath = ''
let cache: MemoryEntry[] | null = null

function ensurePath(): boolean {
  if (storePath) return true
  try {
    const docDir = FileSystem.documentDirectory
    if (!docDir) return false
    storePath = `${docDir}${STORE_DIR}${STORE_FILE}`
    return true
  } catch {
    return false
  }
}

async function loadAll(): Promise<MemoryEntry[]> {
  if (cache) return cache
  cache = []
  if (!ensurePath()) return cache
  try {
    const raw = await FileSystem.readAsStringAsync(storePath)
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) cache = parsed as MemoryEntry[]
  } catch { /* 首次启动文件不存在 */ }
  return cache
}

async function flush(): Promise<void> {
  if (!cache) return
  if (!ensurePath()) return
  try {
    await FileSystem.writeAsStringAsync(storePath, JSON.stringify(cache))
  } catch {
    /* 写失败保持内存可用 */
  }
}

/* ── 添加记忆 ── */

let idCounter = Date.now()
function nextId(): string {
  return `mem_${(++idCounter).toString(36)}`
}

export async function remember(
  content: string,
  category: MemoryCategory,
  type: MemoryType = 'longterm',
  importance: number = 5,
  keywords?: string[]
): Promise<string> {
  const entries = await loadAll()
  const now = Date.now()
  const entry: MemoryEntry = {
    id: nextId(),
    type,
    category,
    content,
    keywords: keywords || extractKeywords(content),
    importance,
    createdAt: now,
    updatedAt: now,
    accessCount: 0,
  }
  entries.push(entry)
  cache = entries
  await flush()
  return entry.id
}

/* ── 检索记忆 ── */

export async function recall(query: string, maxResults: number = 10): Promise<MemoryEntry[]> {
  const entries = await loadAll()
  const lowerQ = query.toLowerCase()
  const words = lowerQ.split(/\s+/).filter(Boolean)

  const scored = entries
    .filter(e => e.type === 'longterm' || e.type === 'config')
    .map(e => {
      let score = 0
      // 关键词命中
      for (const kw of e.keywords) {
        for (const w of words) {
          if (kw.toLowerCase().includes(w)) score += 3
          if (w.includes(kw.toLowerCase())) score += 1
        }
      }
      // 内容命中
      const lower = e.content.toLowerCase()
      for (const w of words) {
        if (lower.includes(w)) score += 1
      }
      // 重要性加成
      score += e.importance * 0.5
      // 访问频率加成
      score += Math.log1p(e.accessCount) * 0.3
      // 时效衰减（30天减半）
      const ageDays = (Date.now() - e.updatedAt) / 86400000
      score *= Math.max(0.3, 1 - ageDays / 60)
      return { entry: e, score }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)

  // 更新 accessCount
  for (const s of scored) {
    s.entry.accessCount++
  }
  await flush()

  return scored.map(s => s.entry)
}

/* ── 获取最近的对话总结 ── */

export async function getRecentSummaries(limit: number = 5): Promise<MemoryEntry[]> {
  const entries = await loadAll()
  return entries
    .filter(e => e.category === 'conversation')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
}

/* ── 获取自我配置记录 ── */

export async function getConfigHistory(): Promise<MemoryEntry[]> {
  const entries = await loadAll()
  return entries
    .filter(e => e.category === 'config_change')
    .sort((a, b) => b.createdAt - a.createdAt)
}

/* ── 删除记忆 ── */

export async function forget(id: string): Promise<void> {
  const entries = await loadAll()
  cache = entries.filter(e => e.id !== id)
  await flush()
}

/* ── 清除所有记忆 ── */

export async function clearAll(): Promise<void> {
  cache = []
  if (ensurePath()) {
    try {
      await FileSystem.writeAsStringAsync(storePath, '[]')
    } catch { /* ignore */ }
  }
}

/* ── 工具函数 ── */

function extractKeywords(text: string): string[] {
  const words = text.split(/\s+/).filter(w => w.length >= 2)
  const unique = new Set<string>()
  for (const w of words) {
    if (w.length <= 10) unique.add(w.slice(0, 20))
  }
  return Array.from(unique).slice(0, 20)
}

/* ── 导出统计 ── */

export async function getStats(): Promise<{
  total: number
  byType: Record<string, number>
  byCategory: Record<string, number>
}> {
  const entries = await loadAll()
  const byType: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  for (const e of entries) {
    byType[e.type] = (byType[e.type] || 0) + 1
    byCategory[e.category] = (byCategory[e.category] || 0) + 1
  }
  return { total: entries.length, byType, byCategory }
}
