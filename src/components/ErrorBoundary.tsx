import React from 'react'
import { View } from 'react-native'

interface Props {
  fallback?: React.ReactNode
  children: React.ReactNode
}
interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.warn('[ErrorBoundary]', error?.message || error)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <View />
    }
    return this.props.children
  }
}
