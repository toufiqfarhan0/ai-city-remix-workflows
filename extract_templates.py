import urllib.request
import json
import ssl
import re

ssl._create_default_https_context = ssl._create_unverified_context
req = urllib.request.Request('https://www.sandbase.ai/lab/event/aicityremix', headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8')

match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    page_props = data.get('props', {}).get('pageProps', {})
    print('pageProps keys:', list(page_props.keys()))
    text = json.dumps(page_props, indent=2)
    with open('page_props.json', 'w', encoding='utf-8') as f:
        f.write(text)
    
    # find all downloads and skills
    print("Looking for zip links:")
    for m in re.finditer(r'https?://[^\s"]+\.zip', text):
        print(" ", m.group(0))
    print("Looking for /lab/skills/ links:")
    for m in re.finditer(r'/lab/skills/[a-zA-Z0-9_-]+', text):
        print(" ", m.group(0))
    print("Looking for /lab/downloads/ links:")
    for m in re.finditer(r'/lab/downloads/[a-zA-Z0-9_.-]+', text):
        print(" ", m.group(0))
else:
    print('No __NEXT_DATA__ found')
