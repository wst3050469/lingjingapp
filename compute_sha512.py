# -*- coding: utf-8 -*-
import hashlib

files = [
    r'D:\lingjing-ide\desktop\electron\release-v17374\灵境 Setup 1.73.73.exe',
    r'D:\lingjing-ide\desktop\electron\release-v17374\LingJing-Portable-1.73.73-win-x64.exe',
]

for f in files:
    h = hashlib.sha512()
    with open(f, 'rb') as fp:
        for chunk in iter(lambda: fp.read(65536), b''):
            h.update(chunk)
    name = f.split('\\')[-1]
    print(f'{name}: sha512={h.hexdigest()}')
