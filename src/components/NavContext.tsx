import React from 'react'

export type Screen = 'Chat' | 'Files' | 'Memory' | 'Settings'

export interface NavContextType {
  navigate: (screen: Screen) => void
  openDrawer: () => void
  currentScreen: Screen
}

export const NavContext = React.createContext<NavContextType>(null as any)

export function useNav() {
  return React.useContext(NavContext)
}
