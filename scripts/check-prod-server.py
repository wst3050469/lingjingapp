#!/usr/bin/env python3
with open('/root/cloud-server/server.js') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'admin' in line.lower() and ('sendFile' in line or 'static' in line or 'app.get' in line or 'app.use' in line):
        # Print context
        start = max(0, i-2)
        end = min(len(lines), i+8)
        for j in range(start, end):
            marker = '>>>' if j == i else '   '
            print(f'{marker} {j+1}: {lines[j].rstrip()}')
        print('---')
