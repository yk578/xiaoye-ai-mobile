/**
 * 视频动态背景 — 跟桌面端一致的毛利兰视频背景
 *
 * require() 在 Android release 返回数字 asset ID，
 * expo-av Video 组件原生端会自动解析。
 */

import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Video, ResizeMode } from 'expo-av'

const VIDEO = require('../../assets/moli-lan-bg.mp4')

export function VideoBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Video
        source={VIDEO}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  video: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
})
