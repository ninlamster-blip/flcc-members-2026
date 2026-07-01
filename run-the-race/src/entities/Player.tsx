import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, Lane } from '@/store/gameStore'
import { LANE_POSITIONS, LANE_SWITCH_DURATION, PLAYER_Z, INVINCIBLE_DURATION } from '@/utils/constants'
import { playerXRef } from '@/utils/playerRef'

const BODY_COLOR = '#60A5FA'
const HEAD_COLOR = '#FCD34D'
const ROBE_COLOR = '#3B82F6'

function buildPlayerMesh(): THREE.Group {
  const g = new THREE.Group()

  // Robe / body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.35, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: ROBE_COLOR })
  )
  body.position.y = 0.65
  body.castShadow = true
  g.add(body)

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshStandardMaterial({ color: HEAD_COLOR })
  )
  head.position.y = 1.35
  head.castShadow = true
  g.add(head)

  // Arms
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.55, 6),
      new THREE.MeshStandardMaterial({ color: BODY_COLOR })
    )
    arm.position.set(side * 0.38, 0.85, 0)
    arm.rotation.z = side * 0.4
    arm.castShadow = true
    g.add(arm)
  }

  // Legs
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.55, 6),
      new THREE.MeshStandardMaterial({ color: ROBE_COLOR })
    )
    leg.position.set(side * 0.14, 0.18, 0)
    leg.castShadow = true
    g.add(leg)
  }

  // Cross emblem on chest
  const crossH = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.04, 0.05),
    new THREE.MeshStandardMaterial({ color: '#FCD34D', emissive: '#FCD34D', emissiveIntensity: 0.5 })
  )
  crossH.position.set(0, 0.78, 0.26)
  g.add(crossH)
  const crossV = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.22, 0.05),
    new THREE.MeshStandardMaterial({ color: '#FCD34D', emissive: '#FCD34D', emissiveIntensity: 0.5 })
  )
  crossV.position.set(0, 0.78, 0.26)
  g.add(crossV)

  return g
}

export default function Player() {
  const meshRef = useRef<THREE.Group | null>(null)
  const parentRef = useRef<THREE.Group>(null)
  const currentX = useRef(0)
  const targetX = useRef(0)
  const laneTransitioning = useRef(false)
  const transitionTime = useRef(0)
  const startX = useRef(0)
  const bobTime = useRef(0)
  const invincibleTimer = useRef(0)
  const flashTimer = useRef(0)
  const legsRef = useRef<THREE.Object3D[]>([])

  const { setLane, setTargetLane, phase, isInvincible, setInvincible } = useGameStore()

  // Build mesh once
  useEffect(() => {
    const parent = parentRef.current
    if (!parent) return
    const mesh = buildPlayerMesh()
    meshRef.current = mesh
    // Collect legs for animation
    legsRef.current = mesh.children.filter((_, i) => i >= 3 && i <= 4)
    parent.add(mesh)
    return () => {
      parent.remove(mesh)
    }
  }, [])

  // Keyboard / touch lane input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'running' && phase !== 'faith') return
      const cur = useGameStore.getState().targetLane as Lane
      if ((e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') && cur > -1) {
        setTargetLane((cur - 1) as Lane)
      }
      if ((e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') && cur < 1) {
        setTargetLane((cur + 1) as Lane)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, setTargetLane])

  // Swipe input
  useEffect(() => {
    let startTouchX = 0
    let startTouchY = 0
    const onTouchStart = (e: TouchEvent) => {
      startTouchX = e.touches[0].clientX
      startTouchY = e.touches[0].clientY
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (phase !== 'running' && phase !== 'faith') return
      const dx = e.changedTouches[0].clientX - startTouchX
      const dy = e.changedTouches[0].clientY - startTouchY
      const cur = useGameStore.getState().targetLane as Lane
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
        if (dx < 0 && cur > -1) setTargetLane((cur - 1) as Lane)
        if (dx > 0 && cur < 1) setTargetLane((cur + 1) as Lane)
      }
      // Swipe up triggers faith walk if meter is full
      if (dy < -60 && Math.abs(dy) > Math.abs(dx)) {
        const { faithMeter, triggerFaithWalk } = useGameStore.getState()
        if (faithMeter >= 90) triggerFaithWalk()
      }
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [phase, setTargetLane])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    const parent = parentRef.current
    if (!mesh || !parent) return

    const store = useGameStore.getState()

    // Invincible flash timer
    if (invincibleTimer.current > 0) {
      invincibleTimer.current -= delta
      flashTimer.current += delta
      mesh.visible = Math.sin(flashTimer.current * 20) > 0
      if (invincibleTimer.current <= 0) {
        mesh.visible = true
        setInvincible(false)
        invincibleTimer.current = 0
        flashTimer.current = 0
      }
    }
    if (isInvincible && invincibleTimer.current <= 0) {
      invincibleTimer.current = INVINCIBLE_DURATION
    }

    // Lane transition
    if (store.targetLane !== store.lane || laneTransitioning.current) {
      if (!laneTransitioning.current) {
        laneTransitioning.current = true
        transitionTime.current = 0
        startX.current = currentX.current
        targetX.current = LANE_POSITIONS[store.targetLane + 1]
      }
      transitionTime.current += delta
      const t = Math.min(transitionTime.current / LANE_SWITCH_DURATION, 1)
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      currentX.current = startX.current + (targetX.current - startX.current) * ease
      if (t >= 1) {
        laneTransitioning.current = false
        setLane(store.targetLane)
      }
    }

    parent.position.x = currentX.current
    parent.position.z = PLAYER_Z
    playerXRef.current = currentX.current

    // Running bob + Faith Walk elevation
    if (store.phase === 'running' || store.phase === 'faith') {
      bobTime.current += delta * 8
      const faithY = store.phase === 'faith' ? 2.2 : 0
      parent.position.y += (faithY + 0.05 * Math.abs(Math.sin(bobTime.current)) - parent.position.y) * 0.06
      mesh.rotation.z = 0.04 * Math.sin(bobTime.current)
      legsRef.current.forEach((leg, i) => {
        leg.rotation.x = (i % 2 === 0 ? 1 : -1) * 0.4 * Math.sin(bobTime.current)
      })
      // Golden glow during Faith Walk
      if (mesh.children.length > 0) {
        const glowIntensity = store.phase === 'faith' ? 1.0 : 0.5
        ;(mesh.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>)
          .material?.emissiveIntensity !== undefined &&
          ((mesh.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.emissiveIntensity = glowIntensity)
      }
    }
  })

  return <group ref={parentRef} />
}
