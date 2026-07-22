/**
 * 配置存储 — expo-file-system 极简版
 *
 * 不用 getInfoAsync（已弃用），直接试读写。
 * 写失败自动降级到内存缓存。
 */

import * as FileSystem from 'expo-file-system'
import type { AppConfig, ProviderStoreEntry } from '../types'

/* ── 文件路径 ── */

const CONFIG_DIR = `${FileSystem.documentDirectory}xiaoye-config/`
const DATA_FILE = `${CONFIG_DIR}data.json`

/** 内存缓存 */
let cache: Record<string, string> | null = null
let storageOk = true

async function loadAll(): Promise<Record<string, string>> {
  if (cache) return cache
  cache = {}
  try {
    const raw = await FileSystem.readAsStringAsync(DATA_FILE)
    cache = JSON.parse(raw) as Record<string, string>
  } catch {}
  return cache!
}

async function flush(): Promise<void> {
  if (!cache) return
  const json = JSON.stringify(cache)
  try {
    // 先确保目录存在（writeAsStringAsync 在新版 expo-file-system 会自动创建目录）
    await FileSystem.writeAsStringAsync(DATA_FILE, json)
    storageOk = true
  } catch (e) {
    // 如果直接写失败，试试先创建目录再写
    try {
      const dirInfo = await FileSystem.getInfoAsync(CONFIG_DIR)
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CONFIG_DIR, { intermediates: true })
      }
      await FileSystem.writeAsStringAsync(DATA_FILE, json)
      storageOk = true
    } catch {
      storageOk = false
    }
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
