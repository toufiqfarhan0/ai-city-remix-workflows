const https = require('https');

https.get('https://www.sandbase.ai/lab/assets/SubmitPage-CYr2vla5.js', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('SubmitPage length:', data.length);
    const terms = ['workflow', 'Counts toward', 'repo or download', 'workflow_url'];
    for (const t of terms) {
      let idx = 0;
      while ((idx = data.indexOf(t, idx)) !== -1) {
        console.log('Found term', t, 'at', idx);
        console.log(data.substring(Math.max(0, idx - 200), Math.min(data.length, idx + 400)));
        idx += t.length + 1;
      }
    }
  });
});
