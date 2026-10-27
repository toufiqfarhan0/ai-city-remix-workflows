const https = require('https');

https.get('https://www.sandbase.ai/lab/assets/SubmitPage-CYr2vla5.js', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('File size:', data.length);
    const matches = [...data.matchAll(/(fetch\([^)]+\)|PUT|POST|method)/g)];
    for (const m of matches) {
      const idx = m.index;
      console.log('--- Match:', m[0], 'at', idx, '---');
      console.log(data.substring(Math.max(0, idx - 100), Math.min(data.length, idx + 200)));
    }
  });
});
