// Shared mutable ref for player world-X position, written every frame by Player.tsx,
// read by SpawnerSystem.tsx for collision — avoids Zustand subscription overhead.
export const playerXRef = { current: 0 }
