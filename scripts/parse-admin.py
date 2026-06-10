#!/usr/bin/env python3
import sys, re
# Read from stdin or file
if len(sys.argv) > 1:
    with open(sys.argv[1]) as f:
        html = f.read()
else:
    html = sys.stdin.read()

names = re.findall(r'<div class="name">([^<]+)<', html)
print(f'Names: {len(names)}, Bytes: {len(html)}')
for n in names:
    print(f'  {n}')
