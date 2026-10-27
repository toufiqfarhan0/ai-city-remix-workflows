import type { Footprint, RoadNetwork } from './streets';
export type Point = [
    number,
    number
];
export type CityBlock = {
    id: number;
    boundary: Point[];
    neighborhood: string;
};
export type BuildingParcel = Footprint & {
    blockId: number;
    neighborhood: string;
};
export const vesselSite = { x: -2.65, z: -.55, w: 1.45, d: 1.65, height: 1.75 };
export function inPolygon(x: number, z: number, p: Point[]) { let yes = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a[1] > z) != (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0])
        yes = !yes;
} return yes; }
export function segmentDistance(x: number, z: number, a: Point, b: Point) { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); }
export function planCity(reserved: Footprint[], inside: (x: number, z: number) => boolean) {
    const obstacles = [...reserved, { x: 0, z: -10.6, w: 3.2, d: 7.4, height: 0 }, { ...vesselSite, w: 1.68, d: 1.9 }, { x: -.6, z: 14.7, w: .9, d: .7, height: 0 }];
    const margin = .18;
    const blocked = (p: Point) => obstacles.some(b => Math.abs(p[0] - b.x) < b.w / 2 + margin - .001 && Math.abs(p[1] - b.z) < b.d / 2 + margin - .001);
    const clear = (a: Point, b: Point) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .025); for (let i = 0; i <= n; i++) {
        const p: Point = [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n];
        if (blocked(p) || !inside(...p))
            return false;
    } return true; };
    const corners: Point[] = obstacles.flatMap(b => [-1, 1].flatMap(s => [-1, 1].map(t => [b.x + s * (b.w / 2 + margin + .008), b.z + t * (b.d / 2 + margin + .008)] as Point))).filter(p => !blocked(p) && inside(...p));
    const snap = (p: Point): Point => { if (!blocked(p))
        return p; return corners.reduce((a, b) => Math.hypot(a[0] - p[0], a[1] - p[1]) < Math.hypot(b[0] - p[0], b[1] - p[1]) ? a : b); };
    const segments: {
        a: Point;
        b: Point;
        name: string;
        width: number;
    }[] = [];
    const route = (a: Point, b: Point, name: string, width: number) => { a = snap(a); b = snap(b); if (clear(a, b)) {
        segments.push({ a, b, name, width });
        return;
    } const points = [a, b, ...corners], dist = points.map(() => Infinity), prev = points.map(() => -1), done = new Set<number>(); dist[0] = 0; for (let k = 0; k < points.length; k++) {
        let u = -1;
        points.forEach((_, i) => { if (!done.has(i) && (u < 0 || dist[i] < dist[u]))
            u = i; });
        if (u < 0 || !isFinite(dist[u]))
            break;
        if (u === 1)
            break;
        done.add(u);
        for (let v = 0; v < points.length; v++) {
            const d = dist[u] + Math.hypot(points[v][0] - points[u][0], points[v][1] - points[u][1]);
            if (d < dist[v] && clear(points[u], points[v])) {
                dist[v] = d;
                prev[v] = u;
            }
        }
    } if (prev[1] < 0)
        return; let v = 1; while (prev[v] >= 0) {
        const u = prev[v];
        segments.push({ a: points[u], b: points[v], name, width });
        v = u;
    } };
    const rows = [-14.7, -12.7, -10.5, -8.3, -6.85, -4.45, -2.65, -.15, 2.9, 4.6, 6, 7.7, 9.65, 12.25, 14.05];
    const grid = rows.map((z, j) => { const xs = z < -6.8 ? [-3.25, -1.85, 1.85, 3.25] : z < 3 ? [-3.25, -1.85, .65, 2.95] : [-3.15 + Math.max(0, z - 8) * .24, -1.65 + (j % 3) * .12, .7 + Math.sin(j) * .3, 2.85 - Math.max(0, z - 8) * .2]; xs[0] = z < 3 ? -3.6 : z < 8 ? -3.15 : z < 12 ? -2.7 : -2; return (z > 13 ? [-1.45, -.95, .35, .8] : xs).map(x => { for (let i = 0; i < 30 && !([-1, 1].every(s => inside(x + s * .16, z) && inside(x, z + s * .16))); i++)
        x -= Math.sign(x) * .05; return snap([x, z]); }); });
    grid.forEach((row, j) => { for (let i = 0; i < row.length; i++) {
        if (j)
            route(grid[j - 1][i], row[i], (rows[j] > 11 && i === 2 ? 'Broad Street' : ['West Street', 'Church Street', 'Broadway', 'Water Street'][i]), i === 0 ? .27 : .24);
        if (i && (rows[j] >= -6.85 || i !== 2))
            route(row[i - 1], row[i], rows[j] > 8 ? (j % 2 ? 'Wall Street' : 'Fulton Street') : `Cross street ${j}`, rows[j] > 6 ? .19 : .22);
    } });
    // Split every crossing and collinear endpoint so geometry and traffic share the same planar graph.
    const network: RoadNetwork = { nodes: [], edges: [], avenues: [], crossings: rows };
    const ids = new Map<string, number>();
    const node = (p: Point) => { const key = p.map(v => v.toFixed(4)).join(','); if (ids.has(key))
        return ids.get(key)!; const id = network.nodes.length; ids.set(key, id); network.nodes.push({ x: p[0], z: p[1], neighbors: [], signal: id % 2 }); return id; };
    const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];
    const used = new Set<string>();
    for (const s of segments) {
        const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], len2 = dx * dx + dz * dz;
        if (len2 < 1e-8)
            continue;
        const ts = [0, 1];
        for (const o of segments) {
            const q: Point = [o.a[0] - s.a[0], o.a[1] - s.a[1]], v: Point = [o.b[0] - o.a[0], o.b[1] - o.a[1]], r: Point = [dx, dz], den = cross(r, v);
            if (Math.abs(den) > 1e-8) {
                const t = cross(q, v) / den, u = cross(q, r) / den;
                if (t >= 0 && t <= 1 && u >= 0 && u <= 1)
                    ts.push(t);
            }
            else
                for (const p of [o.a, o.b])
                    if (segmentDistance(...p, s.a, s.b) < 1e-5) {
                        const t = ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dz) / len2;
                        if (t > 0 && t < 1)
                            ts.push(t);
                    }
        }
        ts.sort((a, b) => a - b);
        for (let i = 1; i < ts.length; i++) {
            if (ts[i] - ts[i - 1] < 1e-4)
                continue;
            const a = node([s.a[0] + dx * ts[i - 1], s.a[1] + dz * ts[i - 1]]), b = node([s.a[0] + dx * ts[i], s.a[1] + dz * ts[i]]), key = [a, b].sort((a, b) => a - b).join(',');
            if (used.has(key))
                continue;
            used.add(key);
            network.edges.push({ a, b, name: s.name, width: s.width });
            network.nodes[a].neighbors.push(b);
            network.nodes[b].neighbors.push(a);
        }
    }
    const blocks: CityBlock[] = [], visited = new Set<string>();
    for (let a = 0; a < network.nodes.length; a++)
        for (const b of network.nodes[a].neighbors) {
            if (visited.has(`${a},${b}`))
                continue;
            const boundary: Point[] = [];
            let u = a, v = b;
            for (let k = 0; k < network.edges.length * 2; k++) {
                const key = `${u},${v}`;
                if (visited.has(key))
                    break;
                visited.add(key);
                const n = network.nodes[u];
                boundary.push([n.x, n.z]);
                const at = network.nodes[v], sorted = [...at.neighbors].sort((i, j) => Math.atan2(network.nodes[i].z - at.z, network.nodes[i].x - at.x) - Math.atan2(network.nodes[j].z - at.z, network.nodes[j].x - at.x)), next = sorted[(sorted.indexOf(u) - 1 + sorted.length) % sorted.length];
                u = v;
                v = next;
                if (u === a && v === b)
                    break;
            }
            const area = boundary.reduce((s, p, i) => { const q = boundary[(i + 1) % boundary.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
            if (area > .25) {
                const z = boundary.reduce((s, p) => s + p[1], 0) / boundary.length;
                blocks.push({ id: blocks.length, boundary, neighborhood: z > 8 ? 'Financial District' : z > 2 ? 'SoHo / Tribeca' : z < -6.8 ? 'Uptown' : 'Midtown' });
            }
        }
    const parcels: BuildingParcel[] = [];
    for (const block of blocks) {
        const minX = Math.min(...block.boundary.map(p => p[0])), maxX = Math.max(...block.boundary.map(p => p[0])), minZ = Math.min(...block.boundary.map(p => p[1])), maxZ = Math.max(...block.boundary.map(p => p[1]));
        const nx = Math.max(1, Math.floor((maxX - minX - .4) / .62)), nz = Math.max(1, Math.floor((maxZ - minZ - .4) / .7));
        const cw = (maxX - minX - .46) / nx, cd = (maxZ - minZ - .46) / nz;
        if (cw < .3 || cd < .3)
            continue;
        for (let row = 0; row < nz; row++)
            for (let col = 0; col < nx; col++) {
                const x = minX + .23 + (col + .5) * cw, z = minZ + .23 + (row + .5) * cd;
                for (const scale of [1, .84, .68]) {
                    const w = Math.min(.94, cw - .055) * scale, d = Math.min(.95, cd - .055) * scale;
                    if (w < .28 || d < .28)
                        continue;
                    const pts: Point[] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(p => [x + p[0], z + p[1]]);
                    if (!pts.every(p => inside(...p) && inPolygon(...p, block.boundary)))
                        continue;
                    if (obstacles.some(b => Math.abs(x - b.x) < (w + b.w) / 2 + .055 && Math.abs(z - b.z) < (d + b.d) / 2 + .055))
                        continue;
                    if (network.edges.some(e => { const a = network.nodes[e.a], b = network.nodes[e.b], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz); const support = (Math.abs(dz) * w + Math.abs(dx) * d) / (2 * len); return segmentDistance(x, z, [a.x, a.z], [b.x, b.z]) < support + (e.width ?? .24) / 2 + .04; }))
                        continue;
                    parcels.push({ x, z, w, d, height: 0, blockId: block.id, neighborhood: x < -1.9 && z > -2.6 && z < 2 ? 'Hudson Yards' : block.neighborhood });
                    break;
                }
            }
    }
    // Secondary street-front subdivisions fill residual irregular corners of an existing block.
    for (const block of blocks) {
        if (block.neighborhood === 'Uptown')
            continue;
        const minX = Math.min(...block.boundary.map(p => p[0])), maxX = Math.max(...block.boundary.map(p => p[0])), minZ = Math.min(...block.boundary.map(p => p[1])), maxZ = Math.max(...block.boundary.map(p => p[1]));
        for (let z = minZ + .3; z < maxZ - .25; z += .42)
            for (let x = minX + .3; x < maxX - .25; x += .42) {
                const w = .34, d = .34;
                const pts: Point[] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(p => [x + p[0], z + p[1]]);
                if (!pts.every(p => inside(...p) && inPolygon(...p, block.boundary)))
                    continue;
                if ([...obstacles, ...parcels].some(b => Math.abs(x - b.x) < (w + b.w) / 2 + .04 && Math.abs(z - b.z) < (d + b.d) / 2 + .04))
                    continue;
                if (network.edges.some(e => { const a = network.nodes[e.a], b = network.nodes[e.b], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz); return segmentDistance(x, z, [a.x, a.z], [b.x, b.z]) < (Math.abs(dz) * w + Math.abs(dx) * d) / (2 * len) + (e.width ?? .24) / 2 + .045; }))
                    continue;
                parcels.push({ x, z, w, d, height: 0, blockId: block.id, neighborhood: block.neighborhood });
            }
    }
    // Reserved landmark campuses are explicit blocks even where a pedestrian edge
    // closes a superblock rather than a vehicle carriageway.
    for (const lot of [...reserved, vesselSite])
        if (!blocks.some(b => inPolygon(lot.x, lot.z, b.boundary))) {
            const w = lot.w / 2 + .04, d = lot.d / 2 + .04;
            blocks.push({ id: blocks.length, boundary: [[lot.x - w, lot.z - d], [lot.x + w, lot.z - d], [lot.x + w, lot.z + d], [lot.x - w, lot.z + d]], neighborhood: lot.z > 8 ? 'Financial District' : lot.x < -2 && lot.z < 2 ? 'Hudson Yards' : 'Midtown' });
        }
    return { network, blocks, parcels };
}
