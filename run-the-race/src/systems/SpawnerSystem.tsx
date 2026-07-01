import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, VERSES } from '@/store/gameStore'
import { LANE_POSITIONS, PLAYER_Z } from '@/utils/constants'
import { playerXRef } from '@/utils/playerRef'
import { overlapsXZ } from '@/physics/collision'

const SPAWN_Z = PLAYER_Z - 55
const DESPAWN_Z = PLAYER_Z + 8
const OBSTACLE_POOL = 24
const COLLECT_POOL = 18

type EntityType = 'obstacle' | 'collectible'
type Pattern = { laneIdx: number; type: EntityType }[]

interface PoolEntry {
  group: THREE.Group
  active: boolean
  type: EntityType
  x: number
  z: number
  verseIdx: number
}

// ---- Materials (shared) ----
const obsMat = new THREE.MeshStandardMaterial({
  color: '#7f1d1d', roughness: 0.8, metalness: 0.3,
  emissive: '#450a0a', emissiveIntensity: 0.3,
})
const obsWireMat = new THREE.MeshBasicMaterial({
  color: '#ef4444', wireframe: true, transparent: true, opacity: 0.2,
})
const collectMat = new THREE.MeshStandardMaterial({
  color: '#FCD34D', emissive: '#F59E0B', emissiveIntensity: 0.8,
  roughness: 0.3, metalness: 0.5,
})
const collectCrossMat = new THREE.MeshStandardMaterial({
  color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.9,
})

function buildObstacleMesh(): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.4, 1.5), obsMat)
  body.position.y = 1.2
  body.castShadow = true
  g.add(body)
  const wire = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 1.8), obsWireMat)
  wire.position.y = 1.4
  g.add(wire)
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 6), obsMat)
  spike.position.y = 2.8
  g.add(spike)
  g.visible = false
  return g
}

function buildCollectibleMesh(): THREE.Group {
  const g = new THREE.Group()
  const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 10), collectMat)
  scroll.position.y = 1.2
  g.add(scroll)
  for (const y of [0.75, 1.65]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.12, 10), collectMat)
    cap.position.y = y
    g.add(cap)
  }
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.1), collectCrossMat)
  crossH.position.set(0, 1.2, 0.29)
  g.add(crossH)
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.1), collectCrossMat)
  crossV.position.set(0, 1.2, 0.29)
  g.add(crossV)
  g.visible = false
  return g
}

function pickPattern(distance: number): Pattern {
  const r = Math.random()
  if (distance < 100) {
    // Grace period: single obstacles or pure collectibles
    if (r < 0.4) return [{ laneIdx: Math.floor(Math.random() * 3), type: 'obstacle' }]
    return [0, 1, 2].map(laneIdx => ({ laneIdx, type: 'collectible' }))
  }

  if (r < 0.25) {
    // Collectibles only
    if (Math.random() < 0.5) return [{ laneIdx: 1, type: 'collectible' }]
    return [0, 1, 2].map(l => ({ laneIdx: l, type: 'collectible' }))
  } else if (r < 0.55) {
    // Single obstacle
    return [{ laneIdx: Math.floor(Math.random() * 3), type: 'obstacle' }]
  } else if (r < 0.8) {
    // Two obstacles (one clear lane)
    const clear = Math.floor(Math.random() * 3)
    return [0, 1, 2].filter(l => l !== clear).map(l => ({ laneIdx: l, type: 'obstacle' }))
  } else {
    // Two obstacles + collectible in the clear lane
    const clear = Math.floor(Math.random() * 3)
    return [
      ...[0, 1, 2].filter(l => l !== clear).map(l => ({ laneIdx: l, type: 'obstacle' as EntityType })),
      { laneIdx: clear, type: 'collectible' as EntityType },
    ]
  }
}

export default function SpawnerSystem() {
  const groupRef = useRef<THREE.Group>(null)
  const obstaclePool = useRef<PoolEntry[]>([])
  const collectPool = useRef<PoolEntry[]>([])
  const distSinceSpawn = useRef(-30)
  const bobTime = useRef(0)

  useEffect(() => {
    const parent = groupRef.current
    if (!parent) return

    const obs = Array.from({ length: OBSTACLE_POOL }, () => {
      const group = buildObstacleMesh()
      parent.add(group)
      return { group, active: false, type: 'obstacle' as EntityType, x: 0, z: 0, verseIdx: -1 }
    })
    const col = Array.from({ length: COLLECT_POOL }, () => {
      const group = buildCollectibleMesh()
      parent.add(group)
      return { group, active: false, type: 'collectible' as EntityType, x: 0, z: 0, verseIdx: -1 }
    })
    obstaclePool.current = obs
    collectPool.current = col

    return () => {
      obs.forEach(e => parent.remove(e.group))
      col.forEach(e => parent.remove(e.group))
    }
  }, [])

  useFrame((_, delta) => {
    const store = useGameStore.getState()
    if (store.phase !== 'running' && store.phase !== 'faith') return

    const move = store.speed * delta
    const px = playerXRef.current
    bobTime.current += delta * 2

    // Spawn interval shrinks with distance (more challenging over time)
    const spawnInterval = Math.max(14, 20 - store.distance * 0.004)
    distSinceSpawn.current += move

    if (distSinceSpawn.current >= spawnInterval) {
      distSinceSpawn.current = 0
      const pattern = pickPattern(store.distance)
      const nextVerse = Math.floor(Math.random() * VERSES.length)

      for (const { laneIdx, type } of pattern) {
        const pool = type === 'obstacle' ? obstaclePool.current : collectPool.current
        const entry = pool.find(e => !e.active)
        if (!entry) continue
        entry.active = true
        entry.x = LANE_POSITIONS[laneIdx]
        entry.z = SPAWN_Z
        entry.verseIdx = type === 'collectible' ? nextVerse : -1
        entry.group.position.set(entry.x, 0, entry.z)
        entry.group.visible = true
      }
    }

    // Update active entities
    const allPools = [...obstaclePool.current, ...collectPool.current]
    for (const entry of allPools) {
      if (!entry.active) continue

      entry.z += move
      entry.group.position.z = entry.z

      // Collectible: bob + rotate
      if (entry.type === 'collectible') {
        entry.group.position.y = 0.15 * Math.sin(bobTime.current + entry.x)
        entry.group.rotation.y += delta * 1.5
      }

      // Despawn behind player
      if (entry.z > DESPAWN_Z) {
        entry.active = false
        entry.group.visible = false
        continue
      }

      // During Faith Walk: auto-collect all scrolls in visible range
      if (store.phase === 'faith' && entry.type === 'collectible' && entry.z > SPAWN_Z && entry.z < DESPAWN_Z) {
        useGameStore.getState().addScore(100 * store.multiplier)
        useGameStore.getState().incrementCombo()
        if (entry.verseIdx >= 0) useGameStore.getState().collectVerse(entry.verseIdx)
        entry.active = false
        entry.group.visible = false
        continue
      }

      // Skip collision when invincible
      if (store.isInvincible) continue

      const inZone = overlapsXZ(
        px, PLAYER_Z, 0.55, 0.6,
        entry.x, entry.z, entry.type === 'obstacle' ? 0.75 : 0.85, 1.0,
      )

      if (inZone) {
        if (entry.type === 'obstacle') {
          useGameStore.getState().loseLife()
          useGameStore.getState().resetCombo()
        } else {
          useGameStore.getState().addScore(50 * store.multiplier)
          useGameStore.getState().addFaith(22)
          useGameStore.getState().incrementCombo()
          if (entry.verseIdx >= 0) {
            useGameStore.getState().collectVerse(entry.verseIdx)
          }
        }
        entry.active = false
        entry.group.visible = false
      }
    }
  })

  return <group ref={groupRef} />
}
