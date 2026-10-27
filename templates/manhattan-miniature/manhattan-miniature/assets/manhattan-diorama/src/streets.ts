export type Footprint = {
  x: number;
  z: number;
  w: number;
  d: number;
  height: number;
};
export type RoadNode = {
  x: number;
  z: number;
  neighbors: number[];
  signal: number;
};
export type RoadEdge = { a: number; b: number; name?:string; width?:number };
export type RoadNetwork = {
  nodes: RoadNode[];
  edges: RoadEdge[];
  avenues: number[];
  crossings: number[];
};
export function occupied(
  x: number,
  z: number,
  buildings: Footprint[],
  margin = 0.12,
) {
  return buildings.some(
    (b) =>
      Math.abs(x - b.x) < b.w / 2 + margin &&
      Math.abs(z - b.z) < b.d / 2 + margin,
  );
}
export function makeRoadNetwork(
  buildings: Footprint[],
  inside: (x: number, z: number) => boolean,
): RoadNetwork {
  const avenues = [-2.57, -1.1, 0.8, 2.5],
    crossings = Array.from({ length: 24 }, (_, i) => -14.9 + i * 1.25),
    nodes: RoadNode[] = [],
    edges: RoadEdge[] = [],
    grid = new Map<string, number>();
  const valid = (x: number, z: number) =>
    inside(x, z) &&
    !(Math.abs(x) < 1.75 && z < -6.8) &&
    !occupied(x, z, buildings, 0.15);
  for (let j = 0; j < crossings.length; j++)
    for (let i = 0; i < avenues.length; i++)
      if (valid(avenues[i], crossings[j])) {
        grid.set(`${i},${j}`, nodes.length);
        nodes.push({
          x: avenues[i],
          z: crossings[j],
          neighbors: [],
          signal: (i + j) % 2,
        });
      }
  for (let j = 0; j < crossings.length; j++)
    for (let i = 0; i < avenues.length; i++) {
      const a = grid.get(`${i},${j}`);
      if (a === undefined) continue;
      for (const [di, dj] of [
        [1, 0],
        [0, 1],
      ]) {
        const b = grid.get(`${i + di},${j + dj}`);
        if (b === undefined) continue;
        const A = nodes[a],
          B = nodes[b],
          steps = Math.ceil(Math.hypot(B.x - A.x, B.z - A.z) / 0.04);
        let clear = true;
        for (let t = 0; t <= steps; t++)
          if (
            !valid(
              A.x + ((B.x - A.x) * t) / steps,
              A.z + ((B.z - A.z) * t) / steps,
            )
          ) {
            clear = false;
            break;
          }
        if (clear) {
          nodes[a].neighbors.push(b);
          nodes[b].neighbors.push(a);
          edges.push({ a, b });
        }
      }
    }
  return { nodes, edges, avenues, crossings };
}
export function greenFor(node: RoadNode, vertical: boolean, time: number) {
  const phase = (time + node.signal * 1.3) % 12;
  return vertical ? phase < 5.2 : phase >= 6 && phase < 11.2;
}
export function collisionBoxes(footprints: Footprint[]) {
  return footprints.map((b) => ({
    minX: b.x - b.w / 2 - 0.05,
    maxX: b.x + b.w / 2 + 0.05,
    minY: 0.63,
    maxY: b.height + 0.95,
    minZ: b.z - b.d / 2 - 0.05,
    maxZ: b.z + b.d / 2 + 0.05,
  }));
}
