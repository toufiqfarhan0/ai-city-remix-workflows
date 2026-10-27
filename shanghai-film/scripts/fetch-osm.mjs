import { writeFileSync, mkdirSync } from 'node:fs';

async function fetchOsmBbox(minLon, minLat, maxLon, maxLat) {
  const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${minLon},${minLat},${maxLon},${maxLat}`;
  console.log(`Fetching OSM data from ${url}...`);
  const res = await fetch(url, { headers: { 'User-Agent': 'city-grows-3d/0.1' } });
  if (!res.ok) throw new Error(`OSM API failed with status ${res.status}: ${res.statusText}`);
  const xml = await res.text();
  console.log(`Fetched ${xml.length} bytes of OSM XML.`);

  const nodes = new Map();
  const nodeRegex = /<node\s+([^>]+)>/g;
  let match;
  while ((match = nodeRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const idMatch = /id="(\d+)"/.exec(attrs);
    const latMatch = /lat="([^"]+)"/.exec(attrs);
    const lonMatch = /lon="([^"]+)"/.exec(attrs);
    if (idMatch && latMatch && lonMatch) {
      nodes.set(idMatch[1], { lat: parseFloat(latMatch[1]), lon: parseFloat(lonMatch[1]) });
    }
  }
  console.log(`Parsed ${nodes.size} nodes.`);

  const elements = [];
  const wayRegex = /<way\s+id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g;
  while ((match = wayRegex.exec(xml)) !== null) {
    const wayId = match[1];
    const wayContent = match[2];

    const tags = {};
    const tagRegex = /<tag\s+k="([^"]+)"\s+v="([^"]+)"/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(wayContent)) !== null) {
      tags[tagMatch[1]] = tagMatch[2];
    }

    if (!tags.building) continue;

    const geometry = [];
    const ndRegex = /<nd\s+ref="(\d+)"/g;
    let ndMatch;
    while ((ndMatch = ndRegex.exec(wayContent)) !== null) {
      const node = nodes.get(ndMatch[1]);
      if (node) geometry.push(node);
    }

    if (geometry.length >= 4) {
      elements.push({
        type: 'way',
        id: wayId,
        tags,
        geometry
      });
    }
  }

  console.log(`Extracted ${elements.length} building ways with complete polygons.`);
  return { elements };
}

async function main() {
  mkdirSync('cache', { recursive: true });
  // Shanghai Lujiazui + Bund bounding box: 31.228 to 31.248, 121.482 to 121.516
  const minLon = 121.482, minLat = 31.228, maxLon = 121.516, maxLat = 31.248;
  const data = await fetchOsmBbox(minLon, minLat, maxLon, maxLat);
  writeFileSync('cache/osm-shanghai.json', JSON.stringify(data));
  console.log('Saved to cache/osm-shanghai.json');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
