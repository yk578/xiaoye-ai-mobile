import React from 'react'
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native'

interface MarkdownRendererProps {
  content: string
}

/**
 * 简单 Markdown 渲染器
 * 支持: 标题、粗体、代码块、行内代码、列表、分割线
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null

  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let inCodeBlock = false
  let codeBlockLines: string[] = []
  let codeBlockLang = ''
  let listCounter = 0

  const flushCodeBlock = () => {
    if (codeBlockLines.length > 0) {
      elements.push(
        <View key={`code-${elements.length}`} style={styles.codeBlock}>
          {codeBlockLang ? (
            <Text style={styles.codeLang}>{codeBlockLang}</Text>
          ) : null}
          <ScrollView horizontal>
            <Text style={styles.codeText}>{codeBlockLines.join('\n')}</Text>
          </ScrollView>
        </View>
      )
      codeBlockLines = []
      codeBlockLang = ''
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 代码块开关
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock()
        inCodeBlock = false
      } else {
        flushCodeBlock()
        inCodeBlock = true
        codeBlockLang = line.trim().slice(3).trim()
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(line)
      continue
    }

    // 空行
    if (!line.trim()) {
      elements.push(<View key={`spacer-${i}`} style={styles.spacer} />)
      continue
    }

    const trimmed = line.trim()

    // 标题
    if (trimmed.startsWith('### ')) {
      elements.push(
        <Text key={`h3-${i}`} style={styles.h3}>
          {renderInline(trimmed.slice(4))}
        </Text>
      )
      continue
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <Text key={`h2-${i}`} style={styles.h2}>
          {renderInline(trimmed.slice(3))}
        </Text>
      )
      continue
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <Text key={`h1-${i}`} style={styles.h1}>
          {renderInline(trimmed.slice(2))}
        </Text>
      )
      continue
    }

    // 分割线
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      elements.push(<View key={`hr-${i}`} style={styles.hr} />)
      continue
    }

    // 无序列表
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listCounter = 0
      elements.push(
        <View key={`li-${i}`} style={styles.listItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>{renderInline(trimmed.slice(2))}</Text>
        </View>
      )
      continue
    }

    // 有序列表
    if (/^\d+\.\s/.test(trimmed)) {
      listCounter++
      const content = trimmed.replace(/^\d+\.\s/, '')
      elements.push(
        <View key={`ol-${i}`} style={styles.listItem}>
          <Text style={styles.bullet}>{listCounter}.</Text>
          <Text style={styles.listText}>{renderInline(content)}</Text>
        </View>
      )
      continue
    }

    // 普通段落
    elements.push(
      <Text key={`p-${i}`} style={styles.paragraph}>
        {renderInline(trimmed)}
      </Text>
    )
  }

  flushCodeBlock()

  return <View style={styles.container}>{elements}</View>
}

/** 渲染行内元素：粗体、行内代码 */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  // 匹配 **粗体** 和 `行内代码`
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // 普通文本
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[2]) {
      // 粗体
      parts.push(<Text key={`b-${match.index}`} style={styles.bold}>{match[2]}</Text>)
    } else if (match[3]) {
      // 行内代码
      parts.push(
        <Text key={`c-${match.index}`} style={styles.inlineCode}>{match[3]}</Text>
      )
    }

    lastIndex = match.index + match[0].length
  }

  // 剩余文本
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

const styles = StyleSheet.create({
  container: {},
  // 标题
  h1: { color: '#ffffff', fontSize: 22, fontWeight: '700', marginBottom: 12, marginTop: 4 },
  h2: { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 10, marginTop: 4 },
  h3: { color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  // 段落
  paragraph: { color: '#d0d0d0', fontSize: 15, lineHeight: 24, marginBottom: 8 },
  // 粗体
  bold: { fontWeight: '700', color: '#ffffff' },
  // 行内代码
  inlineCode: {
    backgroundColor: '#1a1a2e', color: '#a78bfa', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4,
  },
  // 代码块
  codeBlock: {
    backgroundColor: '#111', borderRadius: 12, padding: 12, marginVertical: 8,
    borderWidth: 1, borderColor: '#1f1f1f',
  },
  codeLang: { color: '#888', fontSize: 11, marginBottom: 8, fontFamily: 'monospace' },
  codeText: {
    color: '#a78bfa', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
  },
  // 列表
  listItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, paddingLeft: 4 },
  bullet: { color: '#7c3aed', fontSize: 15, width: 20, lineHeight: 24 },
  listText: { color: '#d0d0d0', fontSize: 15, lineHeight: 24, flex: 1 },
  // 分割线
  hr: { height: 1, backgroundColor: '#1f1f1f', marginVertical: 12 },
  spacer: { height: 8 },
})

// export used inline above
