import fs from 'node:fs';

const r = JSON.parse(fs.readFileSync('work/facts/claims.request.json', 'utf8'));

function findExcerpts(srcId, queries) {
  const chunks = r.chunks.filter(c => c.source_id === srcId);
  const text = chunks.map(c => c.text).join('\n');
  for (const q of queries) {
    const idx = text.indexOf(q);
    if (idx !== -1) {
      console.log(`FOUND [${srcId}]: "${q}" => ${JSON.stringify(text.slice(Math.max(0, idx - 30), Math.min(text.length, idx + q.length + 50)))}`);
    } else {
      console.log(`NOT FOUND [${srcId}]: "${q}"`);
    }
  }
}

findExcerpts('s03', ['Chao Phraya', '21 April 1782', 'Rama I', 'Rattanakosin', 'Grand Palace', 'Wat Arun', 'Wat Pho']);
findExcerpts('s02', ['昭披耶河', '1782年4月21日', '拉玛一世', '拉达那哥欣', '大皇宫', '黎明寺', '卧佛寺']);
