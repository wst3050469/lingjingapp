import json, urllib.request

# Update versions.json
for path in ['/var/www/html/versions.json', '/var/www/downloads/versions.json']:
    with open(path) as f:
        data = json.load(f)
    data['latest'] = '1.73.34'
    
    new_ver = {
        "version": "1.73.34",
        "status": "published",
        "releaseDate": "2026-06-12T02:00:00.000Z",
        "releaseNotes": "v1.73.34: 全平台版本统一 — 云文件浏览+消息修复+下载修复+版本同步",
        "platforms": {
            "android": {"size": 82585624, "sha512": "pending"},
            "win-x64": {"size": 145759462, "sha512": "existing"},
            "win-x64-portable": {"size": 145621114, "sha512": "existing"},
            "linux-x64": {"size": 180798330, "sha512": "existing"},
            "linux-x64-deb": {"size": 109336546, "sha512": "existing"}
        },
        "files": {
            "android": "https://ide.zhejiangjinmo.com/downloads/lingjing-v1.73.34.apk",
            "win-x64": "https://ide.zhejiangjinmo.com/downloads/LingJing-Setup-1.72.31-win-x64.exe",
            "win-x64-portable": "https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-1.72.31-win-x64.exe",
            "linux-x64": "https://ide.zhejiangjinmo.com/downloads/LingJing-1.72.31-linux-x86_64.AppImage",
            "linux-x64-deb": "https://ide.zhejiangjinmo.com/downloads/LingJing-1.72.31-linux-x86_64.deb"
        }
    }
    data['versions'].insert(0, new_ver)
    
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

print('versions.json updated to 1.73.34')

# Update latest.yml
yml_content = """version: 1.72.29
files:
  - url: LingJing-Setup-1.72.31-win-x64.exe
    sha512: fKrhHuA2rcSwGVeJFgVkc6jzes3OnBJEeD8ZPO0r7Ha7NcaEdiyuox2uaqTnrI6z7cBzyNsPa9S2h+lYyhOXfQ==
    size: 145759462
path: LingJing-Setup-1.72.31-win-x64.exe
sha512: fKrhHuA2rcSwGVeJFgVkc6jzes3OnBJEeD8ZPO0r7Ha7NcaEdiyuox2uaqTnrI6z7cBzyNsPa9S2h+lYyhOXfQ==
releaseDate: '2026-06-11T08:31:37.190Z'
"""
with open('/var/www/downloads/latest.yml', 'w') as f:
    f.write(yml_content)
print('latest.yml updated')
