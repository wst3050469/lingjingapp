#!/usr/bin/env python3
"""Run on production server to update versions.json for v1.73.53"""
import json, os, shutil

VERSION = "1.73.53"

# New version entry
new_entry = {
    "version": VERSION,
    "status": "published",
    "published_at": "2026-06-13T16:40:00+08:00",
    "releaseNotes": f"v{VERSION}: @codepilot/core inject into ASAR — desktop online upgrade module-loading root fix",
    "files": {
        "win-x64": {
            "name": f"灵境 Setup {VERSION}.exe",
            "url": f"https://ide.zhejiangjinmo.com/downloads/%E7%81%B5%E5%A2%83%20Setup%20{VERSION}.exe",
            "size": 145545768,
            "sha512": "917d7d8db89049eecd24477e8b349fbb2c6fe3b9afd728ba7290fa0e0ec5092019e9a6c0c51db0b840706e0c276cdac84eda4be1045d3d0e9147057ef98b2aed"
        },
        "win-x64-portable": {
            "name": f"LingJing-Portable-{VERSION}-win-x64.exe",
            "url": f"https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-{VERSION}-win-x64.exe",
            "size": 145204246,
            "sha512": "f0f0f9eb2b7fe6ef7b9af82a3fc9d5ee8c310ee7996ef3a107a8fdaa25da6b2ab000bf6cdcf1607ee2266e9e542d590230e627e8e84f3c1f3bb86a02465b7ee5"
        },
        "win-x64-asar": {
            "name": f"app-{VERSION}.asar",
            "url": f"https://ide.zhejiangjinmo.com/downloads/app-{VERSION}.asar",
            "size": 0,
            "sha512": ""
        }
    }
}

# Paths to update
paths = [
    "/var/www/html/versions.json",
    "/var/www/lingjing/versions.json",
    "/var/www/downloads/versions.json",
    "/opt/lingjing/update-server/data/versions.json",
    "/opt/lingjing-update/data/versions.json",
    "/root/lingjing-update/data/versions.json",
    "/var/www/update-server/data/versions.json",
]

for path in paths:
    try:
        if not os.path.exists(path):
            print(f"SKIP (not found): {path}")
            continue
        
        # Backup
        bak = path + ".bak17353"
        shutil.copy2(path, bak)
        
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        old_latest = data.get('latest', 'unknown')
        data['latest'] = VERSION
        
        # Add/replace version entry
        versions = data.get('versions', [])
        found = False
        for i, v in enumerate(versions):
            if v.get('version') == VERSION:
                versions[i] = new_entry
                found = True
                break
        
        if not found:
            versions.insert(0, new_entry)
        
        data['versions'] = versions
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"OK: {path}  ({old_latest} → {VERSION}, {len(versions)} versions)")
    except Exception as e:
        print(f"ERR: {path} - {e}")

print("\nDone!")
