/**
 * 工具模式定义 — 告诉 LLM 手机端可以执行哪些操作
 *
 * 这些 schema 会在聊天时作为 tools 参数传给 Provider，
 * LLM 识别到需要操作时会返回 tool_calls，然后 chat-service 执行。
 */

import type { ToolLLMSchema } from '../types'

/** 读取文件 */
export const READ_FILE_SCHEMA: ToolLLMSchema = {
  type: 'function',
  function: {
    name: 'read',
    description: '读取指定路径的文件内容。支持相对路径和绝对路径。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径，例如 ~/project/index.ts 或 /data/data/.../project/index.ts',
        },
      },
      required: ['path'],
    },
  },
}

/** 写入/创建文件 */
export const WRITE_FILE_SCHEMA: ToolLLMSchema = {
  type: 'function',
  function: {
    name: 'write',
    description: '写入或创建文件。如果文件已存在则覆盖，目录不存在会自动创建。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径',
        },
        content: {
          type: 'string',
          description: '要写入的文件内容',
        },
      },
      required: ['path', 'content'],
    },
  },
}

/** 执行 Shell 命令 */
export const EXECUTE_SCHEMA: ToolLLMSchema = {
  type: 'function',
  function: {
    name: 'execute',
    description: '在 Termux 终端中执行 shell 命令。适用于：编译、运行、安装依赖、Git 操作等。',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '要执行的 shell 命令，例如 `ls -la`、`node --version`',
        },
        timeout: {
          type: 'number',
          description: '超时时间（毫秒），默认 30000',
        },
      },
      required: ['command'],
    },
  },
}

/** Glob 文件搜索 */
export const GLOB_SCHEMA: ToolLLMSchema = {
  type: 'function',
  function: {
    name: 'glob',
    description: '按通配符模式搜索文件。例如搜索 "**/*.ts" 匹配所有 TypeScript 文件。',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: '通配符模式，如 **/*.ts、*.json、src/**/*.tsx',
        },
      },
      required: ['pattern'],
    },
  },
}

/** Grep 内容搜索 */
export const GREP_SCHEMA: ToolLLMSchema = {
  type: 'function',
  function: {
    name: 'grep',
    description: '在文件中搜索文本内容。支持正则表达式。',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: '要搜索的文本或正则表达式',
        },
        path: {
          type: 'string',
          description: '搜索目录路径，默认为当前目录',
        },
      },
      required: ['pattern'],
    },
  },
}

/** Web 搜索 */
export const WEB_SEARCH_SCHEMA: ToolLLMSchema = {
  type: 'function',
  function: {
    name: 'web_search',
    description: '在互联网上搜索信息。用于查找最新文档、API 用法、错误解决方法等。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词，使用英文或中文',
        },
        numResults: {
          type: 'number',
          description: '返回结果数量，默认 5，最多 10',
        },
      },
      required: ['query'],
    },
  },
}

/** Web 抓取 */
export const WEB_FETCH_SCHEMA: ToolLLMSchema = {
  type: 'function',
  function: {
    name: 'web_fetch',
    description: '抓取并提取网页内容。用于读取文档、API 参考、博客文章等。',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要抓取的网页 URL，必须是完整的 http/https 地址',
        },
        maxChars: {
          type: 'number',
          description: '最大返回字符数，默认 8000',
        },
      },
      required: ['url'],
    },
  },
}

/** 全量工具列表 */
export const ALL_TOOL_SCHEMAS: ToolLLMSchema[] = [
  READ_FILE_SCHEMA,
  WRITE_FILE_SCHEMA,
  EXECUTE_SCHEMA,
  GLOB_SCHEMA,
  GREP_SCHEMA,
  WEB_SEARCH_SCHEMA,
  WEB_FETCH_SCHEMA,
]

/** 只读工具（不需要确认） */
export const READONLY_TOOLS = new Set(['read', 'glob', 'grep', 'web_search', 'web_fetch'])

/** 写入工具（需要确认） */
export const WRITE_TOOLS = new Set(['write', 'execute'])
