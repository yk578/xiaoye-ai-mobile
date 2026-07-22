import React, { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { NavContext } from './components/NavContext'
import type { Screen } from './components/NavContext'
import { ChatScreen } from './screens/ChatScreen'
import { ToolsScreen } from './screens/ToolsScreen'
import { MemoryScreen } from './screens/MemoryScreen'
import { SettingsScreen } from './screens/SettingsScreen'

const DRAWER_WIDTH = Dimensions.get('window').width * 0.72

export default function Navigation() {
  const insets = useSafeAreaInsets()
  const [currentScreen, setCurrentScreen] = useState<Screen>('Chat')
  const [showDrawer, setShowDrawer] = useState(false)

  const openDrawer = useCallback(() => setShowDrawer(true), [])
  const closeDrawer = useCallback(() => setShowDrawer(false), [])

  const navigate = useCallback((screen: Screen) => {
    setCurrentScreen(screen)
    closeDrawer()
  }, [closeDrawer])

  const nav = { openDrawer, navigate, currentScreen }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Chat': return <ChatScreen navigation={nav} />
      case 'Files': return <ToolsScreen navigation={nav} />
      case 'Memory': return <MemoryScreen navigation={nav} />
      case 'Settings': return <SettingsScreen navigation={nav} />
    }
  }

  return (
    <NavContext.Provider value={nav}>
      <View style={{flex: 1}}>
        {renderScreen()}

        {showDrawer && (
          <>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.overlay}
              onPress={closeDrawer}
            />
            <View style={[styles.drawer, { paddingTop: insets.top }]}>
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle}>小叶AI</Text>
                <Text style={styles.drawerSub}>移动开发助手 v1.0</Text>
              </View>
              <DrawerItem icon="💬" label="对话" active={currentScreen === 'Chat'} onPress={() => navigate('Chat')} />
              <DrawerItem icon="📁" label="文件" active={currentScreen === 'Files'} onPress={() => navigate('Files')} />
              <DrawerItem icon="🧠" label="记忆" active={currentScreen === 'Memory'} onPress={() => navigate('Memory')} />
              <DrawerItem icon="⚙️" label="设置" active={currentScreen === 'Settings'} onPress={() => navigate('Settings')} />
            </View>
          </>
        )}
      </View>
    </NavContext.Provider>
  )
}

function DrawerItem({ icon, label, active, onPress }: {
  icon: string; label: string; active: boolean; onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.drawerItem, active && styles.drawerItemActive]}
      onPress={onPress}
    >
      <Text style={styles.drawerItemIcon}>{icon}</Text>
      <Text style={[styles.drawerItemLabel, active && styles.drawerItemLabelActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#00000080', zIndex: 10,
  },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: DRAWER_WIDTH, backgroundColor: '#111', zIndex: 20,
    borderRightWidth: 1, borderRightColor: '#1f1f1f',
  },
  drawerHeader: { padding: 20, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  drawerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  drawerSub: { color: '#666', fontSize: 12, marginTop: 4 },
  drawerItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  drawerItemActive: { backgroundColor: '#7c3aed15' },
  drawerItemIcon: { fontSize: 18, marginRight: 14 },
  drawerItemLabel: { color: '#aaa', fontSize: 15 },
  drawerItemLabelActive: { color: '#7c3aed', fontWeight: '600' },
})
