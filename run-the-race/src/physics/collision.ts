// 2D AABB overlap in the XZ plane.
// Returns true if two axis-aligned rectangles overlap.
export function overlapsXZ(
  ax: number, az: number, aHalfW: number, aHalfD: number,
  bx: number, bz: number, bHalfW: number, bHalfD: number,
): boolean {
  return (
    Math.abs(ax - bx) < aHalfW + bHalfW &&
    Math.abs(az - bz) < aHalfD + bHalfD
  )
}
