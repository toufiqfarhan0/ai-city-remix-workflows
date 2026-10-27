import * as THREE from "three";
/** Conservative swept camera point against expanded architectural envelopes. */
export function createCameraGuard(boxes: THREE.Box3[]) {
  const ray = new THREE.Ray(),
    direction = new THREE.Vector3(),
    hit = new THREE.Vector3();
  return (previous: THREE.Vector3, position: THREE.Vector3) => {
    let blocked = false;
    position.y = Math.max(0.9, position.y);
    direction.copy(position).sub(previous);
    const travel = direction.length();
    if (travel > 0.00001) {
      ray.set(previous, direction.normalize());
      let nearest = travel;
      for (const box of boxes) {
        if (box.containsPoint(previous)) continue;
        if (ray.intersectBox(box, hit))
          nearest = Math.min(nearest, hit.distanceTo(previous));
      }
      if (nearest < travel) {
        position
          .copy(previous)
          .addScaledVector(direction, Math.max(0, nearest - 0.08));
        blocked = true;
      }
    }
    for (const box of boxes)
      if (box.containsPoint(position)) {
        const options = [
          {
            d: position.x - box.min.x,
            axis: "x" as const,
            value: box.min.x - 0.06,
          },
          {
            d: box.max.x - position.x,
            axis: "x" as const,
            value: box.max.x + 0.06,
          },
          {
            d: position.z - box.min.z,
            axis: "z" as const,
            value: box.min.z - 0.06,
          },
          {
            d: box.max.z - position.z,
            axis: "z" as const,
            value: box.max.z + 0.06,
          },
          {
            d: box.max.y - position.y,
            axis: "y" as const,
            value: box.max.y + 0.08,
          },
        ].sort((a, b) => a.d - b.d);
        position[options[0].axis] = options[0].value;
        blocked = true;
      }
    return blocked;
  };
}
