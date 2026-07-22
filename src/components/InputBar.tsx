/**
 * InputBar — 消息输入栏
 *
 * 支持多行输入、发送/取消按钮、模板快捷操作入口。
 */

import React from 'react'
import {
  View, TextInput, TouchableOpacity, Text, StyleSheet,
} from 'react-native'

interface InputBarProps {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  onCancel?: () => void
  onTemplate?: () => void
  isStreaming: boolean
  placeholder?: string
  maxLength?: number
}

export function InputBar({
  value, onChangeText, onSend, onCancel, onTemplate,
  isStreaming, placeholder = '输入你的需求...', maxLength = 4000,
}: InputBarProps) {
  const canSend = value.trim().length > 0 && !isStreaming

  return (
    <View style={styles.container}>
      {onTemplate && (
        <TouchableOpacity style={styles.templateBtn} onPress={onTemplate}>
          <Text style={styles.templateBtnText}>⚡ 模板</Text>
        </TouchableOpacity>
      )}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#666"
          multiline
          maxLength={maxLength}
        />
        {isStreaming && onCancel ? (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>■</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={onSend}
            disabled={!canSend}
          >
            <Text style={[styles.sendText, !canSend && styles.sendTextDisabled]}>→</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 8 },
  templateBtn: {
    alignSelf: 'flex-start', marginBottom: 6, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: '#7c3aed15', borderRadius: 12, borderWidth: 1, borderColor: '#7c3aed25',
  },
  templateBtnText: { color: '#a78bfa', fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 16, padding: 14,
    color: '#ffffff', fontSize: 15, maxHeight: 120, borderWidth: 1, borderColor: '#2a2a2a',
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#7c3aed',
    justifyContent: 'center', alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#2a2a2a' },
  sendText: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  sendTextDisabled: { color: '#555' },
  cancelButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#ef444430',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ef444440',
  },
  cancelText: { color: '#ef4444', fontSize: 18 },
})
