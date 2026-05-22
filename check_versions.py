#!/usr/bin/env python3
import json
with open('/var/www/html/versions.json') as f:
    d = json.load(f)
print('latest:', d.get('latest'))
for v in d.get('versions', [])[:5]:
    ver = v.get('version', '?')
    status = v.get('status', '?')
    files = v.get('files', {})
    platforms = list(files.keys())
    print(f'  {ver} [{status}] platforms={platforms}')
