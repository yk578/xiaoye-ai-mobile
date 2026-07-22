/**
 * 动态背景 — 浮动光点 + 渐变粒子
 *
 * 纯 RN Animated API，零外部依赖
 * 跟桌面端二次元角色对应，手机端用抽象粒子风格
 */

import React, { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet, Dimensions } from 'react-native'

const { width: W, height: H } = Dimensions.get('window')

interface Particle {
  x: number
  y: number
  size: number
  opacity: Animated.Value
  scale: Animated.Value
  duration: number
  delay: number
  color: string
}

const PARTICLE_COLORS = [
  'rgba(124,58,237,0.25)',   // #7c3aed — 紫
  'rgba(99,102,241,0.20)',   // 靛蓝
  'rgba(168,85,247,0.18)',   // 淡紫
  'rgba(236,72,153,0.15)',   // 粉
  'rgba(139,92,246,0.22)',   // 中紫
]

function createParticle(): Particle {
  return {
    x: Math.random() * W,
    y: Math.random() * H * 0.7,
    size: Math.random() * 80 + 40,
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0.6),
    duration: Math.random() * 4000 + 4000,
    delay: Math.random() * 3000,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
  }
}

export function AnimatedBackground() {
  const particles = useRef<Particle[]>(
    Array.from({ length: 8 }, () => createParticle())
  ).current

  useEffect(() => {
    const loops = particles.map(p => {
      const anim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.delay(p.delay),
            Animated.timing(p.opacity, {
              toValue: 1,
              duration: p.duration / 2,
              useNativeDriver: true,
            }),
            Animated.timing(p.opacity, {
              toValue: 0,
              duration: p.duration / 2,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(p.delay),
            Animated.timing(p.scale, {
              toValue: 1.4,
              duration: p.duration,
              useNativeDriver: true,
            }),
          ]),
        ])
      )
      anim.start()
      return anim
    })

    return () => loops.forEach(l => l.stop())
  }, [])

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              left: p.x - p.size / 2,
              top: p.y - p.size / 2,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [{ scale: p.scale }],
            },
          ]}
        />
      ))}

      {/* 底部大光晕 — 模拟桌面端地面光晕 */}
      <View style={styles.bottomGlow} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -40,
    left: '10%',
    right: '10%',
    height: 160,
    borderRadius: 200,
    backgroundColor: 'rgba(124,58,237,0.06)',
  },
})
