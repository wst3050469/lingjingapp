import json

for path in ['/var/www/html/versions.json', '/var/www/lingjing/versions.json', '/opt/lingjing/update-server/data/versions.json']:
    with open(path, 'r') as f:
        data = json.load(f)
    
    for v in data.get('versions', []):
        if v['version'] == '1.73.35':
            v['platforms']['win-x64-portable'] = {
                'size': 118489088,
                'sha512': 'pending'
            }
            v['files']['win-x64-portable'] = 'https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-1.73.35-win-x64.exe'
            break
    
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f'Updated {path}')
