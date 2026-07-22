/**
 * StreamingIndicator — 流式响应状态指示器
 *
 * 显示 AI 正在生成时的状态：加载动画、推理过程预览、Token 计数、工具调用结果。
 */

import React from 'react'
import {
  View, Text, StyleSheet, ActivityIndicator,
} from 'react-native'

interface StreamingIndicatorProps {
  statusText: string
  tokenCount: number
  accumulatedReasoning?: string
  accumulatedContent?: string
  toolCallResults?: Array<{ toolName: string; output: string; error?: string }>
}

export function StreamingIndicator({
  statusText, tokenCount, accumulatedReasoning,
  accumulatedContent, toolCallResults,
}: StreamingIndicatorProps) {
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <ActivityIndicator size="small" color="#7c3aed" />
        <Text style={styles.label}>{statusText || '思考中...'}</Text>
        {tokenCount > 0 && (
          <Text style={styles.tokenCount}>{Math.round(tokenCount / 4)} tokens</Text>
        )}
      </View>

      {accumulatedReasoning ? (
        <View style={styles.reasoningPreview}>
          <Text style={styles.reasoningPreviewLabel}>推理:</Text>
          <Text style={styles.reasoningPreviewText} numberOfLines={2}>
            {accumulatedReasoning}
          </Text>
        </View>
      ) : null}

      {accumulatedContent ? (
        <Text style={styles.preview} numberOfLines={2}>
          {accumulatedContent}
        </Text>
      ) : null}

      {toolCallResults && toolCallResults.length > 0 && (
        <View style={styles.toolResultsBox}>
          {toolCallResults.map((tr, i) => (
            <View key={i} style={styles.toolResultItem}>
              <Text style={styles.toolResultName}>
                {tr.error ? '❌' : '✅'} {tr.toolName}
              </Text>
              {tr.error ? (
                <Text style={styles.toolResultError}>{tr.error}</Text>
              ) : (
                <Text style={styles.toolResultOutput} numberOfLines={2}>{tr.output}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#111', padding: 12, marginHorizontal: 16,
    borderRadius: 12, marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#7c3aed', fontSize: 13, fontWeight: '600', flex: 1 },
  tokenCount: { color: '#555', fontSize: 11 },
  reasoningPreview: {
    marginTop: 6, backgroundColor: '#1a1a1a', borderRadius: 8, padding: 8,
  },
  reasoningPreviewLabel: { color: '#f59e0b', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  reasoningPreviewText: { color: '#777', fontSize: 12 },
  preview: { color: '#7c3aed', fontSize: 13, marginTop: 4, opacity: 0.7 },
  toolResultsBox: { marginTop: 8, gap: 4 },
  toolResultItem: { backgroundColor: '#1a1a1a', borderRadius: 8, padding: 8 },
  toolResultName: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  toolResultError: { color: '#ef4444', fontSize: 11, marginTop: 2 },
  toolResultOutput: {
    color: '#888', fontSize: 11, fontFamily: 'monospace', marginTop: 2,
  },
})
