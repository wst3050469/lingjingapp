import json, os

BASE = '/var/www/downloads'

# Find latest Setup file
setups = [f for f in os.listdir(BASE) if 'Setup' in f and f.endswith('.exe') and not f.endswith('.blockmap')]
# Sort by modification time, take newest
setups.sort(key=lambda f: os.path.getmtime(os.path.join(BASE, f)), reverse=True)
installer = (setups[0], os.path.getsize(os.path.join(BASE, setups[0]))) if setups else None

# Also find portable
portables = [f for f in os.listdir(BASE) if 'Portable' in f and f.endswith('.exe') and not f.endswith('.blockmap')]
portables.sort(key=lambda f: os.path.getmtime(os.path.join(BASE, f)), reverse=True)
portable = (portables[0], os.path.getsize(os.path.join(BASE, portables[0]))) if portables else None

with open('/var/www/html/downloads/versions.json') as f:
    data = json.load(f)

ver = data['versions'][0]

if installer:
    name, size = installer
    ver['files']['win-x64'] = f'https://ide.zhejiangjinmo.com/downloads/{name}'
    ver['platforms']['win-x64'] = {'size': size, 'sha512': 'existing'}
    print(f'win-x64: {name} ({size//1048576}MB)')

if portable:
    name, size = portable
    ver['files']['win-x64-portable'] = f'https://ide.zhejiangjinmo.com/downloads/{name}'
    ver['platforms']['win-x64-portable'] = {'size': size, 'sha512': 'existing'}
    print(f'win-x64-portable: {name} ({size//1048576}MB)')

with open('/var/www/html/downloads/versions.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print('Done')
