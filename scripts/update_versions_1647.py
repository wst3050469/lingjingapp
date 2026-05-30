#!/usr/bin/env python3
import json, sys, shutil

paths = [
    "/var/www/html/downloads/versions.json",
    "/var/www/html/versions.json",
    "/opt/lingjing/update-server/data/versions.json",
    "/root/lingjing-git/update-server/data/versions.json",
]

# Read from primary path
with open(paths[0], 'r') as f:
    data = json.load(f)

# New version entry
new_entry = {
    "version": "1.64.7",
    "status": "published",
    "publishedAt": "2026-05-31T00:30:00.000Z",
    "releaseNotes": "优化: 文件变更自动处理UI - 分离保存按钮 + 实时生效机制",
    "files": {
        "win-x64": {
            "url": "LingJing-Setup-1.64.7-win-x64.exe",
            "size": 142207147,
            "sha512": "657b2c9117b374b2cf801662a5d77ee8c6dda1c02540f3eb6e0eedb40443a11a0cbb4b0ac5d11dc863c4b49c3ef16b66b2f5f6ff145aaf8b0d6029de08a21d0f"
        },
        "win-x64-portable": {
            "url": "LingJing-Portable-1.64.7-win-x64.exe",
            "size": 141865637,
            "sha512": "c60edd3fc85fe448646255adea88a22d52efff5b8bdd48908c5bff0097b87d7ea945ee41a6395f482bdaaac51307139f5851221eda433d29765a5f30b82cfdfc"
        },
        "win-x64-blockmap": {
            "url": "LingJing-Setup-1.64.7-win-x64.exe.blockmap",
            "size": 148865,
            "sha512": "657b2c9117b374b2cf801662a5d77ee8c6dda1c02540f3eb6e0eedb40443a11a0cbb4b0ac5d11dc863c4b49c3ef16b66b2f5f6ff145aaf8b0d6029de08a21d0f"
        }
    }
}

# Insert at beginning of versions array
data["versions"].insert(0, new_entry)
data["latest"] = "1.64.7"

# Write to all paths
for p in paths:
    with open(p, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"✅ Updated {p}")

print("\n✅ versions.json synced to all 4 paths")
print(f"   latest: {data['latest']}")
