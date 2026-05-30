import { describe, expect, it } from 'vitest';
import { anchorPoint, buildBeamPath } from './beam';

describe('anchorPoint', () => {
  const container = { left: 100, top: 50, width: 600, height: 120 };

  it('returns the right-center of a node, relative to the container', () => {
    const node = { left: 120, top: 70, width: 80, height: 80 };
    // x: (120-100) + 80 = 100 ; y: (70-50) + 40 = 60
    expect(anchorPoint(container, node, 'right')).toEqual({ x: 100, y: 60 });
  });

  it('returns the left-center of a node, relative to the container', () => {
    const node = { left: 500, top: 70, width: 80, height: 80 };
    // x: (500-100) + 0 = 400 ; y: 60
    expect(anchorPoint(container, node, 'left')).toEqual({ x: 400, y: 60 });
  });

  it('returns the center of a node', () => {
    const node = { left: 300, top: 70, width: 80, height: 80 };
    // x: (300-100) + 40 = 240 ; y: 60
    expect(anchorPoint(container, node, 'center')).toEqual({ x: 240, y: 60 });
  });
});

describe('buildBeamPath', () => {
  it('draws a straight quadratic through the midpoint when curvature is 0', () => {
    const d = buildBeamPath({ start: { x: 0, y: 10 }, end: { x: 100, y: 10 }, curvature: 0 });
    expect(d).toBe('M 0,10 Q 50,10 100,10');
  });

  it('bows the control point upward by the curvature (negative y)', () => {
    const d = buildBeamPath({ start: { x: 0, y: 10 }, end: { x: 100, y: 10 }, curvature: 20 });
    // control = midX 50, midY 10 - 20 = -10
    expect(d).toBe('M 0,10 Q 50,-10 100,10');
  });

  it('defaults curvature to 0 when omitted', () => {
    const d = buildBeamPath({ start: { x: 10, y: 0 }, end: { x: 30, y: 40 } });
    // mid = (20,20)
    expect(d).toBe('M 10,0 Q 20,20 30,40');
  });

  it('rounds sub-pixel coordinates to 2 decimals to keep the path string stable', () => {
    const d = buildBeamPath({ start: { x: 0.333, y: 0 }, end: { x: 1, y: 0 }, curvature: 0 });
    // start x rounds to 0.33, mid x = 0.6665 -> 0.67
    expect(d).toBe('M 0.33,0 Q 0.67,0 1,0');
  });
});
