#!/usr/bin/env python3
"""Update versions.json to add v1.54.0 entry and sync all locations."""
import json
import sys
import hashlib
import os

# File paths
PATHS = [
    '/var/www/html/versions.json',
    '/var/www/html/downloads/versions.json',
    '/var/www/downloads/versions.json',
    '/var/www/update-server/data/versions.json',
    '/opt/lingjing/update-server/data/versions.json',
    '/opt/lingjing-update-server/data/versions.json',
    '/opt/lingjing-update/data/versions.json',
    '/opt/lingjing-cloud-server/versions.json',
]

# v1.54.0 file details
NEW_VERSION = {
    'version': '1.54.0',
    'releaseDate': '2026-05-24T10:00:00.000Z',
    'releaseNotes': 'v1.54.0: 全面系统检查修复 - electron-builder清理 + 全平台版本升级部署',
    'status': 'published',
    'publishedAt': '2026-05-24T10:00:00.000Z',
    'files': {
        'linux-x64': {
            'url': 'LingJing-1.54.0-linux-x86_64.AppImage',
            'size': 180006466,
            'sha512': '23ff36f671cc192f9eab4e07a7cdc20abbbc19b9cb5101d0594c7564927514f1699f4986d1626ebc0f8f479c31a3f524a5978d136edcd52d69f970bef891ac6a'
        },
        'linux-deb': {
            'url': 'LingJing-1.54.0-linux-x86_64.deb',
            'size': 109184118,
            'sha512': '4da47cad07cd3401c4e42407c668ebc3d9d557f10d78760ccfb2ed7539d10c8fd18d512f632125c8e14ec841855c30346f09b6f89d9bcabcc674b61bbc5522f6'
        },
        'win-x64': {
            'url': 'LingJing-Setup-1.54.0-win-x64.exe',
            'size': 142143591,
            'sha512': '202900ead30f338febaa56bcbcefafae383fa789615bfa1eac4416d419a998422011f7ed08184ba2b49f5b04415e5a8117f6ed95802ef57888d85fce55899a78'
        },
        'win-x64-portable': {
            'url': 'LingJing-Portable-1.54.0-win-x64.exe',
            'size': 141802077,
            'sha512': '68e1df754a8c115caef29bcaae74fa5dfbdd498b62725dc772ff155c68243aebe1992ed2ae3bfaf4280bc19b5a94f58cd77cb2d2bdd23eeb0685360ac34a8168'
        },
        'win-x64-blockmap': {
            'url': 'LingJing-Setup-1.54.0-win-x64.exe.blockmap',
            'size': 148734
        },
        'android': {
            'url': 'lingjing-mobile-v1.52.12.apk',
            'size': 81479178
        }
    }
}

def main():
    # Read the first file as source
    source_path = PATHS[0]
    if not os.path.exists(source_path):
        print(f"ERROR: {source_path} not found")
        sys.exit(1)

    with open(source_path, 'r') as f:
        data = json.load(f)

    # Insert v1.54.0 at the beginning
    data['versions'].insert(0, NEW_VERSION)
    data['latest'] = '1.54.0'
    data['version'] = '1.54.0'
    data['files'] = NEW_VERSION['files']
    data['updated'] = '2026-05-24T10:00:00.000Z'

    # Write to all locations
    for path in PATHS:
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"  ✅ {path}")
        except Exception as e:
            print(f"  ❌ {path}: {e}")

    # Verify consistency
    print("\nVerifying consistency...")
    first_md5 = None
    for path in PATHS:
        with open(path, 'rb') as f:
            md5 = hashlib.md5(f.read()).hexdigest()
        status = "✅" if first_md5 is None or md5 == first_md5 else "❌ MISMATCH"
        if first_md5 is None:
            first_md5 = md5
        print(f"  {status} {path} -> md5={md5[:12]}...")

    print(f"\nDone! Versions: {len(data['versions'])} entries, latest={data['latest']}")

if __name__ == '__main__':
    main()
