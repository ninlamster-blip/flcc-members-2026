import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/store/gameStore'
import { TILE_LENGTH, TILE_COUNT, PLAYER_Z } from '@/utils/constants'

const TRACK_WIDTH = 9
const EDGE_WIDTH = 0.4
const RECYCLE_THRESHOLD = PLAYER_Z + TILE_LENGTH + 4

const trackMat = new THREE.MeshStandardMaterial({ color: '#1e1b4b', roughness: 0.9, metalness: 0.1 })
const edgeMat = new THREE.MeshStandardMaterial({
  color: '#4f46e5', roughness: 0.6, emissive: '#4f46e5', emissiveIntensity: 0.35,
})
const stripeMat = new THREE.MeshStandardMaterial({ color: '#312e81', roughness: 1, opacity: 0.4, transparent: true })
const groundMat = new THREE.MeshStandardMaterial({ color: '#050510', roughness: 1 })

function buildTileMesh(): THREE.Group {
  const g = new THREE.Group()

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, TILE_LENGTH), groundMat)
  ground.rotation.x = -Math.PI / 2
  g.add(ground)

  const track = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_WIDTH, TILE_LENGTH), trackMat)
  track.rotation.x = -Math.PI / 2
  track.position.y = 0.01
  track.receiveShadow = true
  g.add(track)

  const leftEdge = new THREE.Mesh(new THREE.PlaneGeometry(EDGE_WIDTH, TILE_LENGTH), edgeMat)
  leftEdge.rotation.x = -Math.PI / 2
  leftEdge.position.set(-TRACK_WIDTH / 2 - EDGE_WIDTH / 2, 0.02, 0)
  g.add(leftEdge)

  const rightEdge = new THREE.Mesh(new THREE.PlaneGeometry(EDGE_WIDTH, TILE_LENGTH), edgeMat)
  rightEdge.rotation.x = -Math.PI / 2
  rightEdge.position.set(TRACK_WIDTH / 2 + EDGE_WIDTH / 2, 0.02, 0)
  g.add(rightEdge)

  for (const x of [-3, 3]) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.06, TILE_LENGTH), stripeMat)
    stripe.rotation.x = -Math.PI / 2
    stripe.position.set(x, 0.02, 0)
    g.add(stripe)
  }

  return g
}

export default function Track() {
  const groupRef = useRef<THREE.Group>(null)
  const tilesRef = useRef<THREE.Group[]>([])
  // Tiles span from far ahead (low Z) to just behind player (high Z)
  // and scroll toward the camera (+Z direction) to simulate forward movement.
  const zPositions = useRef<number[]>(
    Array.from({ length: TILE_COUNT }, (_, i) => PLAYER_Z - i * TILE_LENGTH)
  )

  const phase = useGameStore((s) => s.phase)
  const speed = useGameStore((s) => s.speed)
  const updateDistance = useGameStore((s) => s.updateDistance)

  useEffect(() => {
    const parent = groupRef.current
    if (!parent) return
    const tiles = Array.from({ length: TILE_COUNT }, (_, i) => {
      const mesh = buildTileMesh()
      mesh.position.z = zPositions.current[i]
      parent.add(mesh)
      return mesh
    })
    tilesRef.current = tiles
    return () => { tiles.forEach((t) => parent.remove(t)) }
  }, [])

  useFrame((_, delta) => {
    if (phase !== 'running' && phase !== 'faith') return
    const move = speed * delta
    updateDistance(move)

    const tiles = tilesRef.current
    const zp = zPositions.current

    for (let i = 0; i < tiles.length; i++) {
      zp[i] += move
      if (zp[i] > RECYCLE_THRESHOLD) {
        zp[i] -= TILE_COUNT * TILE_LENGTH
      }
      tiles[i].position.z = zp[i]
    }
  })

  return <group ref={groupRef} />
}
