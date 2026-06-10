#!/usr/bin/env python3
import os

for root, dirs, files in os.walk('/root/cloud-server'):
    for f in files:
        if f.endswith('.html') or (f.endswith('.js') and 'platform' in root):
            path = os.path.join(root, f)
            size = os.path.getsize(path)
            print(f'{path} ({size} bytes)')
    if 'web-platform' in root:
        print(f'  DIR: {root}')
