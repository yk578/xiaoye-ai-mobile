/**
 * 配置存储 — expo-file-system 极简版
 *
 * 不用 getInfoAsync（已弃用），直接试读写。
 * 写失败自动降级到内存缓存。
 */

/**
 * 配置存储 — expo-file-system legacy 版
 *
 * 极简 KV 存储，写入失败时自动降级到内存缓存。
 */

import * as FileSystem from 'expo-file-system/legacy'
import type { AppConfig, ProviderStoreEntry } from '../types'

/* ── 路径（延迟初始化）── */

let CONFIG_DIR = ''
let DATA_FILE = ''

function ensurePaths(): boolean {
  if (CONFIG_DIR) return true
  try {
    const docDir = FileSystem.documentDirectory
    if (!docDir) return false
    CONFIG_DIR = `${docDir}xiaoye-config/`
    DATA_FILE = `${CONFIG_DIR}data.json`
    return true
  } catch {
    return false
  }
}

/** 内存缓存 */
let cache: Record<string, string> | null = null

async function loadAll(): Promise<Record<string, string>> {
  if (cache) return cache
  cache = {}
  if (!ensurePaths()) return cache
  try {
    const raw = await FileSystem.readAsStringAsync(DATA_FILE)
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      cache = parsed as Record<string, string>
    }
  } catch {}
  return cache!
}

async function flush(): Promise<void> {
  if (!cache) return
  if (!ensurePaths()) return
  const json = JSON.stringify(cache)
  try {
    await FileSystem.writeAsStringAsync(DATA_FILE, json)
  } catch {
    // 写失败保持内存缓存可用
  }
}

async function get(key: string): Promise<string | null> {
  const all = await loadAll()
  return all[key] ?? null
}

async function set(key: string, value: string): Promise<void> {
  const all = await loadAll()
  all[key] = value
  await flush()
}

/* ── 默认值 ── */

const DEFAULTS: Omit<AppConfig, 'apiKey'> = {
  model: 'oc/deepseek-v4-flash',
  temperature: 0.7,
  maxTokens: 131072,
  tokenBudget: 100000,
  thinkingEnabled: false,
}

/* ── App 配置 ── */

export async function getConfig(): Promise<AppConfig> {
  const raw = await get('appConfig')
  if (!raw) return { apiKey: '', ...DEFAULTS }
  try {
    return { apiKey: '', ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { apiKey: '', ...DEFAULTS }
  }
}

export async function updateConfig(partial: Partial<AppConfig>): Promise<void> {
  const current = await getConfig()
  const merged = { ...current, ...partial }
  await set('appConfig', JSON.stringify(merged))
}

export async function hasApiKey(): Promise<boolean> {
  const config = await getConfig()
  return config.apiKey.length > 0
}

/* ── Provider ── */

export async function getProviderConfigs(): Promise<ProviderStoreEntry[]> {
  const raw = await get('providers')
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export async function setProviderConfigs(configs: ProviderStoreEntry[]): Promise<void> {
  await set('providers', JSON.stringify(configs))
}

export async function addProviderConfig(entry: ProviderStoreEntry): Promise<void> {
  const configs = await getProviderConfigs()
  configs.push(entry)
  await setProviderConfigs(configs)
}

export async function removeProviderConfig(name: string): Promise<void> {
  let configs = await getProviderConfigs()
  configs = configs.filter(p => p.name !== name)
  await setProviderConfigs(configs)
}

/* ── Termux Token / Host ── */

export async function getTermuxToken(): Promise<string | null> {
  return get('termuxToken')
}

export async function setTermuxToken(token: string): Promise<void> {
  await set('termuxToken', token)
}

export async function getTermuxHost(): Promise<string> {
  return (await get('termuxHost')) || '127.0.0.1'
}

export async function setTermuxHost(ip: string): Promise<void> {
  await set('termuxHost', ip)
}

/* ── 许可 / 对话 ── */

export async function getLicenseData(): Promise<string | null> {
  return get('licenseData')
}

export async function setLicenseData(data: string): Promise<void> {
  await set('licenseData', data)
}

export async function saveConversation(convId: string, data: string): Promise<void> {
  await set(`conv_${convId}`, data)
}

export async function getConversation(convId: string): Promise<string | null> {
  return get(`conv_${convId}`)
}
