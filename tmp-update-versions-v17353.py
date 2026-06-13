#!/usr/bin/env python3
"""Update versions.json on production server for v1.73.53"""
import requests, time

API = 'https://lingjing.zhejiangjinmo.com'
API_KEY = 'lingjing-cloud-key-v2-a1b2c3d4e5f6g7h8'

# v1.73.53 data
new_version = {
    "version": "1.73.53",
    "status": "published",
    "published_at": "2026-06-13T16:40:00+08:00",
    "releaseNotes": "v1.73.53: @codepilot/core 注入 ASAR — 桌面端在线升级模块加载根治",
    "files": {
        "win-x64": {
            "name": "灵境 Setup 1.73.53.exe",
            "url": "https://ide.zhejiangjinmo.com/downloads/%E7%81%B5%E5%A2%83%20Setup%201.73.53.exe",
            "size": 145545768,
            "sha512": "917d7d8db89049eecd24477e8b349fbb2c6fe3b9afd728ba7290fa0e0ec5092019e9a6c0c51db0b840706e0c276cdac84eda4be1045d3d0e9147057ef98b2aed"
        },
        "win-x64-portable": {
            "name": "LingJing-Portable-1.73.53-win-x64.exe",
            "url": "https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-1.73.53-win-x64.exe",
            "size": 145204246,
            "sha512": "f0f0f9eb2b7fe6ef7b9af82a3fc9d5ee8c310ee7996ef3a107a8fdaa25da6b2ab000bf6cdcf1607ee2266e9e542d590230e627e8e84f3c1f3bb86a02465b7ee5"
        },
        "win-x64-asar": {
            "name": "app-1.73.53.asar",
            "url": "https://ide.zhejiangjinmo.com/downloads/app-1.73.53.asar",
            "size": 0,
            "sha512": ""
        }
    }
}

# Get current versions.json
resp = requests.get(f"{API}/versions.json", headers={"x-api-key": API_KEY}, timeout=10)
print(f"GET /versions.json → {resp.status_code}")

data = resp.json()
print(f"Current latest: {data.get('latest', 'unknown')}")
print(f"Current versions count: {len(data.get('versions', []))}")

# Update
data['latest'] = '1.73.53'

# Add new version entry
found = False
for v in data.get('versions', []):
    if v['version'] == '1.73.53':
        v.update(new_version)
        found = True
        break

if not found:
    data['versions'].insert(0, new_version)

# Publish via Admin API
resp = requests.post(
    f"{API}/api/admin/publish",
    headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
    json={"versions": data},
    timeout=30
)
print(f"POST /api/admin/publish → {resp.status_code}: {resp.text[:200]}")

# Sync versions
resp = requests.post(
    f"{API}/api/admin/sync-versions",
    headers={"x-api-key": API_KEY},
    timeout=30
)
print(f"POST /api/admin/sync-versions → {resp.status_code}: {resp.text[:200]}")

# Verify
resp = requests.get(f"{API}/api/latest?current=1.73.52", headers={"x-api-key": API_KEY}, timeout=10)
print(f"GET /api/latest?current=1.73.52 → {resp.status_code}: {resp.text[:300]}")

resp = requests.get(f"{API}/api/latest?current=1.73.53", headers={"x-api-key": API_KEY}, timeout=10)
print(f"GET /api/latest?current=1.73.53 → {resp.status_code}: {resp.text[:300]}")

print("\n✅ Done!")
