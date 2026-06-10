#!/usr/bin/env python3
import re
with open('/root/lingjing/cloud-server/web-platform/public/index.html') as f:
    html = f.read()
sections = re.findall(r'<div class="section-title">([^<]+)<', html)
names = re.findall(r'<div class="name">([^<]+)<', html)
print(f'On-disk: sections={len(sections)}, names={len(names)}')
for n in names:
    print(f'  {n}')
print(f'First 200 chars: {html[:200]}')
