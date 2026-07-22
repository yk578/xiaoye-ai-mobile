/**
 * 配置存储 — 基于 expo-file-system（JSON 文件）
 *
 * 替换 expo-sqlite，避开 Android 原生模块 NPE。
 * 写入做原子交换，防止断电/崩溃导致文件损坏。
 */

/**
 * 按 deprecation 提示导入 legacy API，避免新版本 getInfoAsync 抛异常。
 * 同时做两段式降级：文件写入失败 → 内存缓存，保证关键操作不崩。
 */
import * as FileSystem from 'expo-file-system/legacy'
import type { AppConfig, ProviderStoreEntry } from '../types'

/* ── 文件路径 ── */

const CONFIG_DIR = `${FileSystem.documentDirectory}xiaoye-config/`
const DATA_FILE = `${CONFIG_DIR}data.json`
const TMP_FILE = `${CONFIG_DIR}data.json.tmp`

/** 内存缓存 + 持久化标识 */
let cache: Record<string, string> | null = null
let storageOk = true

async function ensureDir(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(CONFIG_DIR)
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(CONFIG_DIR, { intermediates: true })
    }
    return true
  } catch {
    storageOk = false
    return false
  }
}

async function loadAll(): Promise<Record<string, string>> {
  if (cache) return cache
  cache = {}
  try {
    const raw = await FileSystem.readAsStringAsync(DATA_FILE)
    cache = JSON.parse(raw)
    storageOk = true
  } catch {
    cache = {}
  }
  return cache!
}

async function flush(): Promise<void> {
  if (!cache) return
  const json = JSON.stringify(cache)
  // 先试临时文件 -> move 原子交换
  try {
    await FileSystem.writeAsStringAsync(TMP_FILE, json)
    await FileSystem.moveAsync({ from: TMP_FILE, to: DATA_FILE })
    storageOk = true
    return
  } catch {}
  // 降级：直接写目标文件
  try {
    await FileSystem.writeAsStringAsync(DATA_FILE, json)
    storageOk = true
    return
  } catch {
    storageOk = false
  }
}

/* ── 通用 KV ── */

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

/* ── App 配置读写 ── */

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

/* ── Provider 配置 ── */

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

/* ── Termux Token ── */

export async function getTermuxToken(): Promise<string | null> {
  return get('termuxToken')
}

export async function setTermuxToken(token: string): Promise<void> {
  await set('termuxToken', token)
}

/* ── Termux 手机 IP ── */

export async function getTermuxHost(): Promise<string> {
  return (await get('termuxHost')) || '127.0.0.1'
}

export async function setTermuxHost(ip: string): Promise<void> {
  await set('termuxHost', ip)
}

/* ── 许可存储 ── */

export async function getLicenseData(): Promise<string | null> {
  return get('licenseData')
}

export async function setLicenseData(data: string): Promise<void> {
  await set('licenseData', data)
}

/* ── 对话存储 ── */

export async function saveConversation(convId: string, data: string): Promise<void> {
  await set(`conv_${convId}`, data)
}

export async function getConversation(convId: string): Promise<string | null> {
  return get(`conv_${convId}`)
}
