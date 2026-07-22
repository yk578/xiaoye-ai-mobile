/**
 * MemorySystem — 手机端长期记忆类型定义
 *
 * 分层记忆系统：
 * - working: 当前对话上下文（会话结束自动总结→longterm）
 * - longterm: 跨会话持久记忆（用户信息/偏好/重要事实）
 * - config: AI 自我配置记录
 */

export type MemoryType = 'working' | 'longterm' | 'config'

export type MemoryCategory =
  | 'user_info'      // 用户基本信息（名字、职业、习惯）
  | 'preference'     // 用户偏好（语气、温度、常用模型）
  | 'fact'           // 重要事实（项目状态、时间安排）
  | 'skill'          // AI 学会的能力
  | 'config_change'  // 自我配置修改记录
  | 'conversation'   // 对话总结
  | 'error_fix'      // 踩坑记录（避免重复犯错）
  | 'behavior'       // 用户行为模式（早起秒回 vs 深夜才看）

export interface MemoryEntry {
  id: string
  type: MemoryType
  category: MemoryCategory
  content: string
  keywords: string[]         // 用于检索的关键词
  importance: number         // 1-10，越高越优先加载
  createdAt: number
  updatedAt: number
  accessCount: number
}

export interface ConversationSummary {
  id: string
  date: string
  topics: string[]
  summary: string
  decisions: string[]        // 对话中做出的决定
  userPreferences: string[]  // 新发现的偏好
  pendingTasks: string[]     // 待办/承诺
}

export interface ConfigOverrides {
  model?: string
  temperature?: number
  maxTokens?: number
  thinkingEnabled?: boolean
  systemPromptAdditions?: string[]
  defaultProvider?: string
}
