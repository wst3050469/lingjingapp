import os

content = """version: 1.73.53
files:
  - url: https://ide.zhejiangjinmo.com/downloads/%E7%81%B5%E5%A2%83%20Setup%201.73.53.exe
    sha512: 917d7d8db89049eecd24477e8b349fbb2c6fe3b9afd728ba7290fa0e0ec5092019e9a6c0c51db0b840706e0c276cdac84eda4be1045d3d0e9147057ef98b2aed
    size: 145545768
  - url: https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-1.73.53-win-x64.exe
    sha512: f0f0f9eb2b7fe6ef7b9af82a3fc9d5ee8c310ee7996ef3a107a8fdaa25da6b2ab000bf6cdcf1607ee2266e9e542d590230e627e8e84f3c1f3bb86a02465b7ee5
    size: 145204246
path: /%E7%81%B5%E5%A2%83%20Setup%201.73.53.exe
sha512: 917d7d8db89049eecd24477e8b349fbb2c6fe3b9afd728ba7290fa0e0ec5092019e9a6c0c51db0b840706e0c276cdac84eda4be1045d3d0e9147057ef98b2aed
releaseDate: '2026-06-13T16:40:00.000Z'
"""

paths = [
    "/var/www/downloads/latest.yml",
    "/var/www/html/downloads/latest.yml",
    "/var/www/lingjing/latest.yml",
]

for p in paths:
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w') as f:
        f.write(content)
    print(f"OK: {p}")

print("Done!")
