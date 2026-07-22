/**
 * 模板库 — 常用提示模板和快捷操作
 *
 * 提供预设的 AI 对话模板，提升使用效率。
 */

import * as SQLite from 'expo-sqlite'

export interface Template {
  id: string
  title: string
  description: string
  icon: string
  prompt: string
  category: string
  tags: string[]
  createdAt: number
  usageCount: number
}

/* ── 内置模板 ── */

const BUILTIN_TEMPLATES: Omit<Template, 'id' | 'createdAt' | 'usageCount'>[] = [
  {
    title: '代码审查',
    description: '审查代码质量和安全性',
    icon: '🔍',
    category: '开发',
    tags: ['代码', '审查', '质量'],
    prompt: '请帮我审查以下代码，关注代码质量、安全漏洞、性能问题和可维护性：',
  },
  {
    title: 'Bug 修复',
    description: '分析和修复代码 Bug',
    icon: '🐛',
    category: '开发',
    tags: ['bug', '修复', '调试'],
    prompt: '以下代码出现了 Bug，请帮我分析原因并修复：\n\n错误信息：\n[错误]\n\n相关代码：\n[代码]',
  },
  {
    title: '新增功能',
    description: '实现一个新功能',
    icon: '✨',
    category: '开发',
    tags: ['功能', '实现', '新特性'],
    prompt: '请帮我实现以下功能。先在现有代码中搜索相关文件，理解项目结构，然后进行最小化修改：\n\n功能描述：',
  },
  {
    title: '重构代码',
    description: '重构优化代码结构',
    icon: '♻️',
    category: '开发',
    tags: ['重构', '优化', '结构'],
    prompt: '请帮我重构以下代码，提高可读性和可维护性，保持功能不变：',
  },
  {
    title: '编写测试',
    description: '为代码编写单元测试',
    icon: '🧪',
    category: '测试',
    tags: ['测试', '单元测试', '验证'],
    prompt: '请为以下代码编写单元测试用例，覆盖主要功能和边界情况：',
  },
  {
    title: '解释代码',
    description: '解释代码的工作原理',
    icon: '📖',
    category: '学习',
    tags: ['解释', '理解', '文档'],
    prompt: '请帮我详细解释以下代码的工作原理和设计思路：',
  },
  {
    title: '性能优化',
    description: '分析和优化性能瓶颈',
    icon: '⚡',
    category: '优化',
    tags: ['性能', '优化', '加速'],
    prompt: '请分析以下代码的性能瓶颈，提出具体的优化方案：',
  },
  {
    title: 'Git 操作',
    description: 'Git 命令和版本控制',
    icon: '🔀',
    category: '工具',
    tags: ['git', '版本控制', '分支'],
    prompt: '请帮我完成以下 Git 操作，解释每个命令的作用：',
  },
  {
    title: '架构设计',
    description: '讨论系统架构方案',
    icon: '🏗️',
    category: '设计',
    tags: ['架构', '设计', '系统'],
    prompt: '我需要设计一个系统架构，请帮我分析不同方案的优劣：\n\n需求：',
  },
  {
    title: 'API 设计',
    description: '设计 RESTful/GraphQL API',
    icon: '🔌',
    category: '设计',
    tags: ['API', '接口', '设计'],
    prompt: '请帮我设计一套 API 接口，包括端点定义、请求/响应格式和错误处理：',
  },
  {
    title: '数据库设计',
    description: '设计数据库表结构',
    icon: '🗄️',
    category: '设计',
    tags: ['数据库', '表结构', 'SQL'],
    prompt: '请帮我设计数据库表结构，包括字段类型、索引和关系：',
  },
  {
    title: '配置文件',
    description: '生成或修改配置文件',
    icon: '⚙️',
    category: '配置',
    tags: ['配置', '设置', '环境'],
    prompt: '请帮我生成以下配置文件，根据项目需求进行调整：',
  },
]

/* ── SQLite 存储 ── */

let db: SQLite.SQLiteDatabase | null = null

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('xiaoye-templates.db')
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        icon TEXT NOT NULL DEFAULT '📄',
        prompt TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '通用',
        tags TEXT NOT NULL DEFAULT '[]',
        createdAt INTEGER NOT NULL,
        usageCount INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS custom_templates (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        icon TEXT NOT NULL DEFAULT '📄',
        prompt TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '自定义',
        tags TEXT NOT NULL DEFAULT '[]',
        createdAt INTEGER NOT NULL,
        usageCount INTEGER NOT NULL DEFAULT 0
      );
    `)
    await seedBuiltinTemplates()
  }
  return db
}

async function seedBuiltinTemplates(): Promise<void> {
  const d = await getDb()
  const row = await d.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM templates'
  )
  if (row && row.cnt > 0) return

  const now = Date.now()
  for (let i = 0; i < BUILTIN_TEMPLATES.length; i++) {
    const t = BUILTIN_TEMPLATES[i]
    await d.runAsync(
      `INSERT INTO templates (id, title, description, icon, prompt, category, tags, createdAt, usageCount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      `builtin-${i}`, t.title, t.description, t.icon, t.prompt,
      t.category, JSON.stringify(t.tags), now + i
    )
  }
}

/* ── CRUD ── */

export async function getAllTemplates(): Promise<Template[]> {
  const d = await getDb()
  const builtin = await d.getAllAsync<Template>(
    'SELECT * FROM templates ORDER BY category, title'
  )
  const custom = await d.getAllAsync<Template>(
    'SELECT * FROM custom_templates ORDER BY createdAt DESC'
  )
  return [...builtin, ...custom].map(t => ({
    ...t,
    tags: typeof t.tags === 'string' ? JSON.parse(t.tags as string) : t.tags,
  }))
}

export async function getTemplatesByCategory(): Promise<Record<string, Template[]>> {
  const all = await getAllTemplates()
  const grouped: Record<string, Template[]> = {}
  for (const t of all) {
    if (!grouped[t.category]) grouped[t.category] = []
    grouped[t.category].push(t)
  }
  return grouped
}

export async function addCustomTemplate(
  data: Omit<Template, 'id' | 'createdAt' | 'usageCount'>
): Promise<Template> {
  const d = await getDb()
  const id = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
  const now = Date.now()
  await d.runAsync(
    `INSERT INTO custom_templates (id, title, description, icon, prompt, category, tags, createdAt, usageCount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    id, data.title, data.description, data.icon, data.prompt,
    data.category, JSON.stringify(data.tags), now
  )
  return { id, ...data, createdAt: now, usageCount: 0 }
}

export async function deleteCustomTemplate(id: string): Promise<void> {
  const d = await getDb()
  await d.runAsync('DELETE FROM custom_templates WHERE id = ?', id)
}

export async function recordTemplateUsage(id: string): Promise<void> {
  const d = await getDb()
  const isCustom = id.startsWith('custom-')
  const table = isCustom ? 'custom_templates' : 'templates'
  await d.runAsync(
    `UPDATE ${table} SET usageCount = usageCount + 1 WHERE id = ?`, id
  )
}

export async function getPopularTemplates(limit: number = 6): Promise<Template[]> {
  const all = await getAllTemplates()
  return all
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, limit)
}

export async function searchTemplates(query: string): Promise<Template[]> {
  const all = await getAllTemplates()
  const lower = query.toLowerCase()
  return all.filter(t =>
    t.title.toLowerCase().includes(lower) ||
    t.description.toLowerCase().includes(lower) ||
    t.tags.some(tag => tag.toLowerCase().includes(lower))
  )
}
