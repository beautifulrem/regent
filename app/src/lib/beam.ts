// Pure SVG-path geometry for the animated authority "energy beam" between graph
// nodes. Kept dependency-free and side-effect-free so it can be unit-tested; the
// React component (AnimatedBeam) does the DOM measuring and feeds points in here.

export interface Point {
  x: number;
  y: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Connection point on a node, expressed in the container's coordinate space.
 * `right` = right-center edge, `left` = left-center edge, `center` = middle.
 */
export function anchorPoint(container: RectLike, node: RectLike, side: 'left' | 'right' | 'center'): Point {
  const offsetX = side === 'left' ? 0 : side === 'right' ? node.width : node.width / 2;
  return {
    x: node.left - container.left + offsetX,
    y: node.top - container.top + node.height / 2,
  };
}

export interface BeamPathOptions {
  start: Point;
  end: Point;
  /** How far the control point bows perpendicular (upward) from the chord midpoint, in px. */
  curvature?: number;
}

const round = (n: number): number => Math.round(n * 100) / 100;

/**
 * Quadratic-bezier path from `start` to `end`, bowed upward by `curvature`.
 * Matches the Magic-UI AnimatedBeam convention (control at the chord midpoint,
 * raised by `curvature` on the y axis) — ideal for a horizontal row of nodes.
 */
export function buildBeamPath({ start, end, curvature = 0 }: BeamPathOptions): string {
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2 - curvature;
  return `M ${round(start.x)},${round(start.y)} Q ${round(cx)},${round(cy)} ${round(end.x)},${round(end.y)}`;
}
