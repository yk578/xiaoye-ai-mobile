/**
 * useConfig — 配置状态管理 Hook
 *
 * 从 SettingsScreen 提取所有配置相关状态，
 * 包括 Provider 管理、Termux 连接、对话设置。
 */

import { useState, useEffect, useCallback } from 'react'
import {
  getConfig, updateConfig,
  getProviderConfigs, addProviderConfig, removeProviderConfig,
  getTermuxToken, setTermuxToken, getTermuxHost, setTermuxHost,
} from '../services/config-store'
import type { ProviderStoreEntry, AppConfig } from '../types'

export function useConfig() {
  const [config, setConfigState] = useState<AppConfig>({
    apiKey: '', model: '', temperature: 0.7,
    maxTokens: 131072, tokenBudget: 100000, thinkingEnabled: false,
    defaultProvider: undefined,
  })
  const [providers, setProviders] = useState<ProviderStoreEntry[]>([])
  const [termuxToken, setTermuxTokenState] = useState('')
  const [termuxHost, setTermuxHostState] = useState('127.0.0.1')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [cfg, provs, token, host] = await Promise.all([
        getConfig(),
        getProviderConfigs(),
        getTermuxToken(),
        getTermuxHost(),
      ])
      setConfigState(cfg)
      setProviders(provs)
      if (token) setTermuxTokenState(token)
      setTermuxHostState(host)
    } catch (err) {
      console.warn('[useConfig] loadData error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveTermuxToken = useCallback(async (token: string) => {
    await setTermuxToken(token)
    setTermuxTokenState(token)
  }, [])

  const saveTermuxHost = useCallback(async (host: string) => {
    await setTermuxHost(host)
    setTermuxHostState(host)
  }, [])

  const addProvider = useCallback(async (entry: ProviderStoreEntry) => {
    await addProviderConfig(entry)
    setProviders(await getProviderConfigs())
  }, [])

  const removeProvider = useCallback(async (name: string) => {
    await removeProviderConfig(name)
    setProviders(await getProviderConfigs())
  }, [])

  const toggleThinking = useCallback(async (val: boolean) => {
    await updateConfig({ thinkingEnabled: val })
    setConfigState(prev => ({ ...prev, thinkingEnabled: val }))
  }, [])

  const saveConfig = useCallback(async (partial: Partial<typeof config>) => {
    await updateConfig(partial)
    setConfigState(prev => ({ ...prev, ...partial }))
  }, [])

  return {
    config, providers, termuxToken, termuxHost,
    loading, loadData,
    saveTermuxToken, saveTermuxHost,
    addProvider, removeProvider,
    toggleThinking, saveConfig,
  }
}
