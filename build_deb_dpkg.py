# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Kill all fpm
print('Killing stuck fpm processes...', flush=True)
subprocess.run(['ssh', SERVER, 'pkill -9 -f fpm; pkill -9 -f timeout; sleep 1'], capture_output=True, timeout=10)
print('Done', flush=True)

# Try dpkg-deb instead - create a simple deb structure
LINUX_UNPACKED = f'{ELEC}/release-v17374/linux-unpacked'
DEB_DIR = f'{ELEC}/release-v17374/deb-build'
DEB_FILE = f'{ELEC}/release-v17374/LingJing-1.73.73-linux-x86_64.deb'

print('Creating deb package with dpkg-deb...', flush=True)

# Step 1: Create DEBIAN control directory with the linux-unpacked as data
# dpkg-deb needs: DEBIAN/control + the files as they would be installed
# In this case, linux-unpacked/ should be at /opt/灵境/

# Create temp build dir
subprocess.run(['ssh', SERVER, f'rm -rf {DEB_DIR} && mkdir -p {DEB_DIR}/DEBIAN'], capture_output=True, timeout=10)

# Create control file
control = '''Package: lingjing-ide
Version: 1.73.73
Section: devel
Priority: optional
Architecture: amd64
Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0
Recommends: libappindicator3-1
Maintainer: LingJing AI <support@lingjing.ai>
Description: LingJing IDE - AI Powered IDE
'''

# Save control and build
cmds = [
    f'cat > {DEB_DIR}/DEBIAN/control << \'EOF\'\n{control}\nEOF',
    f'cp -a {LINUX_UNPACKED}/* {DEB_DIR}/opt/灵境/ 2>/dev/null || mkdir -p {DEB_DIR}/opt && cp -a {LINUX_UNPACKED} {DEB_DIR}/opt/灵境',
    f'if [ -f {LINUX_UNPACKED}/灵境 ]; then mkdir -p {DEB_DIR}/usr/bin && ln -sf /opt/灵境/灵境 {DEB_DIR}/usr/bin/lingjing; fi',
    f'dpkg-deb --build {DEB_DIR} {DEB_FILE} 2>&1',
    f'ls -lh {DEB_FILE}',
]

for c in cmds:
    print(f'$ {c.split(chr(10))[0][:80]}...', flush=True)
    r = subprocess.run(['ssh', SERVER, c], capture_output=True, timeout=120)
    out = r.stdout.decode('utf-8', errors='replace').strip()
    err = r.stderr.decode('utf-8', errors='replace').strip()
    if out: print('  OUT:', out[:200], flush=True)
    if err: print('  ERR:', err[:200], flush=True)

# Cleanup
subprocess.run(['ssh', SERVER, f'rm -rf {DEB_DIR}'], capture_output=True, timeout=10)
print('\nDone!', flush=True)
