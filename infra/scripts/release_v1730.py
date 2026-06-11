import json

with open('/var/www/html/downloads/versions.json') as f:
    data = json.load(f)

data['latest'] = '1.73.0'

new_ver = {
    "version": "1.73.0",
    "status": "published",
    "releaseDate": "2026-06-11T14:00:00.000Z",
    "releaseNotes": "v1.73.0: 移动端开发中心 — 代码编辑器+审批看板+CI/CD进度+需求下发+云端AI直连+App内升级",
    "platforms": {
        "android": {"size": 82585624, "sha512": "pending"},
        "win-x64": {"size": 145759462, "sha512": "existing"},
        "win-x64-portable": {"size": 145621114, "sha512": "existing"},
        "linux-x64": {"size": 180798330, "sha512": "existing"},
        "linux-x64-deb": {"size": 109336546, "sha512": "existing"}
    },
    "files": {
        "android": "https://ide.zhejiangjinmo.com/downloads/lingjing-v1.73.0.apk",
        "win-x64": "https://ide.zhejiangjinmo.com/downloads/灵境 Setup 1.72.31.exe",
        "win-x64-portable": "https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-1.72.31-win-x64.exe",
        "linux-x64": "https://ide.zhejiangjinmo.com/downloads/LingJing-1.72.31-linux-x86_64.AppImage",
        "linux-x64-deb": "https://ide.zhejiangjinmo.com/downloads/LingJing-1.72.31-linux-x86_64.deb"
    }
}
data['versions'].insert(0, new_ver)

with open('/var/www/html/downloads/versions.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

# Also sync to nginx root
with open('/var/www/downloads/versions.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('versions.json updated: latest=1.73.0')
