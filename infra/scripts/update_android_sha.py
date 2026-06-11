import json

with open('/var/www/html/downloads/versions.json') as f:
    data = json.load(f)

ver = data['versions'][0]
# Update android size and sha512 for the latest APK
ver['platforms']['android'] = {
    'size': 82581320,
    'sha512': 'c9cde6f42fae9bc5e7dfa78398c465a62afefcb77bb3750e39ca366045dc709b1f31c9105c74d36c66ee70f86c0384e939ba73748b9af41802cab344de4cfc1d'
}
ver['files']['android'] = 'https://ide.zhejiangjinmo.com/downloads/lingjing-v1.72.33.apk'

with open('/var/www/html/downloads/versions.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print('Updated android platform info')
