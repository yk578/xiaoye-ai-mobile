/**
 * ProviderConfig — AI Provider 配置组件
 *
 * 管理多个 AI Provider（DeepSeek、OpenAI 等），支持增删。
 */

import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, Alert,
} from 'react-native'
import type { ProviderStoreEntry } from '../types'

interface ProviderConfigProps {
  providers: ProviderStoreEntry[]
  onAdd: (entry: ProviderStoreEntry) => void
  onRemove: (name: string) => void
}

export function ProviderConfig({ providers, onAdd, onRemove }: ProviderConfigProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ProviderStoreEntry>({
    name: '', baseUrl: '', apiKey: '', defaultModel: '',
  })

  const handleAdd = async () => {
    if (!form.name || !form.baseUrl || !form.apiKey) {
      Alert.alert('请填写完整信息', '名称、接口地址和 API 密钥都是必填的')
      return
    }
    await onAdd({
      ...form,
      defaultModel: form.defaultModel || 'deepseek-v4-pro',
    })
    setShowForm(false)
    setForm({ name: '', baseUrl: '', apiKey: '', defaultModel: '' })
  }

  return (
    <View>
      {providers.map(p => (
        <View key={p.name} style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.url} numberOfLines={1}>{p.baseUrl}</Text>
              <Text style={styles.model}>{p.defaultModel || '未设置模型'}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Alert.alert('确认删除', `确定删除 Provider "${p.name}" 吗？`, [
                  { text: '取消', style: 'cancel' },
                  { text: '删除', style: 'destructive', onPress: () => onRemove(p.name) },
                ])
              }}
            >
              <Text style={styles.deleteBtn}>删除</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {showForm ? (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="名称（如 deepseek）"
            placeholderTextColor="#555"
            value={form.name}
            onChangeText={t => setForm(p => ({ ...p, name: t }))}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="接口地址（如 https://api.deepseek.com）"
            placeholderTextColor="#555"
            value={form.baseUrl}
            onChangeText={t => setForm(p => ({ ...p, baseUrl: t }))}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TextInput
            style={styles.input}
            placeholder="API 密钥"
            placeholderTextColor="#555"
            secureTextEntry
            value={form.apiKey}
            onChangeText={t => setForm(p => ({ ...p, apiKey: t }))}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="默认模型（如 deepseek-v4-pro）"
            placeholderTextColor="#555"
            value={form.defaultModel}
            onChangeText={t => setForm(p => ({ ...p, defaultModel: t }))}
            autoCapitalize="none"
          />
          <View style={styles.formButtons}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
              <Text style={styles.saveBtnText}>保存</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Text style={styles.addBtnText}>+ 添加 Provider</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#1f1f1f',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { color: '#e0e0e0', fontSize: 15, fontWeight: '600' },
  url: { color: '#666', fontSize: 12, marginTop: 2 },
  model: { color: '#7c3aed', fontSize: 12, marginTop: 2, fontFamily: 'monospace' },
  deleteBtn: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  addBtn: {
    padding: 14, backgroundColor: '#111', borderRadius: 12,
    borderWidth: 1, borderColor: '#7c3aed30', borderStyle: 'dashed',
    alignItems: 'center',
  },
  addBtnText: { color: '#7c3aed', fontSize: 14, fontWeight: '600' },
  form: {
    backgroundColor: '#111', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#1f1f1f',
  },
  input: {
    backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12,
    color: '#fff', fontSize: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  formButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  saveBtn: {
    flex: 1, padding: 12, backgroundColor: '#7c3aed',
    borderRadius: 10, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelBtn: {
    flex: 1, padding: 12, backgroundColor: '#1a1a1a',
    borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#333',
  },
  cancelBtnText: { color: '#888', fontSize: 14 },
})
