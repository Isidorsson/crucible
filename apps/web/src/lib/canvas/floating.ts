import { Position, type InternalNode, type Node } from '@xyflow/svelte';

// Returns where an edge anchored to `target` should attach on `source`'s
// rectangle. Picks the side of `source` whose midpoint is closest to
// target's center — gives the same "shortest-route to nearest side" feel
// you see in Lucid/diagrams.net/Miro instead of always L→R.
function getNodeIntersection(
  intersectionNode: InternalNode<Node>,
  targetNode: InternalNode<Node>
): { x: number; y: number } {
  const intersectionNodeWidth = intersectionNode.measured?.width ?? 0;
  const intersectionNodeHeight = intersectionNode.measured?.height ?? 0;
  const intersectionNodePosition = intersectionNode.internals.positionAbsolute;
  const targetPosition = targetNode.internals.positionAbsolute;
  const targetWidth = targetNode.measured?.width ?? 0;
  const targetHeight = targetNode.measured?.height ?? 0;

  const w = intersectionNodeWidth / 2;
  const h = intersectionNodeHeight / 2;

  const x2 = intersectionNodePosition.x + w;
  const y2 = intersectionNodePosition.y + h;
  const x1 = targetPosition.x + targetWidth / 2;
  const y1 = targetPosition.y + targetHeight / 2;

  // Classic rectangle/line intersection from xyflow's floating-edges example.
  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (yy3 - xx3) + y2;

  return { x, y };
}

function getEdgePosition(
  node: InternalNode<Node>,
  intersectionPoint: { x: number; y: number }
): Position {
  const n = node.internals.positionAbsolute;
  const nx = Math.round(n.x);
  const ny = Math.round(n.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);
  const w = node.measured?.width ?? 0;
  const h = node.measured?.height ?? 0;

  if (px <= nx + 1) return Position.Left;
  if (px >= nx + w - 1) return Position.Right;
  if (py <= ny + 1) return Position.Top;
  if (py >= ny + h - 1) return Position.Bottom;
  return Position.Top;
}

export interface FloatingEdgeParams {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourcePos: Position;
  targetPos: Position;
}

export function getEdgeParams(
  source: InternalNode<Node>,
  target: InternalNode<Node>
): FloatingEdgeParams {
  const sourceIntersection = getNodeIntersection(source, target);
  const targetIntersection = getNodeIntersection(target, source);

  return {
    sx: sourceIntersection.x,
    sy: sourceIntersection.y,
    tx: targetIntersection.x,
    ty: targetIntersection.y,
    sourcePos: getEdgePosition(source, sourceIntersection),
    targetPos: getEdgePosition(target, targetIntersection)
  };
}
