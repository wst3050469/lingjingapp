#!/usr/bin/env python3
import os
import stat

def info(path):
    if os.path.islink(path):
        target = os.readlink(path)
        print(f"{path} -> SYMLINK to {target}")
    elif os.path.exists(path):
        s = os.stat(path)
        print(f"{path} ({s.st_size} bytes) - inode: {s.st_ino}")
    else:
        print(f"{path} - NOT FOUND")

info('/root/cloud-server/server.js')
info('/root/lingjing/cloud-server/server.js')

# Check if same file
s1 = os.stat('/root/cloud-server/server.js')
s2 = os.stat('/root/lingjing/cloud-server/server.js')
print(f"\nSame file: {s1.st_ino == s2.st_ino} (ino1={s1.st_ino}, ino2={s2.st_ino})")

# Also check web-platform
info('/root/cloud-server/web-platform')
info('/root/lingjing/cloud-server/web-platform')
if os.path.exists('/root/cloud-server/web-platform') and os.path.exists('/root/lingjing/cloud-server/web-platform'):
    s1 = os.stat('/root/cloud-server/web-platform')
    s2 = os.stat('/root/lingjing/cloud-server/web-platform')
    print(f"web-platform same: {s1.st_ino == s2.st_ino}")
