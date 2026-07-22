/**
 * SettingsScreen — 使用 useConfig Hook + ProviderConfig 组件
 */

import React from 'react'
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Switch,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNav } from '../components/NavContext'
import { TermuxSetup } from '../components/TermuxSetup'
import { ProviderConfig } from '../components/ProviderConfig'
import { useConfig } from '../hooks/useConfig'

export function SettingsScreen({ navigation }: { navigation?: any }) {
  const insets = useSafeAreaInsets()
  const nav = useNav()
  const drawerNav = navigation || nav

  const {
    config, providers,
    addProvider, removeProvider,
    toggleThinking, saveConfig,
  } = useConfig()

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => drawerNav.openDrawer()} style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>设置</Text>
        <View style={styles.menuButton} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* ── Termux ── */}
        <Text style={styles.sectionTitle}>Termux 执行引擎</Text>
        <TermuxSetup />

        {/* ── Provider ── */}
        <Text style={styles.sectionTitle}>AI Provider</Text>
        <ProviderConfig
          providers={providers}
          onAdd={addProvider}
          onRemove={removeProvider}
        />

        {/* ── 对话设置 ── */}
        <Text style={styles.sectionTitle}>对话设置</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>深度思考</Text>
            <Switch
              value={config.thinkingEnabled}
              onValueChange={toggleThinking}
              trackColor={{ false: '#333', true: '#7c3aed60' }}
              thumbColor={config.thinkingEnabled ? '#7c3aed' : '#666'}
            />
          </View>
          <View style={[styles.settingRow, { marginTop: 16 }]}>
            <Text style={styles.settingLabel}>默认模型</Text>
            <TextInput
              style={styles.modelInput}
              value={config.model}
              onChangeText={t => saveConfig({ model: t })}
              placeholder="deepseek-v4-pro"
              placeholderTextColor="#555"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1f1f1f',
  },
  menuButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  menuIcon: { fontSize: 22, color: '#ffffff' },
  topTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: {
    color: '#888', fontSize: 13, fontWeight: '600', marginTop: 20, marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  card: {
    backgroundColor: '#111', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#1f1f1f',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  settingLabel: { color: '#e0e0e0', fontSize: 15 },
  modelInput: {
    backgroundColor: '#1a1a1a', borderRadius: 8, padding: 8, paddingHorizontal: 12,
    color: '#fff', fontSize: 13, fontFamily: 'monospace', width: 180,
    textAlign: 'right', borderWidth: 1, borderColor: '#2a2a2a',
  },
})
