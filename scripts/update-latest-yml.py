#!/usr/bin/env python3
"""Update latest.yml and latest-linux.yml to v1.54.0."""
import os

# Windows latest.yml content
WINDOWS_YML = """version: 1.54.0
releaseDate: 2026-05-24T10:00:00.000Z
files:
  - url: LingJing-Setup-1.54.0-win-x64.exe
    sha512: 202900ead30f338febaa56bcbcefafae383fa789615bfa1eac4416d419a998422011f7ed08184ba2b49f5b04415e5a8117f6ed95802ef57888d85fce55899a78
    size: 142143591
path: LingJing-Setup-1.54.0-win-x64.exe
sha512: 202900ead30f338febaa56bcbcefafae383fa789615bfa1eac4416d419a998422011f7ed08184ba2b49f5b04415e5a8117f6ed95802ef57888d85fce55899a78
releaseNotes: v1.54.0: 全面系统检查修复 - electron-builder清理 + 全平台版本升级部署
"""

# Linux latest-linux.yml content
LINUX_YML = """version: 1.54.0
releaseDate: 2026-05-24T10:00:00.000Z
files:
  - url: LingJing-1.54.0-linux-x86_64.AppImage
    sha512: 23ff36f671cc192f9eab4e07a7cdc20abbbc19b9cb5101d0594c7564927514f1699f4986d1626ebc0f8f479c31a3f524a5978d136edcd52d69f970bef891ac6a
    size: 180006466
path: LingJing-1.54.0-linux-x86_64.AppImage
sha512: 23ff36f671cc192f9eab4e07a7cdc20abbbc19b9cb5101d0594c7564927514f1699f4986d1626ebc0f8f479c31a3f524a5978d136edcd52d69f970bef891ac6a
releaseNotes: v1.54.0: 全面系统检查修复 - electron-builder清理 + 全平台版本升级部署
"""

# Linux locations for latest-linux.yml
LINUX_YML_PATHS = [
    '/var/www/html/downloads/latest-linux.yml',
    '/var/www/html/latest-linux.yml',
    '/var/www/lingjing/latest-linux.yml',
]

# Windows locations for latest.yml
WINDOWS_YML_PATHS = [
    '/var/www/html/downloads/latest.yml',
    '/var/www/html/latest.yml',
    '/var/www/lingjing/latest.yml',
]

def main():
    for path in LINUX_YML_PATHS:
        with open(path, 'w') as f:
            f.write(LINUX_YML)
        print(f"  ✅ {path}")

    for path in WINDOWS_YML_PATHS:
        with open(path, 'w') as f:
            f.write(WINDOWS_YML)
        print(f"  ✅ {path}")

    print("\n✅ All YML files updated to v1.54.0")

if __name__ == '__main__':
    main()
