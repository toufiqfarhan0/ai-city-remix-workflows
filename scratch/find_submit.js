const https = require('https');

https.get('https://www.sandbase.ai/lab/assets/index-DTBI0Ull.js', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    // Find all dynamic imports
    const matches = [...data.matchAll(/import\("([^"]+)"\)/g)].map(m => m[1]);
    console.log('Dynamic imports:', matches);
    
    // Check if any mention submit
    const submitChunks = matches.filter(m => m.toLowerCase().includes('submit') || m.toLowerCase().includes('edit') || m.toLowerCase().includes('create'));
    console.log('Submit chunks:', submitChunks);
  });
});
