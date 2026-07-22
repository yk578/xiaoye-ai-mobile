/**
 * ChatScreen — 使用 useChat Hook 重构版
 */

import React, { useRef, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { VideoBackground } from '../components/VideoBackground'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { InputBar } from '../components/InputBar'
import { StreamingIndicator } from '../components/StreamingIndicator'
import { useChat } from '../hooks/useChat'
import { useNav } from '../components/NavContext'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoningContent?: string
  timestamp: Date
}

export function ChatScreen({ navigation }: { navigation?: any }) {
  const insets = useSafeAreaInsets()
  const nav = useNav()
  const drawerNav = navigation || nav
  const flatListRef = useRef<FlatList>(null)

  const {
    messages, input, setInput, streamState,
    convId, convList, showConvList, setShowConvList,
    handleSend, handleCancel,
    switchConversation, newConversation, deleteConv,
  } = useChat()

  // 自动滚动
  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50)
  }, [messages, streamState.accumulatedContent])

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageBubble,
      item.role === 'user' ? styles.userBubble : styles.assistantBubble,
    ]}>
      {item.role === 'assistant' && item.reasoningContent ? (
        <View style={styles.reasoningBox}>
          <Text style={styles.reasoningLabel}>推理过程</Text>
          <Text style={styles.reasoningText}>{item.reasoningContent}</Text>
        </View>
      ) : null}
      {item.role === 'assistant' ? (
        <MarkdownRenderer content={item.content} />
      ) : (
        <Text style={styles.userText}>{item.content}</Text>
      )}
      {item.role === 'assistant' && item.id !== 'welcome' && (
        <Text style={styles.timestamp}>
          {item.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
    </View>
  )

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ErrorBoundary fallback={<View style={styles.errorFallback} />}>
        <VideoBackground />
      </ErrorBoundary>

      {/* 顶部栏 */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => drawerNav.openDrawer()} style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.convTitleBtn} onPress={() => setShowConvList(true)}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {convList.find(c => c.id === convId)?.title || '新对话'}
          </Text>
          <Text style={styles.convArrow}>▼</Text>
        </TouchableOpacity>
        <View style={styles.menuButton} />
      </View>

      {/* 对话切换列表 */}
      {showConvList && (
        <View style={styles.convOverlay}>
          <TouchableOpacity style={styles.convOverlayBg} onPress={() => setShowConvList(false)} />
          <View style={[styles.convPanel, { paddingTop: insets.top + 60 }]}>
            <TouchableOpacity style={styles.newConvBtn} onPress={newConversation}>
              <Text style={styles.newConvText}>+ 新对话</Text>
            </TouchableOpacity>
            <FlatList
              data={convList}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.convItem, item.id === convId && styles.convItemActive]}
                  onPress={() => switchConversation(item.id)}
                >
                  <Text style={[styles.convItemTitle, item.id === convId && styles.convItemTitleActive]}
                    numberOfLines={1}>
                    {item.title}
                  </Text>
                  <TouchableOpacity onPress={() => deleteConv(item.id)} style={styles.convDelete}>
                    <Text style={styles.convDeleteText}>×</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      )}

      {/* 消息列表 */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* 流式内容 */}
      {streamState.isStreaming && (
        <StreamingIndicator
          statusText={streamState.statusText}
          tokenCount={streamState.tokenCount}
          accumulatedReasoning={streamState.accumulatedReasoning}
          accumulatedContent={streamState.accumulatedContent}
          toolCallResults={streamState.toolCallResults}
        />
      )}

      {/* 错误 */}
      {streamState.error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{streamState.error.message}</Text>
          {streamState.error.retryable && (
            <TouchableOpacity onPress={handleSend} style={styles.retryButton}>
              <Text style={styles.retryText}>重试</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 输入区 */}
      <InputBar
        value={input}
        onChangeText={setInput}
        onSend={handleSend}
        onCancel={handleCancel}
        isStreaming={streamState.isStreaming}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  errorFallback: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#060608',
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1f1f1f',
  },
  menuButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  menuIcon: { fontSize: 22, color: '#ffffff' },
  convTitleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    flex: 1, justifyContent: 'center',
  },
  topTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff', textAlign: 'center' },
  convArrow: { color: '#888', fontSize: 10, marginTop: 2 },
  convOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
  convOverlayBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#00000080',
  },
  convPanel: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#111', width: '85%', alignSelf: 'center',
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
  },
  newConvBtn: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  newConvText: { color: '#7c3aed', fontSize: 15, fontWeight: '600' },
  convItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  convItemActive: { backgroundColor: '#7c3aed10' },
  convItemTitle: { color: '#aaa', fontSize: 14, flex: 1 },
  convItemTitleActive: { color: '#7c3aed', fontWeight: '600' },
  convDelete: { padding: 8 },
  convDeleteText: { color: '#ef4444', fontSize: 18 },
  messageList: { flex: 1 },
  messageListContent: { padding: 16, paddingBottom: 8 },
  messageBubble: { marginBottom: 16, maxWidth: '92%' },
  userBubble: {
    alignSelf: 'flex-end', backgroundColor: '#1a1a2e',
    borderRadius: 16, padding: 12,
  },
  assistantBubble: { alignSelf: 'flex-start' },
  userText: { color: '#e0e0e0', fontSize: 15, lineHeight: 22 },
  timestamp: { color: '#555', fontSize: 10, marginTop: 6, textAlign: 'right' },
  reasoningBox: {
    backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 12, marginBottom: 8,
  },
  reasoningLabel: { color: '#f59e0b', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  reasoningText: { color: '#888', fontSize: 13, lineHeight: 18 },
  errorBox: {
    backgroundColor: '#2a1010', padding: 12, marginHorizontal: 16,
    borderRadius: 12, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  errorText: { color: '#ef4444', fontSize: 13, flex: 1 },
  retryButton: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#ef444420', borderRadius: 8,
  },
  retryText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
})
