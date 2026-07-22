import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  FlatList, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TermuxClient } from '../services/termux-client'
import { getTermuxToken, getTermuxHost } from '../services/config-store'
import { useNav } from '../components/NavContext'

interface FileItem {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: string
}

export function ToolsScreen({ navigation }: { navigation?: any }) {
  const insets = useSafeAreaInsets()
  const nav = useNav()
  const drawerNav = navigation || nav
  const [currentPath, setCurrentPath] = useState('~')
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [connectionReady, setConnectionReady] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [newFileName, setNewFileName] = useState('')

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    const token = await getTermuxToken()
    if (!token) return
    const host = await getTermuxHost()
    const client = new TermuxClient(token)
    if (host !== '127.0.0.1') client.baseUrl = `http://${host}:2324`
    const ok = await client.ping()
    setConnectionReady(ok)
    if (ok) loadDir('~')
  }

  const loadDir = async (path: string) => {
    setLoading(true)
    try {
      const token = await getTermuxToken()
      if (!token) return
      const host = await getTermuxHost()
      const client = new TermuxClient(token)
      if (host !== '127.0.0.1') client.baseUrl = `http://${host}:2324`
      const items = await client.listDir(path)
      setFiles(items)
      setCurrentPath(path)
    } catch (err) {
      Alert.alert('加载失败', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const readFile = async (path: string) => {
    setLoading(true)
    try {
      const token = await getTermuxToken()
      if (!token) return
      const host = await getTermuxHost()
      const client = new TermuxClient(token)
      if (host !== '127.0.0.1') client.baseUrl = `http://${host}:2324`
      const content = await client.readFile(path)
      setFileContent(content)
      setOriginalContent(content)
      setSelectedFile(path)
    } catch (err) {
      Alert.alert('读取失败', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const saveFile = async () => {
    if (!selectedFile) return
    try {
      const token = await getTermuxToken()
      if (!token) return
      const host = await getTermuxHost()
      const client = new TermuxClient(token)
      if (host !== '127.0.0.1') client.baseUrl = `http://${host}:2324`
      await client.writeFile(selectedFile, fileContent)
      setOriginalContent(fileContent)
      Alert.alert('已保存', '文件保存成功')
    } catch (err) {
      Alert.alert('保存失败', (err as Error).message)
    }
  }

  const createFile = async () => {
    const name = newFileName.trim()
    if (!name) return
    const newPath = currentPath === '~'
      ? `~/${name}`
      : `${currentPath}/${name}`
    try {
      const token = await getTermuxToken()
      if (!token) return
      const host = await getTermuxHost()
      const client = new TermuxClient(token)
      if (host !== '127.0.0.1') client.baseUrl = `http://${host}:2324`
      await client.writeFile(newPath, '')
      setCreating(false)
      setNewFileName('')
      loadDir(currentPath)
      readFile(newPath)
    } catch (err) {
      Alert.alert('创建失败', (err as Error).message)
    }
  }

  const handleItemPress = (item: FileItem) => {
    if (item.isDirectory) {
      loadDir(item.path)
    } else {
      readFile(item.path)
    }
  }

  const goToParent = () => {
    const parent = currentPath === '~' ? '~' : currentPath.split('/').slice(0, -1).join('/')
    loadDir(parent || '~')
  }

  if (!connectionReady) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => drawerNav.openDrawer()} style={styles.menuButton}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>文件</Text>
          <View style={styles.menuButton} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📁</Text>
          <Text style={styles.emptyTitle}>需要 Termux</Text>
          <Text style={styles.emptyText}>
            在设置页面连接 Termux 后，才能浏览文件系统
          </Text>
        </View>
      </View>
    )
  }

  if (selectedFile) {
    const hasChanges = fileContent !== originalContent
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => { setSelectedFile(null); setFileContent(''); setOriginalContent('') }} style={styles.menuButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>{selectedFile.split('/').pop()}</Text>
          {hasChanges ? (
            <TouchableOpacity style={styles.saveBtn} onPress={saveFile}>
              <Text style={styles.saveBtnText}>保存</Text>
            </TouchableOpacity>
          ) : <View style={styles.menuButton} />}
        </View>
        {hasChanges && (
          <View style={styles.dirtyBar}>
            <Text style={styles.dirtyText}>已修改</Text>
          </View>
        )}
        <TextInput
          style={styles.editor}
          value={fileContent}
          onChangeText={setFileContent}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => drawerNav.openDrawer()} style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToParent} style={{ flex: 1 }}>
          <Text style={styles.topTitle} numberOfLines={1}>{currentPath}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCreating(true)} style={styles.menuButton}>
          <Text style={styles.addIcon}>+</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={item => item.path}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.fileItem} onPress={() => handleItemPress(item)}>
              <Text style={styles.fileIcon}>{item.isDirectory ? '📁' : getFileIcon(item.name)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName}>{item.name}</Text>
                <Text style={styles.fileInfo}>
                  {item.isDirectory ? '目录' : formatSize(item.size)}
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>空目录</Text>
            </View>
          }
        />
      )}

      {/* 创建文件弹窗 */}
      {creating && (
        <View style={styles.createOverlay}>
          <View style={styles.createDialog}>
            <Text style={styles.createTitle}>新建文件</Text>
            <TextInput
              style={styles.createInput}
              value={newFileName}
              onChangeText={setNewFileName}
              placeholder="文件名 (如 hello.ts)"
              placeholderTextColor="#555"
              autoFocus
            />
            <View style={styles.createButtons}>
              <TouchableOpacity style={styles.createCancelBtn} onPress={() => { setCreating(false); setNewFileName('') }}>
                <Text style={styles.createCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createConfirmBtn} onPress={createFile}>
                <Text style={styles.createConfirmText}>创建</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts': case 'tsx': return '🔵'
    case 'js': case 'jsx': return '🟡'
    case 'json': return '📋'
    case 'md': return '📝'
    case 'py': return '🐍'
    case 'html': return '🌐'
    case 'css': case 'scss': return '🎨'
    case 'sh': case 'bash': return '⚡'
    case 'yaml': case 'yml': return '⚙️'
    case 'toml': return '🔧'
    case 'gitignore': return '🙈'
    default: return '📄'
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  addIcon: { fontSize: 24, color: '#7c3aed', fontWeight: '700' },
  topTitle: { fontSize: 15, fontWeight: '600', color: '#ffffff', flex: 1, textAlign: 'center' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#ffffff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  fileItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  fileIcon: { fontSize: 20, marginRight: 12 },
  fileName: { color: '#e0e0e0', fontSize: 15, fontWeight: '500' },
  fileInfo: { color: '#666', fontSize: 12, marginTop: 2 },
  arrow: { color: '#555', fontSize: 22 },

  // Editor
  saveBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#7c3aed20', borderRadius: 8 },
  saveBtnText: { color: '#7c3aed', fontSize: 14, fontWeight: '600' },
  dirtyBar: { backgroundColor: '#7c3aed20', padding: 6, alignItems: 'center' },
  dirtyText: { color: '#7c3aed', fontSize: 11, fontWeight: '600' },
  editor: {
    flex: 1, backgroundColor: '#0a0a0a', color: '#d0d0d0', fontSize: 13,
    fontFamily: 'monospace', padding: 16, lineHeight: 20,
  },

  // 创建文件
  createOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#00000080', justifyContent: 'center', alignItems: 'center', zIndex: 100,
  },
  createDialog: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, width: '80%', borderWidth: 1, borderColor: '#2a2a2a' },
  createTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 16 },
  createInput: { backgroundColor: '#111', borderRadius: 10, padding: 12, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#333' },
  createButtons: { flexDirection: 'row', gap: 8, marginTop: 16 },
  createCancelBtn: { flex: 1, padding: 12, backgroundColor: '#222', borderRadius: 10, alignItems: 'center' },
  createCancelText: { color: '#888', fontSize: 14 },
  createConfirmBtn: { flex: 1, padding: 12, backgroundColor: '#7c3aed', borderRadius: 10, alignItems: 'center' },
  createConfirmText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})
