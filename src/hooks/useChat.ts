/**
 * useChat — 聊天状态管理 Hook
 *
 * 从 ChatScreen 中提取所有聊天相关状态和逻辑，
 * 让 ChatScreen 变成纯展示组件。
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { sendMessage, cancelMessage, setCallbacks } from '../services/chat-service'
import { ALL_TOOL_SCHEMAS } from '../services/tool-schemas'
import {
  createConversation, addMessage,
  listConversations, deleteConversation, autoTitle,
} from '../services/conversation-store'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoningContent?: string
  timestamp: Date
}

interface StreamState {
  isStreaming: boolean
  accumulatedContent: string
  accumulatedReasoning: string
  tokenCount: number
  error: { code: string; message: string; retryable: boolean } | null
  statusText: string
  toolCallResults: Array<{ toolName: string; output: string; error?: string }>
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streamState, setStreamState] = useState<StreamState>({
    isStreaming: false,
    accumulatedContent: '',
    accumulatedReasoning: '',
    tokenCount: 0,
    error: null,
    statusText: '',
    toolCallResults: [],
  })
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [convId, setConvId] = useState<string>('')
  const [convList, setConvList] = useState<Array<{ id: string; title: string }>>([])
  const [showConvList, setShowConvList] = useState(false)

  const accumulatedRef = useRef('')
  const reasoningRef = useRef('')
  const toolCallResultsRef = useRef<Array<{ toolName: string; output: string; error?: string }>>([])

  const loadConvList = useCallback(async () => {
    const list = await listConversations()
    setConvList(list.map(c => ({ id: c.id, title: c.title })))
  }, [])

  const newConversation = useCallback(() => {
    const id = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    setConvId(id)
    createConversation(id)
    setMessages([getWelcomeMessage()])
    setShowConvList(false)
  }, [])

  const switchConversation = useCallback(async (id: string) => {
    if (id === convId) return
    setConvId(id)
    const { getMessages } = await import('../services/conversation-store')
    const msgs = await getMessages(id)
    setMessages(msgs.length > 0
      ? msgs.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
      : [getWelcomeMessage()]
    )
    setShowConvList(false)
  }, [convId])

  const deleteConv = useCallback(async (id: string) => {
    await deleteConversation(id)
    await loadConvList()
    if (id === convId) newConversation()
  }, [convId, loadConvList, newConversation])

  // 初始化
  useEffect(() => {
    loadConvList()
    newConversation()
  }, [])

  // 注册回调
  useEffect(() => {
    setCallbacks({
      onToken: (_sessionId, token, reasoningToken) => {
        if (token) accumulatedRef.current += token
        if (reasoningToken) reasoningRef.current += reasoningToken
        setStreamState(prev => ({
          ...prev,
          accumulatedContent: accumulatedRef.current,
          accumulatedReasoning: reasoningRef.current,
          statusText: accumulatedRef.current ? '思考中...' : '等待响应...',
          tokenCount: prev.tokenCount + ((token?.length || 0) + (reasoningToken?.length || 0)),
        }))
      },
      onStatus: (_sessionId, status, toolTurn) => {
        let statusText = ''
        switch (status) {
          case 'streaming': statusText = toolTurn ? `工具调用第 ${toolTurn} 轮...` : '思考中...'; break
          case 'executing_tools': statusText = '执行工具调用...'; break
          case 'retrying': statusText = `重试中 (${toolTurn}/3)...`; break
          default: statusText = status
        }
        setStreamState(prev => ({ ...prev, statusText }))
      },
      onToolResult: (_sessionId, results) => {
        toolCallResultsRef.current = [...toolCallResultsRef.current, ...results]
        setStreamState(prev => ({
          ...prev,
          toolCallResults: [...toolCallResultsRef.current],
        }))
      },
      onDone: (_sessionId, result) => {
        const content = accumulatedRef.current
        const reasoning = reasoningRef.current

        accumulatedRef.current = ''
        reasoningRef.current = ''
        toolCallResultsRef.current = []

        if (content) {
          const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
          addMessage({
            id: msgId,
            conversationId: convId,
            role: 'assistant',
            content,
            reasoningContent: reasoning || undefined,
          })

          setMessages(prev => [...prev, {
            id: msgId,
            role: 'assistant',
            content,
            reasoningContent: reasoning || undefined,
            timestamp: new Date(),
          }])

          autoTitle(convId).then(() => loadConvList())
        }

        setStreamState({
          isStreaming: false,
          accumulatedContent: '',
          accumulatedReasoning: '',
          tokenCount: 0,
          error: null,
          statusText: '',
          toolCallResults: [],
        })
        setCurrentSessionId(null)
      },
      onError: (_sessionId, code, message, retryable) => {
        accumulatedRef.current = ''
        reasoningRef.current = ''
        setStreamState(prev => ({
          ...prev,
          isStreaming: false,
          error: { code, message, retryable },
          statusText: '',
        }))
      },
    })
  }, [convId, loadConvList])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streamState.isStreaming) return
    setInput('')

    const userMsgId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    addMessage({
      id: userMsgId,
      conversationId: convId,
      role: 'user',
      content: text,
    })

    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])

    setStreamState({
      isStreaming: true,
      accumulatedContent: '',
      accumulatedReasoning: '',
      tokenCount: 0,
      error: null,
      statusText: '连接中...',
      toolCallResults: [],
    })

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }))
      const result = await sendMessage(
        [...history, { role: 'user', content: text }],
        {
          conversationId: convId,
          toolSchemas: ALL_TOOL_SCHEMAS as any,
        }
      )
      setCurrentSessionId(result.sessionId)
    } catch (err) {
      setStreamState(prev => ({
        ...prev,
        isStreaming: false,
        error: { code: 'ERROR', message: (err as Error).message, retryable: false },
      }))
    }
  }, [input, streamState.isStreaming, messages, convId])

  const handleCancel = useCallback(() => {
    if (currentSessionId) {
      cancelMessage(currentSessionId)
      setCurrentSessionId(null)
    }
    accumulatedRef.current = ''
    reasoningRef.current = ''
    setStreamState({
      isStreaming: false,
      accumulatedContent: '',
      accumulatedReasoning: '',
      tokenCount: 0,
      error: null,
      statusText: '',
      toolCallResults: [],
    })
  }, [currentSessionId])

  return {
    messages, input, setInput, streamState,
    convId, convList, showConvList, setShowConvList,
    handleSend, handleCancel,
    switchConversation, newConversation, deleteConv,
  }
}

function getWelcomeMessage(): Message {
  return {
    id: 'welcome',
    role: 'assistant',
    content: '# 你好！我是小叶AI\n\n我是你的移动开发助手。连接 Termux 后，我可以帮你：\n\n- **读写文件** — 编辑、查看项目代码\n- **搜索代码** — Grep、Glob 搜索\n- **执行命令** — 编译、运行、安装依赖\n- **AI 对话** — 编码问题、代码审查、架构设计\n\n请在 **设置** 中配置 API Key 并连接 Termux。',
    timestamp: new Date(),
  }
}
