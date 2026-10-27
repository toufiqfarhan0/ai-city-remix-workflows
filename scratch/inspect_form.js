const https = require('https');
function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
      res.on('error', () => resolve(''));
    });
  });
}
async function run() {
  const index = await fetch('https://www.sandbase.ai/lab/assets/index-DTBI0Ull.js');
  const matches = [...index.matchAll(/assets\/[a-zA-Z0-9_-]+\.js/g)].map(m => m[0]);
  const unique = [...new Set(matches)];
  for (const c of unique) {
    const text = await fetch('https://www.sandbase.ai/lab/' + c);
    if (text.includes('Counts toward AI workflow') || text.includes('OPEN-SOURCE WORKFLOW') || text.includes('repo or download link')) {
      console.log('FOUND FORM IN:', c);
      const idx = text.indexOf('Counts toward AI workflow');
      console.log(text.substring(Math.max(0, idx - 300), Math.min(text.length, idx + 400)));
    }
  }
}
run();
