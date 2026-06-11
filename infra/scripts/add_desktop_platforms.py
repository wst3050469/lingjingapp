import json, hashlib, os

BASE = '/var/www/downloads'

# List of (platform, filename_pattern, key)
# We'll try to find the highest matching version file
platforms = {
    'win-x64': 'LingJing-Setup-1.72.31-win-x64.exe',
    'win-x64-portable': 'LingJing-Portable-1.72.31-win-x64.exe',
    'linux-x64': 'LingJing-1.72.31-linux-x86_64.AppImage',
    'linux-x64-deb': 'LingJing-1.72.31-linux-x86_64.deb',
}

# Load existing
with open('/var/www/html/downloads/versions.json') as f:
    data = json.load(f)

# Check if v1.72.33 already has win/linux entries
ver = data['versions'][0]
if ver['version'] == '1.72.33':
    for plat_key, filename in platforms.items():
        filepath = os.path.join(BASE, filename)
        if os.path.exists(filepath) and plat_key not in ver.get('files', {}):
            size = os.path.getsize(filepath)
            url = f'https://ide.zhejiangjinmo.com/downloads/{filename}'
            ver['files'][plat_key] = url
            ver['platforms'][plat_key] = {'size': size, 'sha512': 'existing'}
            print(f'Added {plat_key}: {filename} ({size//1048576}MB)')
        elif not os.path.exists(filepath):
            print(f'File not found: {filepath}')

with open('/var/www/html/downloads/versions.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('Done - versions.json updated with desktop platforms')
