/**
 * 权限引擎 — 工具调用安全控制
 *
 * 管理"允许/拒绝/询问"的权限决策：
 * - 全局模式（允许所有 / 拒绝所有 / 询问）
 * - 按工具名模式匹配（正则）
 * - 支持标记为破坏性操作（需要额外确认）
 */

import type { ToolCall, GlobalMode, PatternRule } from '../../types'

export type Decision = 'allow' | 'deny' | 'ask'

export interface PermissionEngineConfig {
  globalMode: GlobalMode
  patternRules: PatternRule[]
  /** 标记为破坏性的工具名列表（需二次确认） */
  destructiveTools: string[]
}

const DEFAULT_DESTRUCTIVE_TOOLS = [
  'write', 'execute', 'delete',
  'rm', 'git', 'npm', 'pip', 'yarn',
]

export class PermissionEngine {
  private globalMode: GlobalMode = 'ask'
  private patternRules: Map<string, { decision: Decision; pattern: RegExp }> = new Map()
  private destructiveTools: Set<string>

  constructor(config?: Partial<PermissionEngineConfig>) {
    this.destructiveTools = new Set(config?.destructiveTools || DEFAULT_DESTRUCTIVE_TOOLS)
    if (config?.globalMode) this.globalMode = config.globalMode
    if (config?.patternRules) {
      for (const rule of config.patternRules) {
        try {
          this.patternRules.set(rule.id, {
            decision: rule.decision,
            pattern: new RegExp(rule.pattern, 'i'),
          })
        } catch { /* 无效正则跳过 */ }
      }
    }
  }

  /** 判断工具调用是否需要确认 */
  shouldAsk(toolCall: ToolCall): Decision {
    // 1. 检查全局模式
    if (this.globalMode === 'deny_all') return 'deny'
    if (this.globalMode === 'allow_all') return 'allow'

    // 2. 检查模式规则（精确匹配优先）
    for (const rule of this.patternRules.values()) {
      if (rule.pattern.test(toolCall.name)) {
        return rule.decision
      }
    }

    // 3. 破坏性工具默认需要确认
    if (this.isDestructive(toolCall.name)) {
      return 'ask'
    }

    // 4. 非破坏性读取操作默认允许
    return 'allow'
  }

  /** 是否为破坏性操作 */
  isDestructive(toolName: string): boolean {
    return this.destructiveTools.has(toolName)
  }

  /** 更新全局模式 */
  setGlobalMode(mode: GlobalMode): void {
    this.globalMode = mode
  }

  /** 添加/更新模式规则 */
  addRule(rule: PatternRule): void {
    try {
      this.patternRules.set(rule.id, {
        decision: rule.decision,
        pattern: new RegExp(rule.pattern, 'i'),
      })
    } catch { /* 无效正则跳过 */ }
  }

  /** 删除模式规则 */
  removeRule(id: string): void {
    this.patternRules.delete(id)
  }

  /** 添加破坏性工具标记 */
  addDestructive(toolName: string): void {
    this.destructiveTools.add(toolName)
  }

  /** 获取当前配置（用于持久化） */
  getConfig(): Omit<PermissionEngineConfig, 'patternRules'> & {
    patternRules: Array<{ id: string; pattern: string; decision: Decision }>
  } {
    return {
      globalMode: this.globalMode,
      patternRules: Array.from(this.patternRules.entries()).map(([id, rule]) => ({
        id,
        pattern: rule.pattern.source,
        decision: rule.decision,
      })),
      destructiveTools: Array.from(this.destructiveTools),
    }
  }
}

/** 获取工具的描述性名称（中文） */
export function getToolDisplayName(toolName: string): string {
  const MAP: Record<string, string> = {
    read: '读取文件',
    write: '写入/修改文件',
    execute: '执行命令',
    glob: '搜索文件',
    grep: '搜索内容',
    delete: '删除文件',
    web_search: '搜索网页',
    web_fetch: '抓取网页',
  }
  return MAP[toolName] || toolName
}

/** 获取工具的图标 */
export function getToolIcon(toolName: string): string {
  const MAP: Record<string, string> = {
    read: '📖',
    write: '✏️',
    execute: '⚡',
    glob: '🔍',
    grep: '🔎',
    delete: '🗑️',
    web_search: '🌐',
    web_fetch: '📥',
  }
  return MAP[toolName] || '🔧'
}

/** 获取工具调用的人类可读摘要 */
export function summarizeToolCall(toolCall: ToolCall): string {
  switch (toolCall.name) {
    case 'read':
      return `读取: ${toolCall.args.path as string}`
    case 'write': {
      const p = toolCall.args.path as string
      const c = toolCall.args.content as string
      return `写入: ${p} (${c?.length || 0} 字符)`
    }
    case 'execute': {
      const cmd = toolCall.args.command as string
      return `执行: ${cmd.length > 60 ? cmd.slice(0, 60) + '...' : cmd}`
    }
    case 'glob':
      return `搜索文件: ${toolCall.args.pattern as string}`
    case 'grep':
      return `搜索内容: "${toolCall.args.pattern as string}"`
    case 'web_search':
      return `搜索网页: ${toolCall.args.query as string}`
    case 'web_fetch':
      return `抓取: ${toolCall.args.url as string}`
    default:
      return `${toolCall.name}: ${JSON.stringify(toolCall.args).slice(0, 50)}`
  }
}
