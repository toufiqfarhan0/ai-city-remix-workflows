// Generated with MiniMax M3.1 Flash through the authenticated SandBase connection.
export function waveHeight(x: number, z: number, time: number): number {
  return (
    0.006 * Math.sin(0.35 * x + 0.22 * z - 0.6 * time) +
    0.006 * Math.sin(-0.18 * x + 0.42 * z + 0.45 * time)
  );
}
