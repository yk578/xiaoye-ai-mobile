/**
 * TermuxSetup — 一键配对 Termux 服务器
 *
 * v2：自动发现取代手动配置
 * 1. 点击「自动发现」扫描同 WiFi 下的服务器
 * 2. 找到后自动填入 IP 和 Token
 * 3. 连不上时手动输入作为备选
 */

import React, { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Linking,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { TermuxClient, discoverServers } from '../services/termux-client'
import { getTermuxToken, setTermuxToken, getTermuxHost, setTermuxHost } from '../services/config-store'

export function TermuxSetup() {
  const [connected, setConnected] = useState(false)
  const [checking, setChecking] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [phoneIp, setPhoneIp] = useState('')
  const [tokenInput, setTokenInput] = useState('')

  // 加载已有配置
  React.useEffect(() => {
    (async () => {
      const [ip, token] = await Promise.all([getTermuxHost(), getTermuxToken()])
      setPhoneIp(ip || '')
      setTokenInput(token || '')
      if (ip && token) {
        const client = new TermuxClient(token, `http://${ip}:2324`)
        setConnected(await client.ping())
      }
    })()
  }, [])

  /** 自动发现服务器 */
  const handleDiscover = useCallback(async () => {
    setDiscovering(true)
    setConnected(false)

    try {
      // 用空 token 先探测
      const servers = await discoverServers('', {
        onProgress: (ip) => setPhoneIp(ip),
      })

      if (servers.length === 0) {
        Alert.alert('未找到服务器', '请确认：\n1. 手机已安装 Termux\n2. 服务器已启动\n3. 手机和电脑/车机在同一 WiFi')
        return
      }

      const server = servers[0]
      setPhoneIp(server.ip)

      // 用服务器 IP 获取 info（获取实际 token）
      const client = new TermuxClient('', `http://${server.ip}:2324`)
      const info = await client.getServerInfo()
      if (info) {
        Alert.alert('发现服务器', `IP: ${server.ip}:2324\nToken: ${info.token ? '已获取' : '需手动输入 Token'}`)
      } else {
        Alert.alert('发现服务器', `IP: ${server.ip}:2324\n请手动输入 Token 后点击「测试连接」`)
      }
    } catch (err) {
      Alert.alert('自动发现失败', (err as Error).message)
    } finally {
      setDiscovering(false)
    }
  }, [])

  /** 测试连接 */
  const handleCheck = useCallback(async () => {
    if (!tokenInput.trim()) {
      Alert.alert('需要 Token', '请在下方输入从 Termux 获得的 Token')
      return
    }
    if (!phoneIp.trim()) {
      Alert.alert('需要 IP', '请输入手机 WiFi IP 地址')
      return
    }

    setChecking(true)
    const ip = phoneIp.trim()
    const token = tokenInput.trim()

    await Promise.all([
      setTermuxHost(ip),
      setTermuxToken(token),
    ])

    const client = new TermuxClient(token, `http://${ip}:2324`)
    const ok = await client.ping()
    setConnected(ok)
    setChecking(false)

    Alert.alert(
      ok ? '✅ 连接成功' : '❌ 连接失败',
      ok
        ? `Termux 服务器运行中！（${ip}:2324）`
        : `请确认：\n1. Termux 已安装且服务器已启动\n2. IP 地址正确\n3. Token 与服务器一致\n4. 手机和电脑在同一 WiFi`
    )
  }, [phoneIp, tokenInput])

  const copyCommand = useCallback(async () => {
    const cmd = 'curl -sL https://raw.githubusercontent.com/yk578/xiaoye-ai-mobile/main/termux-server/setup.sh | bash'
    await Clipboard.setStringAsync(cmd)
    Alert.alert('已复制', '请在 Termux 中粘贴运行\n长按 Termux 屏幕 → Paste')
  }, [])

  return (
    <ScrollView style={s.container}>
      {/* ── 状态卡片 ── */}
      <View style={s.card}>
        <View style={s.statusRow}>
          <Text style={s.statusDot}>{connected ? '🟢' : '🔴'}</Text>
          <Text style={s.statusText}>
            {connected ? '已连接' : '未连接'}
          </Text>
          <TouchableOpacity
            style={[s.checkBtn, (checking || discovering) && s.btnDisabled]}
            onPress={handleCheck}
            disabled={checking || discovering}
          >
            <Text style={s.checkBtnText}>
              {checking ? '...' : '测试连接'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 自动发现 ── */}
      <TouchableOpacity
        style={[s.discoverBtn, (discovering || checking) && s.btnDisabled]}
        onPress={handleDiscover}
        disabled={discovering || checking}
      >
        {discovering ? (
          <View style={s.discoverRow}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={s.discoverText}>  扫描网络中...</Text>
          </View>
        ) : (
          <Text style={s.discoverText}>📡 自动发现服务器</Text>
        )}
      </TouchableOpacity>

      {/* ── 手动配置 ── */}
      <Text style={s.hint}>没找到？手动输入或点击下方一键安装</Text>

      <View style={s.card}>
        <TextInput
          style={s.input}
          value={phoneIp}
          onChangeText={setPhoneIp}
          placeholder="手机 IP 地址（如 192.168.1.100）"
          placeholderTextColor="#555"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={s.input}
          value={tokenInput}
          onChangeText={setTokenInput}
          placeholder="Token（从 Termux 启动日志获取）"
          placeholderTextColor="#555"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
      </View>

      {/* ── 一键安装 ── */}
      <TouchableOpacity style={s.installBtn} onPress={copyCommand}>
        <Text style={s.installBtnText}>📋 复制一键安装命令</Text>
      </TouchableOpacity>
      <Text style={s.installHint}>在 Termux 中粘贴运行即可安装并启动服务器</Text>

      {/* ── 安装指引 ── */}
      <Text style={s.sectionTitle}>首次使用？</Text>
      <View style={s.stepRow}>
        <Text style={s.stepNum}>1</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.stepTitle}>安装 Termux</Text>
          <Text style={s.stepDesc}>从下方链接下载 Termux</Text>
        </View>
      </View>
      <View style={s.linkRow}>
        <Text style={s.link} onPress={() => Linking.openURL('https://f-droid.org/packages/com.termux/')}>📦 F-Droid 下载</Text>
        <Text style={s.link} onPress={() => Linking.openURL('https://github.com/termux/termux-app/releases/latest')}>📦 GitHub APK</Text>
      </View>

      <View style={s.stepRow}>
        <Text style={s.stepNum}>2</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.stepTitle}>运行一键安装</Text>
          <Text style={s.stepDesc}>打开 Termux → 长按粘贴 → 回车</Text>
        </View>
      </View>

      <View style={s.stepRow}>
        <Text style={s.stepNum}>3</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.stepTitle}>回到此页 → 自动发现</Text>
          <Text style={s.stepDesc}>自动连接，无需手动配 IP/Token</Text>
        </View>
      </View>
    </ScrollView>
  )
}

/* ── 样式 ── */

const s = StyleSheet.create({
  container: { flex: 1 },
  card: {
    backgroundColor: '#111', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#1f1f1f', marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  statusDot: { fontSize: 16 },
  statusText: { color: '#e0e0e0', fontSize: 15, fontWeight: '600', flex: 1 },
  checkBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#7c3aed20', borderRadius: 10,
    borderWidth: 1, borderColor: '#7c3aed40',
  },
  checkBtnText: { color: '#7c3aed', fontSize: 13, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },

  discoverBtn: {
    backgroundColor: '#7c3aed', borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 8,
  },
  discoverRow: { flexDirection: 'row', alignItems: 'center' },
  discoverText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { color: '#666', fontSize: 12, textAlign: 'center', marginBottom: 10 },

  input: {
    backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12,
    color: '#fff', fontSize: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#2a2a2a',
  },

  installBtn: {
    backgroundColor: '#065f46', borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 4,
  },
  installBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  installHint: { color: '#555', fontSize: 11, textAlign: 'center', marginBottom: 16 },

  sectionTitle: {
    color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 12,
  },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#7c3aed20', textAlign: 'center',
    lineHeight: 28, color: '#7c3aed', fontSize: 14, fontWeight: '700',
    overflow: 'hidden',
  },
  stepTitle: { color: '#e0e0e0', fontSize: 14, fontWeight: '600' },
  stepDesc: { color: '#666', fontSize: 12, marginTop: 1 },
  linkRow: {
    flexDirection: 'row', gap: 16, marginBottom: 16,
    paddingLeft: 40,
  },
  link: { color: '#7c3aed', fontSize: 13, fontWeight: '600' },
})
