/**
 * 配置存储 — 基于 AsyncStorage（通过 expo-sqlite）
 *
 * 存储内容：
 * - Provider 配置列表（API Key 明文存储，手机上用安全区域）
 * - 默认模型、温度、MaxTokens
 * - Termux Token
 * - 许可信息
 */

import * as SQLite from 'expo-sqlite'
import type { AppConfig, ProviderStoreEntry } from '../types'

let db: SQLite.SQLiteDatabase | null = null

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('xiaoye-config.db')
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
  }
  return db
}

/* ── 通用 KV 存储 ── */

async function get(key: string): Promise<string | null> {
  const d = await getDb()
  const row = await d.getFirstAsync<{ value: string }>('SELECT value FROM config WHERE key = ?', key)
  return row?.value ?? null
}

async function set(key: string, value: string): Promise<void> {
  const d = await getDb()
  await d.runAsync('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', key, value)
}

/* ── 默认值 ── */

const DEFAULTS: Omit<AppConfig, 'apiKey'> = {
  model: 'deepseek-v4-pro',
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

/* ── Provider 配置管理 ── */

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

/* ── 会话/对话存储 ── */

export async function saveConversation(convId: string, data: string): Promise<void> {
  await set(`conv_${convId}`, data)
}

export async function getConversation(convId: string): Promise<string | null> {
  return get(`conv_${convId}`)
}
