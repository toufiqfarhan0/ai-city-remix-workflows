const https = require('https');
https.get('https://www.sandbase.ai/lab/assets/pages-WC4Vsb5y.js', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    let idx = 0;
    while ((idx = data.indexOf('workflow_url', idx)) !== -1) {
      console.log('--- workflow_url match at', idx, '---');
      console.log(data.substring(Math.max(0, idx - 200), Math.min(data.length, idx + 300)));
      idx += 12;
    }
  });
});
