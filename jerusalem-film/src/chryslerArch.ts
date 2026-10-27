import * as THREE from "three";
// MiniMax M3.1 Flash through SandBase; repeated as four intersecting crown faces.
export function pointedArch(width: number, height: number): THREE.Shape {
  const shape = new THREE.Shape();
  const half = width / 2;
  const spring = height * 0.55;

  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.quadraticCurveTo(half, spring, 0, height);
  shape.quadraticCurveTo(-half, spring, -half, 0);
  shape.closePath();

  const hole = new THREE.Path();
  const holeHalf = width * 0.28;
  const holeBase = height * 0.1;
  const holeApex = height * 0.68;
  const holeSpring = holeBase + (holeApex - holeBase) * 0.55;

  hole.moveTo(-holeHalf, holeBase);
  hole.quadraticCurveTo(-holeHalf, holeSpring, 0, holeApex);
  hole.quadraticCurveTo(holeHalf, holeSpring, holeHalf, holeBase);
  hole.closePath();
  shape.holes.push(hole);

  return shape;
}
