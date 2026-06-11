import json

with open('/var/www/html/downloads/versions.json') as f:
    data = json.load(f)

# Update latest
data['latest'] = '1.72.33'

# Add new version entry at the top
new_ver = {
    "version": "1.72.33",
    "status": "published",
    "releaseDate": "2026-06-11T13:00:00.000Z",
    "releaseNotes": "v1.72.33: 移动端开发中心 — 代码编辑器+审批+CI/CD+需求下发",
    "platforms": {
        "android": {
            "size": 82580984,
            "sha512": "81b90c86bebe3c31fffc3c92fc890e335613599a359e27a96aff155c19111ae03f4e6f2f89221d926c748993daf3c32690cdc160dc92f7756d41c39affb36f48"
        },
        "win-x64": {
            "size": 145757203,
            "sha512": "pending"
        },
        "win-x64-portable": {
            "size": 145621114,
            "sha512": "pending"
        },
        "linux-x64": {
            "size": 180634755,
            "sha512": "pending"
        },
        "linux-x64-deb": {
            "size": 219375364,
            "sha512": "pending"
        }
    },
    "files": {
        "android": "https://ide.zhejiangjinmo.com/downloads/lingjing-v1.72.33.apk"
    }
}

data['versions'].insert(0, new_ver)

with open('/var/www/html/downloads/versions.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('versions.json updated: latest=1.72.33')
