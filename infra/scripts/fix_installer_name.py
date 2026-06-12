import json

# Update both versions.json copies
for path in ['/var/www/html/versions.json', '/var/www/downloads/versions.json']:
    with open(path) as f:
        data = json.load(f)
    v0 = data['versions'][0]
    v0['files']['win-x64'] = 'https://ide.zhejiangjinmo.com/downloads/LingJing-Setup-1.73.34-win-x64.exe'
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f'Updated {path}')

# Update latest.yml
yml = """version: 1.73.34
files:
  - url: LingJing-Setup-1.73.34-win-x64.exe
    sha512: fKrhHuA2rcSwGVeJFgVkc6jzes3OnBJEeD8ZPO0r7Ha7NcaEdiyuox2uaqTnrI6z7cBzyNsPa9S2h+lYyhOXfQ==
    size: 145759462
path: LingJing-Setup-1.73.34-win-x64.exe
sha512: fKrhHuA2rcSwGVeJFgVkc6jzes3OnBJEeD8ZPO0r7Ha7NcaEdiyuox2uaqTnrI6z7cBzyNsPa9S2h+lYyhOXfQ==
releaseDate: '2026-06-12T04:00:00.000Z'
"""
with open('/var/www/downloads/latest.yml', 'w') as f:
    f.write(yml)
print('Updated latest.yml')
