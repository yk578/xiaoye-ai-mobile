/**
 * TermuxClient — 通过 HTTP 协议与 Termux 服务器通信
 *
 * Termux 服务器运行在 localhost:2324，提供文件系统操作和命令执行。
 * v2 支持 UDP 自动发现和子网扫描。
 */

import { Platform } from 'react-native'

const TERMUX_PORT = 2324
const BASE_URL = `http://127.0.0.1:${TERMUX_PORT}`
const FALLBACK_URL = `http://localhost:${TERMUX_PORT}`

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: string
}

export interface ServerInfo {
  version: number
  ip: string
  port: number
  hostname: string
  home: string
  token?: string
}

export class TermuxClient {
  private token: string
  baseUrl: string

  constructor(token: string, baseUrl?: string) {
    this.token = token
    this.baseUrl = baseUrl || BASE_URL
  }

  /* ── 连接状态 ── */

  /** 检测 Termux 服务器是否在线 */
  async ping(ms?: number): Promise<boolean> {
    const timeout = ms ?? 3000
    const race = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeout)
    )
    for (const url of [this.baseUrl, FALLBACK_URL]) {
      try {
        const res = await Promise.race([
          fetch(`${url}/ping`, {
            headers: { 'X-Auth-Token': this.token },
          }),
          race,
        ]) as Response
        if (res.ok) {
          if (url !== this.baseUrl) this.baseUrl = url
          return true
        }
      } catch {}
    }
    return false
  }

  /** 获取服务器信息 */
  async getServerInfo(): Promise<ServerInfo | null> {
    try {
      const res = await fetch(`${this.baseUrl}/info`, {
        headers: { 'X-Auth-Token': this.token },
      })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }

  /* ── 命令执行 ── */

  /** 执行 shell 命令，返回 stdout/stderr */
  async exec(command: string, ms: number = 30000, cwd?: string): Promise<ExecResult> {
    const time = ms + 5000
    const race = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), time)
    )
    const res = await Promise.race([
      fetch(`${this.baseUrl}/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': this.token,
        },
        body: JSON.stringify({ command, timeout: ms, cwd }),
      }),
      race,
    ]) as Response
    if (!res.ok) throw new Error(`Termux exec 失败: ${res.status}`)
    return res.json()
  }

  /* ── 文件系统 ── */

  async readFile(path: string): Promise<string> {
    const res = await fetch(
      `${this.baseUrl}/fs/read?path=${encodeURIComponent(path)}`,
      { headers: { 'X-Auth-Token': this.token } }
    )
    if (!res.ok) throw new Error(`Termux readFile 失败: ${res.status}`)
    const data = await res.json()
    return data.content
  }

  async writeFile(path: string, content: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/fs/write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.token,
      },
      body: JSON.stringify({ path, content }),
    })
    if (!res.ok) throw new Error(`Termux writeFile 失败: ${res.status}`)
  }

  async listDir(path: string): Promise<FileInfo[]> {
    const res = await fetch(
      `${this.baseUrl}/fs/list?path=${encodeURIComponent(path)}`,
      { headers: { 'X-Auth-Token': this.token } }
    )
    if (!res.ok) throw new Error(`Termux listDir 失败: ${res.status}`)
    const data = await res.json()
    return data.files || []
  }

  async delete(path: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/fs/delete?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
      headers: { 'X-Auth-Token': this.token },
    })
    if (!res.ok) throw new Error(`Termux delete 失败: ${res.status}`)
  }

  async mkdir(path: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/fs/mkdir`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.token,
      },
      body: JSON.stringify({ path }),
    })
    if (!res.ok) throw new Error(`Termux mkdir 失败: ${res.status}`)
  }

  async stat(path: string): Promise<FileInfo | null> {
    try {
      const res = await fetch(
        `${this.baseUrl}/fs/stat?path=${encodeURIComponent(path)}`,
        { headers: { 'X-Auth-Token': this.token } }
      )
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }

  /* ── 可用性 ── */

  static get isAvailable(): boolean {
    return Platform.OS === 'android'
  }
}

/* ── 自动发现 ── */

/**
 * 扫描本地网络，发现小叶AI Termux 服务器
 *
 * 工作原理：
 * 1. 获取本机 WiFi IP（通过 NetInfo）
 * 2. 解析子网
 * 3. 并行探测常见 IP（网关、同网段 .1-.254）
 * 4. 返回找到的服务器列表
 *
 * 注意：服务器 v2 已支持 UDP 广播自动发现，
 * 手机端可通过此函数快速找到同一 WiFi 下的服务器。
 */
export async function discoverServers(
  token: string,
  options?: { signal?: AbortSignal; onProgress?: (ip: string) => void }
): Promise<{ ip: string; token: string }[]> {
  const signal = options?.signal
  const onProgress = options?.onProgress
  const found: { ip: string; token: string }[] = []

  // 先试本地
  const localTests = [
    { url: 'http://127.0.0.1:2324', ip: '127.0.0.1' },
    { url: 'http://localhost:2324', ip: '127.0.0.1' },
  ]
  for (const { url, ip } of localTests) {
    if (signal?.aborted) return found
    try {
      const res = await Promise.race([
        fetch(`${url}/ping`, { headers: { 'X-Auth-Token': token } }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
      ]) as Response
      if (res.ok) {
        found.push({ ip, token })
        return found
      }
    } catch {}
  }

  // 获取本机 WiFi IP 并扫描子网
  try {
    // 动态导入 NetInfo（@react-native-community/netinfo 已在依赖中）
    const NetInfo = require('@react-native-community/netinfo')
    const state = await NetInfo.fetch()
    const ipAddress = state.details?.ipAddress as string | undefined
    if (!ipAddress) return found

    const parts = ipAddress.split('.')
    if (parts.length !== 4) return found

    const subnet = parts.slice(0, 3).join('.')
    const ownLast = parseInt(parts[3])

    // 要探测的 IP 列表：网关、自己、周围、常用
    const probes = new Set<number>()

    // 网关
    probes.add(1)
    probes.add(ownLast)
    // 周围 10 个
    for (let i = Math.max(2, ownLast - 5); i <= Math.min(254, ownLast + 5); i++) {
      probes.add(i)
    }

    const candidates = Array.from(probes).map(last => `${subnet}.${last}`)

    // 分批并行探测（每批 8 个）
    const BATCH = 8
    for (let i = 0; i < candidates.length; i += BATCH) {
      if (signal?.aborted) break
      const batch = candidates.slice(i, i + BATCH)

      const results = await Promise.allSettled(
        batch.map(async (ip) => {
          onProgress?.(ip)
          const url = `http://${ip}:2324`
          const res = await Promise.race([
            fetch(`${url}/ping`, { headers: { 'X-Auth-Token': token } }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000)),
          ]) as Response
          if (res.ok) {
            found.push({ ip, token })
          }
        })
      )
    }
  } catch {
    // NetInfo 不可用或探测失败
  }

  return found
}

/** 生成随机 Token */
export function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}
