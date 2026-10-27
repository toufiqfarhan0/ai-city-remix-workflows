import urllib.request, ssl

ctx = ssl._create_unverified_context()
req = urllib.request.Request('https://www.sandbase.ai/lab/assets/index-DTBI0Ull.js', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx) as r:
    idx_js = r.read().decode('utf-8')

for name in ['bK', 'vK']:
    pos = idx_js.find(f'function {name}')
    if pos == -1:
        pos = idx_js.find(f'{name}=')
    print(f'=== {name} at {pos} ===')
    if pos != -1:
        print(idx_js[max(0, pos-20):min(len(idx_js), pos+400)])
