import json

for path in ['/var/www/html/versions.json', '/var/www/downloads/versions.json']:
    with open(path) as f:
        data = json.load(f)
    
    v0 = data['versions'][0]
    # Fix Chinese filename URLs to ASCII
    old_win = v0['files'].get('win-x64', '')
    if '灵境 Setup' in old_win:
        v0['files']['win-x64'] = 'https://ide.zhejiangjinmo.com/downloads/LingJing-Setup-1.72.31-win-x64.exe'
        print(f'FIXED {path}: win-x64 URL')
    elif 'LingJing-Setup' not in old_win:
        v0['files']['win-x64'] = 'https://ide.zhejiangjinmo.com/downloads/LingJing-Setup-1.72.31-win-x64.exe'
        print(f'UPDATED {path}: win-x64 URL')
    else:
        print(f'OK {path}: already ASCII')

    # Also fix any other old format entries
    for key in list(v0['files'].keys()):
        val = v0['files'][key]
        if isinstance(val, str) and '灵境' in val:
            new_val = val.replace('灵境 Setup 1.72.31.exe', 'LingJing-Setup-1.72.31-win-x64.exe')
            v0['files'][key] = new_val
            print(f'FIXED {path}: {key} contained Chinese chars')

    with open(path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

print('Done')
