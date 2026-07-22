import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav } from '../components/NavContext'
import { listConversations, deleteConversation, getMessages, getConversation } from '../services/conversation-store'

interface ConversationSummary {
  id: string
  title: string
  messageCount: number
  model: string
  lastActive: string
}

export function MemoryScreen({ navigation }: { navigation?: any }) {
  const insets = useSafeAreaInsets()
  const nav = useNav()
  const drawerNav = navigation || nav
  const [convs, setConvs] = useState<ConversationSummary[]>([])
  const [showDetail, setShowDetail] = useState<string | null>(null)
  const [detailMessages, setDetailMessages] = useState<number>(0)

  useEffect(() => {
    loadConvs()
  }, [])

  const loadConvs = async () => {
    const list = await listConversations()
    setConvs(list.map(c => ({
      id: c.id,
      title: c.title,
      messageCount: c.messageCount,
      model: c.model || '',
      lastActive: formatTime(c.updatedAt),
    })))
  }

  const viewDetail = async (id: string) => {
    setShowDetail(id)
    const msgs = await getMessages(id)
    setDetailMessages(msgs.length)
  }

  const handleDelete = async (id: string) => {
    await deleteConversation(id)
    loadConvs()
    if (showDetail === id) setShowDetail(null)
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => drawerNav.openDrawer()} style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>{showDetail ? '对话详情' : '记忆'}</Text>
        {showDetail && (
          <TouchableOpacity onPress={() => setShowDetail(null)} style={styles.menuButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        )}
        {!showDetail && <View style={styles.menuButton} />}
      </View>

      {showDetail ? (
        <View style={styles.detailContainer}>
          <Text style={styles.detailTitle}>{convs.find(c => c.id === showDetail)?.title || '对话'}</Text>
          <Text style={styles.detailStats}>消息数: {detailMessages}</Text>
          <TouchableOpacity style={styles.detailDeleteBtn} onPress={() => handleDelete(showDetail)}>
            <Text style={styles.detailDeleteText}>删除此对话</Text>
          </TouchableOpacity>
        </View>
      ) : convs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🧠</Text>
          <Text style={styles.emptyTitle}>暂无对话记录</Text>
          <Text style={styles.emptyText}>
            开始对话后，历史记录会保存在这里供回顾
          </Text>
        </View>
      ) : (
        <FlatList
          data={convs}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.convItem} onPress={() => viewDetail(item.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.convTitle} numberOfLines={1}>{item.title}</Text>
                <View style={styles.convMeta}>
                  <Text style={styles.convMetaText}>{item.messageCount} 条消息</Text>
                  <Text style={styles.convMetaDot}>·</Text>
                  <Text style={styles.convMetaText}>{item.lastActive}</Text>
                </View>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f1f1f',
  },
  menuButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  menuIcon: { fontSize: 22, color: '#ffffff' },
  backIcon: { fontSize: 24, color: '#ffffff' },
  topTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#ffffff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  convItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  convTitle: { color: '#e0e0e0', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  convMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  convMetaText: { color: '#666', fontSize: 12 },
  convMetaDot: { color: '#444', fontSize: 12 },
  arrow: { color: '#555', fontSize: 22 },

  detailContainer: { flex: 1, padding: 20 },
  detailTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  detailStats: { color: '#888', fontSize: 14, marginBottom: 24 },
  detailDeleteBtn: { padding: 14, backgroundColor: '#2a1010', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ef444430' },
  detailDeleteText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
})
